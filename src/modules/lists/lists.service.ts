import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ListItem, Product, ShoppingList } from '@prisma/client';
import { toProductResponseDto } from '../../common/mappers/product.mapper';
import { CategoryPricingService } from '../category-pricing/category-pricing.service';
import { ProductsRepository } from '../products/products.repository';
import { RewardsService } from '../rewards/rewards.service';
import { calculateSavings } from './domain/savings.calculator';
import { optimizeKnapsack } from './domain/knapsack.engine';
import type { KnapsackCandidate } from './domain/knapsack.types';
import { ListsRepository } from './lists.repository';
import type { KnapsackConfig } from '../../config/configuration';
import type { AddItemDto } from './dto/add-item.dto';
import type { CreateListDto } from './dto/create-list.dto';
import type { ListResponseDto } from './dto/list-response.dto';
import type { OptimizeListResponseDto } from './dto/optimize-list-response.dto';
import type { SavingsResponseDto } from './dto/savings-response.dto';
import type { UpdateListDto } from './dto/update-list.dto';

type ListItemWithProduct = ListItem & { product: Product };
type ListWithItems = ShoppingList & { items: ListItemWithProduct[] };

/** priority (1-5) -> utility (0-100). Priority 3 (the default) sits at the
 *  midpoint (60), leaving headroom for higher-priority items to genuinely
 *  outrank it and lower-priority ones to fall behind. */
function utilityFromPriority(priority: number): number {
  return priority * 20;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

@Injectable()
export class ListsService {
  private readonly knapsackConfig: KnapsackConfig;

  constructor(
    private readonly repository: ListsRepository,
    private readonly categoryPricing: CategoryPricingService,
    private readonly productsRepository: ProductsRepository,
    private readonly rewardsService: RewardsService,
    configService: ConfigService,
  ) {
    this.knapsackConfig = configService.get<KnapsackConfig>('knapsack')!;
  }

  async create(userId: string, dto: CreateListDto): Promise<ListResponseDto> {
    const list = await this.repository.create(
      userId,
      dto.budgetMax,
      dto.plannedDate,
    );
    return this.toResponse(list);
  }

  async findAllForUser(userId: string): Promise<ListResponseDto[]> {
    const lists = await this.repository.findAllForUser(userId);
    return lists.map((l) => this.toResponse(l));
  }

  async findById(id: string): Promise<ListResponseDto> {
    const list = await this.getOrThrow(id);
    return this.toResponse(list);
  }

  async update(id: string, dto: UpdateListDto): Promise<ListResponseDto> {
    await this.getOrThrow(id);
    const list = await this.repository.update(id, dto);
    return this.toResponse(list);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.delete(id);
  }

  async addItem(listId: string, dto: AddItemDto): Promise<ListResponseDto> {
    await this.getOrThrow(listId);
    const product = await this.productsRepository.findById(dto.productId);
    if (!product) throw new NotFoundException('Product not found');

    await this.repository.addItem(
      listId,
      dto.productId,
      dto.quantity ?? 1,
      product.price.toNumber(),
      dto.priority ?? 3,
    );
    return this.findById(listId);
  }

  async removeItem(listId: string, itemId: string): Promise<ListResponseDto> {
    await this.getOrThrow(listId);
    await this.repository.removeItem(listId, itemId);
    return this.findById(listId);
  }

  /** RF-04 + RF-05: runs the knapsack optimizer over the list's candidates and persists the result. */
  async optimize(listId: string): Promise<OptimizeListResponseDto> {
    const list = await this.getOrThrow(listId);

    if (list.items.length === 0) {
      const updated = await this.repository.applyOptimization(listId, [], {
        totalEstSaving: 0,
        totalImpactScore: 0,
      });
      return {
        ...this.toResponse(updated!),
        usedFallback: false,
        computeTimeMs: 0,
      };
    }

    const pricingByCategory = await this.fetchPricingByCategory(list.items);

    const candidates: KnapsackCandidate[] = list.items.map((item) => {
      const pricing = pricingByCategory.get(item.product.categoryId)!;
      const unitPrice = item.unitPrice.toNumber();
      const lineTotalCents = Math.round(
        unitPrice * item.quantity.toNumber() * 100,
      );
      const relativeSaving = pricing.avgPrice
        ? clamp(
            ((pricing.avgPrice - unitPrice) / pricing.avgPrice) * 100,
            0,
            100,
          )
        : 0;

      return {
        id: item.id,
        priceCents: lineTotalCents,
        utility: utilityFromPriority(item.priority),
        sustainabilityScore: item.product.finalScoreCache?.toNumber() ?? 50,
        relativeSaving,
      };
    });

    const budgetCents = Math.round(list.budgetMax.toNumber() * 100);

    const start = performance.now();
    const result = optimizeKnapsack(candidates, {
      budgetCents,
      weights: {
        utility: this.knapsackConfig.weightUtility,
        sustainability: this.knapsackConfig.weightSustainability,
        saving: this.knapsackConfig.weightSaving,
      },
      discretizationStepCents: this.knapsackConfig.discretizationStepCents,
      maxStepCents: this.knapsackConfig.maxStepCents,
      maxDpCells: this.knapsackConfig.maxDpCells,
      maxItemsDp: this.knapsackConfig.maxItemsDp,
    });
    const computeTimeMs = performance.now() - start;

    const selectedIdSet = new Set(result.selectedIds);
    const selectedItems = list.items.filter((i) => selectedIdSet.has(i.id));

    const savings = calculateSavings(
      selectedItems.map((item) => ({
        productId: item.productId,
        price: item.unitPrice.toNumber(),
        categoryAvgPrice: pricingByCategory.get(item.product.categoryId)!
          .avgPrice,
      })),
    );

    const totalImpactScore =
      selectedItems.length === 0
        ? 0
        : selectedItems.reduce(
            (sum, i) => sum + (i.product.finalScoreCache?.toNumber() ?? 50),
            0,
          ) / selectedItems.length;

    const updated = await this.repository.applyOptimization(
      listId,
      result.selectedIds,
      {
        totalEstSaving: savings.totalEstSaving,
        totalImpactScore,
      },
    );

    // RF-11: reward each selected item that clears the sustainability threshold.
    await Promise.all(
      selectedItems.map((item) =>
        this.rewardsService.awardForOptimizedItem(
          list.userId,
          item.id,
          item.product.finalScoreCache?.toNumber() ?? 50,
        ),
      ),
    );

    return {
      ...this.toResponse(updated!),
      usedFallback: result.usedFallback,
      computeTimeMs,
    };
  }

  async getSavings(listId: string): Promise<SavingsResponseDto> {
    const list = await this.getOrThrow(listId);
    const selected = list.items.filter((i) => i.includedInOptimum);
    const pricingByCategory = await this.fetchPricingByCategory(selected);

    return calculateSavings(
      selected.map((item) => ({
        productId: item.productId,
        price: item.unitPrice.toNumber(),
        categoryAvgPrice: pricingByCategory.get(item.product.categoryId)!
          .avgPrice,
      })),
    );
  }

  /** RF-06 acceptance: creates a traceable substitute ListItem (see ListsRepository.substituteItem) and awards RF-11 points for the improvement. */
  async substituteItem(
    listId: string,
    itemId: string,
    substituteProductId: string,
  ): Promise<ListResponseDto> {
    const list = await this.getOrThrow(listId);
    const originalItem = list.items.find((i) => i.id === itemId);
    if (!originalItem) throw new NotFoundException('List item not found');

    const newProduct =
      await this.productsRepository.findById(substituteProductId);
    if (!newProduct)
      throw new NotFoundException('Substitute product not found');

    const newItem = await this.repository.substituteItem(
      itemId,
      listId,
      substituteProductId,
    );

    await this.rewardsService.awardForSubstitution(
      list.userId,
      newItem.id,
      originalItem.product.finalScoreCache?.toNumber() ?? 50,
      newProduct.finalScoreCache?.toNumber() ?? 50,
    );

    return this.findById(listId);
  }

  private async fetchPricingByCategory(items: ListItemWithProduct[]) {
    const uniqueCategoryIds = [
      ...new Set(items.map((i) => i.product.categoryId)),
    ];
    const entries = await Promise.all(
      uniqueCategoryIds.map(
        async (categoryId) =>
          [
            categoryId,
            await this.categoryPricing.getCategoryPricing(categoryId),
          ] as const,
      ),
    );
    return new Map(entries);
  }

  private async getOrThrow(id: string): Promise<ListWithItems> {
    const list = await this.repository.findById(id);
    if (!list) throw new NotFoundException('Shopping list not found');
    return list;
  }

  private toResponse(list: ListWithItems): ListResponseDto {
    return {
      id: list.id,
      userId: list.userId,
      budgetMax: list.budgetMax.toNumber(),
      status: list.status,
      totalEstSaving: list.totalEstSaving?.toNumber() ?? null,
      totalImpactScore: list.totalImpactScore?.toNumber() ?? null,
      plannedDate: list.plannedDate,
      createdAt: list.createdAt,
      items: list.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: toProductResponseDto(item.product),
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        priority: item.priority,
        includedInOptimum: item.includedInOptimum,
        substitutedFromId: item.substitutedFromId,
      })),
    };
  }
}
