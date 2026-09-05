import type { Product } from '@prisma/client';
import type { ProductResponseDto } from '../../modules/products/dto/product-response.dto';

export function toProductResponseDto(
  product: Product,
  degraded = false,
): ProductResponseDto {
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    categoryId: product.categoryId,
    price: product.price.toNumber(),
    priceIsEstimated: product.priceIsEstimated,
    currency: product.currency,
    carbonFootprintKg: product.carbonFootprintKg?.toNumber() ?? null,
    ecoLabel: product.ecoLabel,
    finalScore: product.finalScoreCache?.toNumber() ?? 50,
    dataConfidence: product.dataConfidence,
    source: product.source,
    degraded,
  };
}
