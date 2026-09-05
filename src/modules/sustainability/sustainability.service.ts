import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryPricingService } from '../category-pricing/category-pricing.service';
import { calculateSustainabilityScore } from './domain/scoring.engine';
import type { ScoringConfig } from '../../config/configuration';
import type { SustainabilityResponseDto } from './dto/sustainability-response.dto';

@Injectable()
export class SustainabilityService {
  private readonly weights: ScoringConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryPricing: CategoryPricingService,
    private readonly configService: ConfigService,
  ) {
    this.weights = this.configService.get<ScoringConfig>('scoring')!;
  }

  /**
   * Recomputes and persists a product's score: inserts a historical row
   * (feeds RF-07 trends/audit) and refreshes the denormalized cache on
   * Product (read by the knapsack hot path, RNF-01) in one transaction so
   * they never diverge.
   */
  async recalculate(productId: string): Promise<SustainabilityResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const pricing = await this.categoryPricing.getCategoryPricing(
      product.categoryId,
    );

    const result = calculateSustainabilityScore({
      price: product.price.toNumber(),
      categoryAvgPrice: pricing.avgPrice,
      carbonFootprintKg: product.carbonFootprintKg?.toNumber() ?? null,
      categoryAvgCarbon: pricing.avgCarbonFootprintKg,
      packagingScore: product.packagingScore?.toNumber() ?? null,
      originDistanceKm: product.originDistanceKm?.toNumber() ?? null,
      socialCertifications: product.socialCertifications,
      weights: {
        economic: this.weights.weightEconomic,
        env: this.weights.weightEnv,
        social: this.weights.weightSocial,
      },
    });

    const calculatedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.sustainabilityScore.create({
        data: {
          productId,
          economicScore: result.economicScore,
          envScore: result.envScore,
          socialScore: result.socialScore,
          finalScore: result.finalScore,
          dataConfidence: result.dataConfidence,
          missingFields: result.missingFields,
          calculatedAt,
        },
      }),
      this.prisma.product.update({
        where: { id: productId },
        data: {
          economicScoreCache: result.economicScore,
          envScoreCache: result.envScore,
          socialScoreCache: result.socialScore,
          finalScoreCache: result.finalScore,
          dataConfidence: result.dataConfidence,
          scoreCalculatedAt: calculatedAt,
        },
      }),
    ]);

    return {
      productId,
      ...result,
      calculatedAt,
    };
  }

  async getCurrent(productId: string): Promise<SustainabilityResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.scoreCalculatedAt === null) {
      return this.recalculate(productId);
    }

    // The cache on Product doesn't carry `missingFields` (kept lean for the
    // knapsack hot path) — pull it from the latest historical row instead.
    const latest = await this.prisma.sustainabilityScore.findFirst({
      where: { productId },
      orderBy: { calculatedAt: 'desc' },
    });

    return {
      productId,
      economicScore: product.economicScoreCache?.toNumber() ?? 50,
      envScore: product.envScoreCache?.toNumber() ?? 50,
      socialScore: product.socialScoreCache?.toNumber() ?? 50,
      finalScore: product.finalScoreCache?.toNumber() ?? 50,
      dataConfidence: product.dataConfidence,
      missingFields: latest?.missingFields ?? [],
      calculatedAt: product.scoreCalculatedAt,
    };
  }

  async getHistory(productId: string): Promise<SustainabilityResponseDto[]> {
    const scores = await this.prisma.sustainabilityScore.findMany({
      where: { productId },
      orderBy: { calculatedAt: 'desc' },
    });
    return scores.map((s) => ({
      productId,
      economicScore: s.economicScore.toNumber(),
      envScore: s.envScore.toNumber(),
      socialScore: s.socialScore.toNumber(),
      finalScore: s.finalScore.toNumber(),
      dataConfidence: s.dataConfidence,
      missingFields: s.missingFields,
      calculatedAt: s.calculatedAt,
    }));
  }
}
