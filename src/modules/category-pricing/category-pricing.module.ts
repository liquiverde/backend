import { Module } from '@nestjs/common';
import { CategoryPricingService } from './category-pricing.service';

@Module({
  providers: [CategoryPricingService],
  exports: [CategoryPricingService],
})
export class CategoryPricingModule {}
