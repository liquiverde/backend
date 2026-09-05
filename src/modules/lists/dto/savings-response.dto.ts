import { ApiProperty } from '@nestjs/swagger';

class SavingsLineDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  saving!: number;
}

export class SavingsResponseDto {
  @ApiProperty()
  totalEstSaving!: number;

  @ApiProperty({ type: [SavingsLineDto] })
  lines!: SavingsLineDto[];
}
