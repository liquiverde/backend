import { ApiProperty } from '@nestjs/swagger';

export class RewardEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  points!: number;

  @ApiProperty({ enum: ['HIGH_SCORE_ITEM_INCLUDED', 'SUBSTITUTION_ACCEPTED'] })
  reason!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class RewardsSummaryResponseDto {
  @ApiProperty()
  totalPoints!: number;

  @ApiProperty()
  eventCount!: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  pointsByReason!: Record<string, number>;
}
