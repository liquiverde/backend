import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CategoryResponseDto } from './dto/category-response.dto';

/** Name of the seeded catch-all root category used when an external
 *  product's category can't be matched to anything local. */
export const FALLBACK_CATEGORY_NAME = 'Otros';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
    }));
  }

  /**
   * Best-effort match of a free-text external category label (e.g. an Open
   * Food Facts category tag) against local categories; falls back to the
   * seeded "Otros" catch-all so external products always land somewhere.
   */
  async resolveByHintOrFallback(hint: string | null): Promise<string> {
    if (hint) {
      const normalized = hint.trim();
      const exact = await this.prisma.category.findFirst({
        where: { name: { equals: normalized, mode: 'insensitive' } },
      });
      if (exact) return exact.id;

      const firstWord = normalized.split(/[\s,:-]+/)[0];
      if (firstWord.length >= 3) {
        const loose = await this.prisma.category.findFirst({
          where: { name: { contains: firstWord, mode: 'insensitive' } },
        });
        if (loose) return loose.id;
      }
    }

    const fallback = await this.prisma.category.findFirst({
      where: { name: FALLBACK_CATEGORY_NAME, parentId: null },
    });
    if (!fallback) {
      throw new InternalServerErrorException(
        `Fallback category "${FALLBACK_CATEGORY_NAME}" is missing — the seed must create it`,
      );
    }
    return fallback.id;
  }
}
