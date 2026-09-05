import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CategoriesModule } from '../categories/categories.module';
import { CategoryPricingModule } from '../category-pricing/category-pricing.module';
import { SustainabilityModule } from '../sustainability/sustainability.module';
import { OpenFoodFactsClient } from './integrations/open-food-facts.client';
import { UsdaClient } from './integrations/usda.client';
import {
  PRODUCT_SOURCE_CLIENTS,
  type ProductSourceClient,
} from './integrations/product-source.interface';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';
import type { ExternalApisConfig } from '../../config/configuration';

@Module({
  imports: [
    HttpModule,
    CategoriesModule,
    CategoryPricingModule,
    SustainabilityModule,
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductsRepository,
    OpenFoodFactsClient,
    {
      // USDA only participates when USDA_API_KEY is configured — no key
      // means the client is never instantiated, not a swallowed error.
      provide: PRODUCT_SOURCE_CLIENTS,
      inject: [OpenFoodFactsClient, HttpService, ConfigService],
      useFactory: (
        offClient: OpenFoodFactsClient,
        httpService: HttpService,
        configService: ConfigService,
      ): ProductSourceClient[] => {
        const clients: ProductSourceClient[] = [offClient];
        const { usdaApiKey } =
          configService.get<ExternalApisConfig>('externalApis')!;
        if (usdaApiKey) {
          clients.push(new UsdaClient(httpService, usdaApiKey));
        }
        return clients;
      },
    },
  ],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
