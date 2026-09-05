import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  barcode?: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  brand?: string | null;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  priceIsEstimated!: boolean;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  carbonFootprintKg?: number | null;

  @ApiPropertyOptional()
  ecoLabel?: string | null;

  @ApiProperty()
  finalScore!: number;

  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'] })
  dataConfidence!: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty()
  source!: string;

  @ApiPropertyOptional({
    description:
      'True when this search fell back to the local catalog because an external source was unreachable (RNF-02)',
  })
  degraded?: boolean;
}
