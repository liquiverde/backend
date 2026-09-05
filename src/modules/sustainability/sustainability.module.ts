import { Module } from '@nestjs/common';
import { CategoryPricingModule } from '../category-pricing/category-pricing.module';
import { SustainabilityController } from './sustainability.controller';
import { SustainabilityService } from './sustainability.service';

@Module({
  imports: [CategoryPricingModule],
  controllers: [SustainabilityController],
  providers: [SustainabilityService],
  exports: [SustainabilityService],
})
export class SustainabilityModule {}
