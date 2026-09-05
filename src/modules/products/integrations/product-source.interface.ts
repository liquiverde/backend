export type ExternalProductSource = 'OPENFOODFACTS' | 'USDA';

export interface ExternalProductData {
  barcode: string | null;
  name: string;
  brand: string | null;
  /** Best-effort free-text category name from the external source; mapped to a local Category with fuzzy matching. */
  categoryHint: string | null;
  carbonFootprintKg: number | null;
  ecoLabel: string | null;
  /** Heuristic 0-100 packaging sub-score derived from source data, when available. */
  packagingScore: number | null;
  source: ExternalProductSource;
}

export interface ProductSourceClient {
  readonly sourceName: ExternalProductSource;
  findByBarcode(barcode: string): Promise<ExternalProductData | null>;
  searchByText(query: string, limit: number): Promise<ExternalProductData[]>;
}

export const PRODUCT_SOURCE_CLIENTS = Symbol('PRODUCT_SOURCE_CLIENTS');
