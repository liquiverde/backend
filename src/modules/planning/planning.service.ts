import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { estimateRepurchase } from './domain/frequency.estimator';
import type { RepurchaseSuggestionResponseDto } from './dto/repurchase-suggestion-response.dto';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async getRepurchaseSuggestions(
    userId: string,
  ): Promise<RepurchaseSuggestionResponseDto[]> {
    const items = await this.prisma.listItem.findMany({
      where: { includedInOptimum: true, list: { userId } },
      select: {
        productId: true,
        createdAt: true,
        product: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byProduct = new Map<string, { name: string; dates: Date[] }>();
    for (const item of items) {
      const entry = byProduct.get(item.productId);
      if (entry) {
        entry.dates.push(item.createdAt);
      } else {
        byProduct.set(item.productId, {
          name: item.product.name,
          dates: [item.createdAt],
        });
      }
    }

    const now = new Date();
    const suggestions: RepurchaseSuggestionResponseDto[] = [];
    for (const [productId, { name, dates }] of byProduct) {
      const estimate = estimateRepurchase(
        { productId, purchaseDates: dates },
        now,
      );
      if (estimate) {
        suggestions.push({ ...estimate, productName: name });
      }
    }

    return suggestions.sort(
      (a, b) =>
        a.suggestedNextPurchaseDate.getTime() -
        b.suggestedNextPurchaseDate.getTime(),
    );
  }
}
