import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductResponseDto } from '../../products/dto/product-response.dto';

export class ListItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiPropertyOptional({ type: ProductResponseDto })
  product?: ProductResponseDto;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty()
  priority!: number;

  @ApiProperty()
  includedInOptimum!: boolean;

  @ApiPropertyOptional()
  substitutedFromId?: string | null;
}
