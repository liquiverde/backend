import { ApiProperty } from '@nestjs/swagger';
import { ProductResponseDto } from '../../products/dto/product-response.dto';

export class SubstitutionResponseDto {
  @ApiProperty({ type: ProductResponseDto })
  product!: ProductResponseDto;

  @ApiProperty()
  compositeRank!: number;

  @ApiProperty()
  scoreDelta!: number;

  @ApiProperty()
  priceDelta!: number;

  @ApiProperty()
  similarity!: number;
}
