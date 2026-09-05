import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'CANCELLED'])
  status?: 'DRAFT' | 'CANCELLED';
}
