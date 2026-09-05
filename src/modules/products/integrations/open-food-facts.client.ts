import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { ExternalApisConfig } from '../../../config/configuration';
import type {
  ExternalProductData,
  ProductSourceClient,
} from './product-source.interface';

const REQUEST_TIMEOUT_MS = 5000;

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  ecoscore_grade?: string;
  ecoscore_data?: {
    agribalyse?: { co2_total?: number };
  };
  packaging?: string;
}

interface OffProductByBarcodeResponse {
  status: number;
  product?: OffProduct;
}

interface OffSearchResponse {
  products?: OffProduct[];
}

@Injectable()
export class OpenFoodFactsClient implements ProductSourceClient {
  readonly sourceName = 'OPENFOODFACTS' as const;
  private readonly logger = new Logger(OpenFoodFactsClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.baseUrl =
      configService.get<ExternalApisConfig>(
        'externalApis',
      )!.openFoodFactsBaseUrl;
  }

  async findByBarcode(barcode: string): Promise<ExternalProductData | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<OffProductByBarcodeResponse>(
          `${this.baseUrl}/api/v2/product/${barcode}.json`,
          { timeout: REQUEST_TIMEOUT_MS },
        ),
      );
      if (data.status !== 1 || !data.product) {
        return null;
      }
      return this.mapProduct(data.product);
    } catch (error) {
      this.logger.warn(
        `Open Food Facts barcode lookup failed for ${barcode}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async searchByText(
    query: string,
    limit: number,
  ): Promise<ExternalProductData[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<OffSearchResponse>(
          `${this.baseUrl}/cgi/search.pl`,
          {
            params: {
              search_terms: query,
              json: 1,
              page_size: limit,
            },
            timeout: REQUEST_TIMEOUT_MS,
          },
        ),
      );
      const products: OffProduct[] = data.products ?? [];
      return products
        .map((p) => this.mapProduct(p))
        .filter((p): p is ExternalProductData => p !== null);
    } catch (error) {
      this.logger.warn(
        `Open Food Facts text search failed for "${query}": ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private mapProduct(product: OffProduct): ExternalProductData | null {
    const name = product.product_name?.trim();
    if (!name) return null;

    const carbonFootprintKg =
      product.ecoscore_data?.agribalyse?.co2_total ?? null;
    const ecoLabel = product.ecoscore_grade
      ? `Eco-Score ${product.ecoscore_grade.toUpperCase()}`
      : null;
    const categoryHint = product.categories?.split(',')[0]?.trim() ?? null;
    const packagingScore = this.estimatePackagingScore(product.packaging);

    return {
      barcode: product.code ?? null,
      name,
      brand: product.brands?.split(',')[0]?.trim() ?? null,
      categoryHint,
      carbonFootprintKg,
      ecoLabel,
      packagingScore,
      source: this.sourceName,
    };
  }

  /** Very coarse heuristic: fewer/simpler packaging materials score higher. Returns null when packaging is undocumented. */
  private estimatePackagingScore(packaging?: string): number | null {
    if (!packaging) return null;
    const materials = packaging
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (materials.length === 0) return null;
    return Math.max(20, 100 - (materials.length - 1) * 20);
  }
}
