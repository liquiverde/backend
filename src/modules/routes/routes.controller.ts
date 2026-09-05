import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateStoreDto } from './dto/create-store.dto';
import { OptimizeRouteDto } from './dto/optimize-route.dto';
import { RouteResponseDto } from './dto/route-response.dto';
import { StoreResponseDto } from './dto/store-response.dto';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Public()
  @Get('stores')
  @ApiOperation({ summary: 'List known stores' })
  findAllStores(): Promise<StoreResponseDto[]> {
    return this.routesService.findAll();
  }

  @ApiBearerAuth()
  @Post('stores')
  @ApiOperation({
    summary:
      'Register a new store, geocoding its address via Nominatim if lat/lng are omitted',
  })
  createStore(@Body() dto: CreateStoreDto): Promise<StoreResponseDto> {
    return this.routesService.createStore(dto);
  }

  @ApiBearerAuth()
  @Post('routes/optimize')
  @ApiOperation({
    summary:
      'Efficient route across the given stores (RF-09, bonus, TSP approximation)',
  })
  optimize(@Body() dto: OptimizeRouteDto): Promise<RouteResponseDto> {
    return this.routesService.optimize(dto);
  }
}
