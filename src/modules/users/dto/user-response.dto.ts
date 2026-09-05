import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  budgetDefault?: number;

  @ApiProperty()
  rewardPoints!: number;

  @ApiProperty()
  createdAt!: Date;
}
