import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { SubstitutionController } from './substitution.controller';
import { SubstitutionService } from './substitution.service';

@Module({
  imports: [ProductsModule],
  controllers: [SubstitutionController],
  providers: [SubstitutionService],
  exports: [SubstitutionService],
})
export class SubstitutionModule {}
