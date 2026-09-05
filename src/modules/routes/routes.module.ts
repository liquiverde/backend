import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { NominatimClient } from './integrations/nominatim.client';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [HttpModule],
  controllers: [RoutesController],
  providers: [RoutesService, NominatimClient],
})
export class RoutesModule {}
