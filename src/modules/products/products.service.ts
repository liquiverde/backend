import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Product } from '@prisma/client';
import { toProductResponseDto } from '../../common/mappers/product.mapper';
import { CategoriesService } from '../categories/categories.service';
import { CategoryPricingService } from '../category-pricing/category-pricing.service';
import { RedisService } from '../../redis/redis.service';
import { SustainabilityService } from '../sustainability/sustainability.service';
import {
  PRODUCT_SOURCE_CLIENTS,
  type ExternalProductData,
  type ProductSourceClient,
} from './integrations/product-source.interface';
import { ProductsRepository } from './products.repository';
import type { ProductResponseDto } from './dto/product-response.dto';
import type { SearchProductDto } from './dto/search-product.dto';

const BARCODE_FOUND_TTL_SECONDS = 24 * 60 * 60;
const BARCODE_NOT_FOUND_TTL_SECONDS = 5 * 60;

interface SearchResult {
  items: ProductResponseDto[];
  total: number;
  degraded: boolean;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly repository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly categoryPricing: CategoryPricingService,
    private readonly sustainabilityService: SustainabilityService,
    private readonly redis: RedisService,
    @Inject(PRODUCT_SOURCE_CLIENTS)
    private readonly sourceClients: ProductSourceClient[],
  ) {}

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.repository.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return this.toResponse(product);
  }

  async compare(ids: string[]): Promise<ProductResponseDto[]> {
    const products = await this.repository.findByIds(ids);
    return products.map((p) => this.toResponse(p));
  }

  /**
   * RF-01. Degradation chain (RNF-02): local catalog first (no network
   * dependency), then external sources in order, upserting a hit into the
   * local catalog so subsequent lookups never need the network again.
   */
  async searchByBarcode(barcode: string): Promise<ProductResponseDto> {
    const local = await this.repository.findByBarcode(barcode);
    if (local) {
      return this.toResponse(local);
    }

    const cacheKey = (source: string) =>
      `${source.toLowerCase()}:barcode:${barcode}`;
    let anySourceReachable = false;

    for (const client of this.sourceClients) {
      const key = cacheKey(client.sourceName);
      const cached = await this.redis.getJson<
        ExternalProductData | { notFound: true }
      >(key);
      if (cached) {
        anySourceReachable = true;
        if ('notFound' in cached) continue;
        return this.upsertAndScore(cached);
      }

      try {
        const found = await client.findByBarcode(barcode);
        anySourceReachable = true;
        if (found) {
          await this.redis.setJson(key, found, BARCODE_FOUND_TTL_SECONDS);
          return this.upsertAndScore(found);
        }
        await this.redis.setJson(
          key,
          { notFound: true },
          BARCODE_NOT_FOUND_TTL_SECONDS,
        );
      } catch (error) {
        this.logger.warn(
          `${client.sourceName} unavailable for barcode ${barcode}: ${(error as Error).message}`,
        );
      }
    }

    if (!anySourceReachable) {
      throw new ServiceUnavailableException(
        'Product not found locally and external sources are currently unreachable',
      );
    }
    throw new NotFoundException('Product not found');
  }

  /**
   * RF-02. Local catalog always answers first; external sources only
   * augment when the caller asked for a query and local results are thin —
   * keeps searches without a network dependency the common case.
   */
  async search(dto: SearchProductDto): Promise<SearchResult> {
    const { q, categoryId, page, limit } = dto;
    const local = await this.repository.searchLocal({
      q,
      categoryId,
      page,
      limit,
    });

    if (!q || local.items.length >= limit) {
      return {
        items: local.items.map((p) => this.toResponse(p)),
        total: local.total,
        degraded: false,
      };
    }

    const knownBarcodes = new Set(
      local.items.map((p) => p.barcode).filter((b): b is string => !!b),
    );
    const augmented: Product[] = [];
    let degraded = false;

    for (const client of this.sourceClients) {
      if (local.items.length + augmented.length >= limit) break;
      try {
        const hits = await client.searchByText(q, limit);
        for (const hit of hits) {
          if (local.items.length + augmented.length >= limit) break;
          if (hit.barcode && knownBarcodes.has(hit.barcode)) continue;
          const product = await this.upsertAndScoreRaw(hit);
          augmented.push(product);
          if (hit.barcode) knownBarcodes.add(hit.barcode);
        }
      } catch (error) {
        degraded = true;
        this.logger.warn(
          `${client.sourceName} unavailable for search "${q}": ${(error as Error).message}`,
        );
      }
    }

    return {
      items: [...local.items, ...augmented].map((p) =>
        this.toResponse(p, degraded),
      ),
      total: local.total + augmented.length,
      degraded,
    };
  }

  private async upsertAndScore(
    data: ExternalProductData,
  ): Promise<ProductResponseDto> {
    const product = await this.upsertAndScoreRaw(data);
    return this.toResponse(product);
  }

  private async upsertAndScoreRaw(data: ExternalProductData): Promise<Product> {
    const categoryId = await this.categoriesService.resolveByHintOrFallback(
      data.categoryHint,
    );
    const pricing = await this.categoryPricing.getCategoryPricing(categoryId);
    const estimatedPrice = pricing.avgPrice ?? 0;

    const product = await this.repository.upsertFromExternal({
      data,
      categoryId,
      price: estimatedPrice,
      priceIsEstimated: true,
    });

    await this.sustainabilityService.recalculate(product.id);
    return (await this.repository.findById(product.id))!;
  }

  private toResponse(product: Product, degraded = false): ProductResponseDto {
    return toProductResponseDto(product, degraded);
  }
}
