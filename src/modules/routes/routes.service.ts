import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Store } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NominatimClient } from './integrations/nominatim.client';
import { optimizeRoute as runTsp } from './domain/tsp.engine';
import type { CreateStoreDto } from './dto/create-store.dto';
import type { OptimizeRouteDto } from './dto/optimize-route.dto';
import type { RouteResponseDto } from './dto/route-response.dto';
import type { StoreResponseDto } from './dto/store-response.dto';

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nominatim: NominatimClient,
  ) {}

  async createStore(dto: CreateStoreDto): Promise<StoreResponseDto> {
    let { lat, lng } = dto;

    if (lat === undefined || lng === undefined) {
      const geocoded = await this.nominatim.geocode(dto.address);
      if (!geocoded) {
        throw new BadRequestException(
          'Could not geocode the given address — provide lat/lng explicitly',
        );
      }
      lat = geocoded.lat;
      lng = geocoded.lng;
    }

    const store = await this.prisma.store.create({
      data: {
        name: dto.name,
        chain: dto.chain,
        address: dto.address,
        lat,
        lng,
      },
    });
    return this.toResponse(store);
  }

  async findAll(): Promise<StoreResponseDto[]> {
    const stores = await this.prisma.store.findMany({
      orderBy: { name: 'asc' },
    });
    return stores.map((s) => this.toResponse(s));
  }

  async optimize(dto: OptimizeRouteDto): Promise<RouteResponseDto> {
    const stores = await this.prisma.store.findMany({
      where: { id: { in: dto.storeIds } },
    });
    if (stores.length !== dto.storeIds.length) {
      throw new NotFoundException('One or more stores were not found');
    }

    const result = runTsp(
      { id: '__origin__', lat: dto.originLat, lng: dto.originLng },
      stores.map((s) => ({
        id: s.id,
        lat: s.lat.toNumber(),
        lng: s.lng.toNumber(),
      })),
    );

    const byId = new Map(stores.map((s) => [s.id, s]));
    return {
      orderedStores: result.orderedIds.map((id) =>
        this.toResponse(byId.get(id)!),
      ),
      totalDistanceKm: result.totalDistanceKm,
    };
  }

  private toResponse(store: Store): StoreResponseDto {
    return {
      id: store.id,
      name: store.name,
      chain: store.chain,
      address: store.address,
      lat: store.lat.toNumber(),
      lng: store.lng.toNumber(),
    };
  }
}
