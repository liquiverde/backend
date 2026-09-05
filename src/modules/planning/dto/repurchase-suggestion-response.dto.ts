import { ApiProperty } from '@nestjs/swagger';

export class RepurchaseSuggestionResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  avgIntervalDays!: number;

  @ApiProperty()
  lastPurchaseDate!: Date;

  @ApiProperty()
  suggestedNextPurchaseDate!: Date;

  @ApiProperty()
  isDueSoon!: boolean;
}
