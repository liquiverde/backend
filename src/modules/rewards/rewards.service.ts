import { Injectable, Logger } from '@nestjs/common';
import { RewardReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calculateOptimizedItemPoints,
  calculateSubstitutionPoints,
} from './domain/rewards.calculator';
import type {
  RewardEventResponseDto,
  RewardsSummaryResponseDto,
} from './dto/reward-event-response.dto';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Called by ListsService after a successful optimize() for each selected item. */
  async awardForOptimizedItem(
    userId: string,
    listItemId: string,
    finalScore: number,
  ): Promise<void> {
    const points = calculateOptimizedItemPoints(finalScore);
    if (points <= 0) return;
    await this.award(
      userId,
      listItemId,
      points,
      RewardReason.HIGH_SCORE_ITEM_INCLUDED,
    );
  }

  /** Called by ListsService after ListsRepository.substituteItem() persists the new item. */
  async awardForSubstitution(
    userId: string,
    newListItemId: string,
    originalFinalScore: number,
    newFinalScore: number,
  ): Promise<void> {
    const points = calculateSubstitutionPoints(
      originalFinalScore,
      newFinalScore,
    );
    if (points <= 0) return;
    await this.award(
      userId,
      newListItemId,
      points,
      RewardReason.SUBSTITUTION_ACCEPTED,
    );
  }

  async getHistory(userId: string): Promise<RewardEventResponseDto[]> {
    const events = await this.prisma.rewardEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return events.map((e) => ({
      id: e.id,
      points: e.points,
      reason: e.reason,
      createdAt: e.createdAt,
    }));
  }

  async getSummary(userId: string): Promise<RewardsSummaryResponseDto> {
    const events = await this.prisma.rewardEvent.findMany({
      where: { userId },
    });
    const pointsByReason: Record<string, number> = {};
    for (const event of events) {
      pointsByReason[event.reason] =
        (pointsByReason[event.reason] ?? 0) + event.points;
    }
    return {
      totalPoints: events.reduce((sum, e) => sum + e.points, 0),
      eventCount: events.length,
      pointsByReason,
    };
  }

  private async award(
    userId: string,
    sourceListItemId: string,
    points: number,
    reason: RewardReason,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.rewardEvent.create({
        data: { userId, sourceListItemId, points, reason },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { rewardPoints: { increment: points } },
      }),
    ]);
    this.logger.log(`Awarded ${points} points to user ${userId} (${reason})`);
  }
}
