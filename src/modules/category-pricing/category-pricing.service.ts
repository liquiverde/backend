import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface CategoryPricing {
  avgPrice: number | null;
  avgCarbonFootprintKg: number | null;
}

const CACHE_TTL_SECONDS = 10 * 60;

/**
 * Category-wide averages (price, carbon footprint) used by the scoring
 * engine (RF-03), the knapsack's relative-saving term (RF-04) and the
 * savings calculator (RF-05). Cached in Redis — recomputing on every read
 * would mean an aggregate query per candidate on the knapsack hot path.
 */
@Injectable()
export class CategoryPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getCategoryPricing(categoryId: string): Promise<CategoryPricing> {
    const cacheKey = `category:avgPrice:${categoryId}`;
    const cached = await this.redis.getJson<CategoryPricing>(cacheKey);
    if (cached) return cached;

    const result = await this.prisma.product.aggregate({
      where: { categoryId },
      _avg: { price: true, carbonFootprintKg: true },
    });

    const pricing: CategoryPricing = {
      avgPrice: result._avg.price?.toNumber() ?? null,
      avgCarbonFootprintKg: result._avg.carbonFootprintKg?.toNumber() ?? null,
    };

    await this.redis.setJson(cacheKey, pricing, CACHE_TTL_SECONDS);
    return pricing;
  }

  async invalidate(categoryId: string): Promise<void> {
    await this.redis.del(`category:avgPrice:${categoryId}`);
  }
}
