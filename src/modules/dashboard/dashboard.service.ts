import { Injectable, NotFoundException } from '@nestjs/common';
import { ShoppingListStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** RF-07: aggregated savings/impact history for the "hub" screen. */
  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    const [user, optimizedLists, substitutionsAcceptedCount] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.shoppingList.findMany({
          where: {
            userId,
            status: {
              in: [ShoppingListStatus.OPTIMIZED, ShoppingListStatus.COMPLETED],
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.listItem.count({
          where: { substitutedFromId: { not: null }, list: { userId } },
        }),
      ]);

    if (!user) throw new NotFoundException('User not found');

    const savingsTrend = optimizedLists.map((l) => ({
      listId: l.id,
      createdAt: l.createdAt,
      totalEstSaving: l.totalEstSaving?.toNumber() ?? 0,
      totalImpactScore: l.totalImpactScore?.toNumber() ?? 0,
    }));

    const totalEstSavingAccumulated = savingsTrend.reduce(
      (sum, p) => sum + p.totalEstSaving,
      0,
    );
    const avgImpactScore =
      savingsTrend.length === 0
        ? 0
        : savingsTrend.reduce((sum, p) => sum + p.totalImpactScore, 0) /
          savingsTrend.length;

    return {
      totalEstSavingAccumulated,
      avgImpactScore,
      optimizedListsCount: optimizedLists.length,
      substitutionsAcceptedCount,
      rewardPoints: user.rewardPoints,
      savingsTrend,
    };
  }
}
