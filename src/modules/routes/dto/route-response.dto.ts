import { ApiProperty } from '@nestjs/swagger';
import { StoreResponseDto } from './store-response.dto';

export class RouteResponseDto {
  @ApiProperty({
    type: [StoreResponseDto],
    description: 'Stores in visiting order',
  })
  orderedStores!: StoreResponseDto[];

  @ApiProperty()
  totalDistanceKm!: number;
}
