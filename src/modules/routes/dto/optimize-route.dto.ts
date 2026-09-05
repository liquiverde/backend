import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsLatitude, IsLongitude, IsUUID } from 'class-validator';

export class OptimizeRouteDto {
  @ApiProperty({
    description: "Starting point — typically the user's current location",
  })
  @IsLatitude()
  originLat!: number;

  @ApiProperty()
  @IsLongitude()
  originLng!: number;

  @ApiProperty({ type: [String], description: 'Store ids to visit (RF-09)' })
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  storeIds!: string[];
}
