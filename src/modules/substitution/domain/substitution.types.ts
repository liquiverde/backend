export interface SubstitutionProduct {
  id: string;
  categoryId: string;
  price: number;
  finalScore: number;
  economicScore: number;
  envScore: number;
  socialScore: number;
  carbonFootprintKg: number | null;
}

export interface SubstitutionWeights {
  score: number;
  price: number;
  similarity: number;
}

export interface SubstitutionParams {
  maxPriceIncreasePct: number;
  weights: SubstitutionWeights;
}

export interface RankedSubstitute {
  id: string;
  compositeRank: number;
  scoreDelta: number;
  priceDelta: number;
  similarity: number;
}
