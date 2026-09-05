export interface KnapsackCandidate {
  id: string;
  priceCents: number;
  /** 0-100, user-declared desirability (defaults to 100 — see ListsService). */
  utility: number;
  /** 0-100, the product's finalScore. */
  sustainabilityScore: number;
  /** 0-100, price advantage vs. the category average. */
  relativeSaving: number;
}

export interface KnapsackWeights {
  utility: number;
  sustainability: number;
  saving: number;
}

export interface KnapsackParams {
  budgetCents: number;
  weights: KnapsackWeights;
  discretizationStepCents: number;
  maxStepCents: number;
  maxDpCells: number;
  maxItemsDp: number;
}

export interface KnapsackResult {
  selectedIds: string[];
  totalValue: number;
  totalCostCents: number;
  usedFallback: boolean;
}
