import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from './product-response.dto';

export class ProductSearchResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({
    description:
      'True when an external source failed and results may be incomplete (RNF-02)',
  })
  degraded!: boolean;
}
