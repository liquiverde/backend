import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ParseBarcodePipe } from './pipes/parse-barcode.pipe';
import { CompareProductsDto } from './dto/compare-products.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductSearchResponseDto } from './dto/product-search-response.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Free-text product search (RF-02)' })
  search(@Query() dto: SearchProductDto): Promise<ProductSearchResponseDto> {
    return this.productsService.search(dto);
  }

  @Public()
  @Get('compare')
  @ApiOperation({ summary: 'Compare 2-5 products side by side (RF-08, bonus)' })
  compare(@Query() dto: CompareProductsDto): Promise<ProductResponseDto[]> {
    return this.productsService.compare(dto.ids);
  }

  @Public()
  @Get('barcode/:code')
  @ApiParam({ name: 'code', example: '7801234567890' })
  @ApiOperation({ summary: 'Barcode lookup (RF-01)' })
  findByBarcode(
    @Param('code', ParseBarcodePipe) code: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.searchByBarcode(code);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Product detail' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.findById(id);
  }
}
