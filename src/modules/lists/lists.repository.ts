import { Injectable } from '@nestjs/common';
import { Prisma, ShoppingListStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LIST_WITH_ITEMS_AND_PRODUCTS = {
  items: { include: { product: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ShoppingListInclude;

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, budgetMax: number, plannedDate?: string) {
    return this.prisma.shoppingList.create({
      data: {
        userId,
        budgetMax,
        plannedDate: plannedDate ? new Date(plannedDate) : undefined,
      },
      include: LIST_WITH_ITEMS_AND_PRODUCTS,
    });
  }

  findById(id: string) {
    return this.prisma.shoppingList.findUnique({
      where: { id },
      include: LIST_WITH_ITEMS_AND_PRODUCTS,
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.shoppingList.findMany({
      where: { userId },
      include: LIST_WITH_ITEMS_AND_PRODUCTS,
      orderBy: { createdAt: 'desc' },
    });
  }

  update(
    id: string,
    data: {
      budgetMax?: number;
      plannedDate?: string;
      status?: ShoppingListStatus;
    },
  ) {
    return this.prisma.shoppingList.update({
      where: { id },
      data: {
        ...(data.budgetMax !== undefined && { budgetMax: data.budgetMax }),
        ...(data.plannedDate !== undefined && {
          plannedDate: new Date(data.plannedDate),
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: LIST_WITH_ITEMS_AND_PRODUCTS,
    });
  }

  delete(id: string) {
    return this.prisma.shoppingList.delete({ where: { id } });
  }

  addItem(
    listId: string,
    productId: string,
    quantity: number,
    unitPrice: number,
    priority: number,
  ) {
    return this.prisma.listItem.create({
      data: { listId, productId, quantity, unitPrice, priority },
    });
  }

  removeItem(listId: string, itemId: string) {
    return this.prisma.listItem.deleteMany({ where: { id: itemId, listId } });
  }

  findItem(listId: string, itemId: string) {
    return this.prisma.listItem.findFirst({
      where: { id: itemId, listId },
      include: { product: true },
    });
  }

  /**
   * Persists an optimization run: flags selected items, unflags the rest,
   * and stores the list-level saving/impact totals — all in one
   * transaction so a partial write never leaves the list inconsistent.
   */
  async applyOptimization(
    listId: string,
    selectedItemIds: string[],
    totals: { totalEstSaving: number; totalImpactScore: number },
  ) {
    const selectedSet = new Set(selectedItemIds);
    const items = await this.prisma.listItem.findMany({ where: { listId } });

    await this.prisma.$transaction([
      ...items.map((item) =>
        this.prisma.listItem.update({
          where: { id: item.id },
          data: { includedInOptimum: selectedSet.has(item.id) },
        }),
      ),
      this.prisma.shoppingList.update({
        where: { id: listId },
        data: {
          status: ShoppingListStatus.OPTIMIZED,
          totalEstSaving: totals.totalEstSaving,
          totalImpactScore: totals.totalImpactScore,
        },
      }),
    ]);

    return this.findById(listId);
  }

  /** Records a substitution: a new ListItem tracing back to the original, which is unflagged (not deleted — preserves history for RF-11). */
  async substituteItem(
    originalItemId: string,
    listId: string,
    newProductId: string,
  ) {
    const original = await this.prisma.listItem.findFirstOrThrow({
      where: { id: originalItemId, listId },
      include: { product: true },
    });
    const newProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: newProductId },
    });

    const [, newItem] = await this.prisma.$transaction([
      this.prisma.listItem.update({
        where: { id: originalItemId },
        data: { includedInOptimum: false },
      }),
      this.prisma.listItem.create({
        data: {
          listId,
          productId: newProductId,
          quantity: original.quantity,
          unitPrice: newProduct.price,
          priority: original.priority,
          substitutedFromId: originalItemId,
        },
      }),
    ]);

    return newItem;
  }
}
