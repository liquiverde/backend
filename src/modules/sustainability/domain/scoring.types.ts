export type DataConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScoringWeights {
  economic: number;
  env: number;
  social: number;
}

export interface ScoringInput {
  price: number;
  /** Average price across other products in the same category. Null if unknown (e.g. only product in category). */
  categoryAvgPrice: number | null;

  carbonFootprintKg: number | null;
  /** Average carbon footprint across other products in the same category. */
  categoryAvgCarbon: number | null;
  /** Pre-computed packaging sub-score, already on a 0-100 scale. */
  packagingScore: number | null;
  originDistanceKm: number | null;

  /**
   * null = unknown whether the product has certifications (data gap).
   * [] = known to have none (not a data gap, but not neutral either).
   */
  socialCertifications: string[] | null;

  weights: ScoringWeights;
}

export interface ScoringResult {
  economicScore: number;
  envScore: number;
  socialScore: number;
  finalScore: number;
  missingFields: string[];
  dataConfidence: DataConfidenceLevel;
}
