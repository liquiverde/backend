import { ApiProperty } from '@nestjs/swagger';

export class SustainabilityResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  economicScore!: number;

  @ApiProperty()
  envScore!: number;

  @ApiProperty()
  socialScore!: number;

  @ApiProperty()
  finalScore!: number;

  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'] })
  dataConfidence!: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ type: [String] })
  missingFields!: string[];

  @ApiProperty()
  calculatedAt!: Date;
}
