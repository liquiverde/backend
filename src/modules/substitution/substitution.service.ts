import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Product } from '@prisma/client';
import { toProductResponseDto } from '../../common/mappers/product.mapper';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsRepository } from '../products/products.repository';
import { findSubstitutes } from './domain/substitution.engine';
import type { SubstitutionProduct } from './domain/substitution.types';
import type { SubstitutionConfig } from '../../config/configuration';
import type { SubstitutionResponseDto } from './dto/substitution-response.dto';

const POOL_SIZE = 50;

@Injectable()
export class SubstitutionService {
  private readonly config: SubstitutionConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsRepository: ProductsRepository,
    configService: ConfigService,
  ) {
    this.config = configService.get<SubstitutionConfig>('substitution')!;
  }

  async findSubstitutesFor(
    productId: string,
    limit: number,
  ): Promise<SubstitutionResponseDto[]> {
    const target = await this.productsRepository.findById(productId);
    if (!target) throw new NotFoundException('Product not found');

    const category = await this.prisma.category.findUnique({
      where: { id: target.categoryId },
    });
    const categoryIds = [target.categoryId];
    if (category?.parentId) categoryIds.push(category.parentId);

    const poolProducts = await this.productsRepository.findTopByCategories(
      categoryIds,
      POOL_SIZE,
    );

    const targetVector = this.toSubstitutionProduct(target);
    const poolVectors = poolProducts.map((p) => this.toSubstitutionProduct(p));

    const ranked = findSubstitutes(targetVector, poolVectors, {
      maxPriceIncreasePct: this.config.maxPriceIncreasePct,
      weights: {
        score: this.config.weightScore,
        price: this.config.weightPrice,
        similarity: this.config.weightSimilarity,
      },
    }).slice(0, limit);

    const byId = new Map(poolProducts.map((p) => [p.id, p]));

    return ranked.map((r) => {
      const product = byId.get(r.id)!;
      return {
        product: toProductResponseDto(product),
        compositeRank: r.compositeRank,
        scoreDelta: r.scoreDelta,
        priceDelta: r.priceDelta,
        similarity: r.similarity,
      };
    });
  }

  private toSubstitutionProduct(product: Product): SubstitutionProduct {
    return {
      id: product.id,
      categoryId: product.categoryId,
      price: product.price.toNumber(),
      finalScore: product.finalScoreCache?.toNumber() ?? 50,
      economicScore: product.economicScoreCache?.toNumber() ?? 50,
      envScore: product.envScoreCache?.toNumber() ?? 50,
      socialScore: product.socialScoreCache?.toNumber() ?? 50,
      carbonFootprintKg: product.carbonFootprintKg?.toNumber() ?? null,
    };
  }
}
