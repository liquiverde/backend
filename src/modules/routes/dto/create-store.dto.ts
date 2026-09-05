import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chain?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  address!: string;

  @ApiPropertyOptional({
    description: 'Optional — if omitted, the address is geocoded via Nominatim',
  })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
