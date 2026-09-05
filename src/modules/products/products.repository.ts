import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExternalProductData } from './integrations/product-source.interface';

export interface UpsertExternalProductParams {
  data: ExternalProductData;
  categoryId: string;
  price: number;
  priceIsEstimated: boolean;
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByBarcode(barcode: string) {
    return this.prisma.product.findUnique({ where: { barcode } });
  }

  findById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  findByIds(ids: string[]) {
    return this.prisma.product.findMany({ where: { id: { in: ids } } });
  }

  async searchLocal(params: {
    q?: string;
    categoryId?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.ProductWhereInput = {
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.q && {
        OR: [
          { name: { contains: params.q, mode: 'insensitive' } },
          { brand: { contains: params.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  /** Top candidates by score across a set of categories — used by the substitution engine's pool query. */
  findTopByCategories(categoryIds: string[], take: number) {
    return this.prisma.product.findMany({
      where: { categoryId: { in: categoryIds } },
      orderBy: { finalScoreCache: 'desc' },
      take,
    });
  }

  async upsertFromExternal(params: UpsertExternalProductParams) {
    const { data, categoryId, price, priceIsEstimated } = params;
    if (!data.barcode) {
      // No barcode to upsert on — create a standalone row (text-search hit).
      return this.prisma.product.create({
        data: {
          barcode: null,
          name: data.name,
          brand: data.brand,
          categoryId,
          price,
          priceIsEstimated,
          carbonFootprintKg: data.carbonFootprintKg,
          ecoLabel: data.ecoLabel,
          packagingScore: data.packagingScore,
          source: data.source,
        },
      });
    }

    return this.prisma.product.upsert({
      where: { barcode: data.barcode },
      create: {
        barcode: data.barcode,
        name: data.name,
        brand: data.brand,
        categoryId,
        price,
        priceIsEstimated,
        carbonFootprintKg: data.carbonFootprintKg,
        ecoLabel: data.ecoLabel,
        packagingScore: data.packagingScore,
        source: data.source,
      },
      update: {
        name: data.name,
        brand: data.brand,
        carbonFootprintKg: data.carbonFootprintKg ?? undefined,
        ecoLabel: data.ecoLabel ?? undefined,
        packagingScore: data.packagingScore ?? undefined,
      },
    });
  }
}
