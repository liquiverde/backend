import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StoreResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  chain?: string | null;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  lat!: number;

  @ApiProperty()
  lng!: number;
}
