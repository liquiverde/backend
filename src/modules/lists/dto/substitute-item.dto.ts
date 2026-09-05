import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SubstituteItemDto {
  @ApiProperty({
    description:
      'Product id of the chosen substitute (from GET /substitution/:productId)',
  })
  @IsUUID()
  substituteProductId!: string;
}
