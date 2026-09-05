import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import type {
  ExternalProductData,
  ProductSourceClient,
} from './product-source.interface';

const REQUEST_TIMEOUT_MS = 5000;
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

interface UsdaFoodItem {
  fdcId: number;
  description?: string;
  brandOwner?: string;
  brandedFoodCategory?: string;
  gtinUpc?: string;
}

interface UsdaSearchResponse {
  foods?: UsdaFoodItem[];
}

/**
 * Only instantiated by ProductsModule when USDA_API_KEY is present — see
 * the module factory. USDA FoodData Central is nutrition-focused and does
 * not expose carbon/eco/packaging data, so those fields stay null; the
 * scoring engine already treats null sub-fields as explicit data gaps.
 */
@Injectable()
export class UsdaClient implements ProductSourceClient {
  readonly sourceName = 'USDA' as const;
  private readonly logger = new Logger(UsdaClient.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly apiKey: string,
  ) {}

  async findByBarcode(barcode: string): Promise<ExternalProductData | null> {
    try {
      const items = await this.search(barcode, 10);
      const match = items.find((i) => i.gtinUpc === barcode);
      return match ? this.mapFood(match) : null;
    } catch (error) {
      this.logger.warn(
        `USDA barcode lookup failed for ${barcode}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async searchByText(
    query: string,
    limit: number,
  ): Promise<ExternalProductData[]> {
    try {
      const items = await this.search(query, limit);
      return items.map((i) => this.mapFood(i));
    } catch (error) {
      this.logger.warn(
        `USDA text search failed for "${query}": ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async search(
    query: string,
    pageSize: number,
  ): Promise<UsdaFoodItem[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<UsdaSearchResponse>(
        `${USDA_BASE_URL}/foods/search`,
        {
          params: {
            api_key: this.apiKey,
            query,
            dataType: 'Branded',
            pageSize,
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
      ),
    );
    return data.foods ?? [];
  }

  private mapFood(item: UsdaFoodItem): ExternalProductData {
    return {
      barcode: item.gtinUpc ?? null,
      name: item.description ?? 'Unknown product',
      brand: item.brandOwner ?? null,
      categoryHint: item.brandedFoodCategory ?? null,
      carbonFootprintKg: null,
      ecoLabel: null,
      packagingScore: null,
      source: this.sourceName,
    };
  }
}
