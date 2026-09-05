import { ApiProperty } from '@nestjs/swagger';

class SavingsTrendPointDto {
  @ApiProperty()
  listId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  totalEstSaving!: number;

  @ApiProperty()
  totalImpactScore!: number;
}

export class DashboardResponseDto {
  @ApiProperty()
  totalEstSavingAccumulated!: number;

  @ApiProperty()
  avgImpactScore!: number;

  @ApiProperty()
  optimizedListsCount!: number;

  @ApiProperty()
  substitutionsAcceptedCount!: number;

  @ApiProperty()
  rewardPoints!: number;

  @ApiProperty({ type: [SavingsTrendPointDto] })
  savingsTrend!: SavingsTrendPointDto[];
}
