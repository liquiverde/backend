import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateListDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0)
  budgetMax!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedDate?: string;
}
