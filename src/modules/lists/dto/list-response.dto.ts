import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListItemResponseDto } from './list-item-response.dto';

export class ListResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  budgetMax!: number;

  @ApiProperty({ enum: ['DRAFT', 'OPTIMIZED', 'COMPLETED', 'CANCELLED'] })
  status!: string;

  @ApiPropertyOptional()
  totalEstSaving?: number | null;

  @ApiPropertyOptional()
  totalImpactScore?: number | null;

  @ApiPropertyOptional()
  plannedDate?: Date | null;

  @ApiProperty({ type: [ListItemResponseDto] })
  items!: ListItemResponseDto[];

  @ApiProperty()
  createdAt!: Date;
}
