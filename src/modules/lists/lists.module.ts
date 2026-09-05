import { Module } from '@nestjs/common';
import { CategoryPricingModule } from '../category-pricing/category-pricing.module';
import { ProductsModule } from '../products/products.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ListsController } from './lists.controller';
import { ListsRepository } from './lists.repository';
import { ListsService } from './lists.service';

@Module({
  imports: [CategoryPricingModule, ProductsModule, RewardsModule],
  controllers: [ListsController],
  providers: [ListsService, ListsRepository],
  exports: [ListsService, ListsRepository],
})
export class ListsModule {}
