import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AddItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ default: 1, minimum: 0.001 })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity? = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    default: 3,
    description:
      'Design decision: the "utility" term in the knapsack value function ' +
      'is derived from this 1-5 priority (default 3 = every candidate is ' +
      'equally desirable), normalized to 0-100.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority? = 3;
}
