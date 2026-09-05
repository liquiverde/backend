import type {
  KnapsackCandidate,
  KnapsackParams,
  KnapsackResult,
} from './knapsack.types';

/**
 * Pure multi-objective 0/1 knapsack engine (RF-04, doc §8.1). No @nestjs/*
 * or @prisma/client imports — receives plain numbers (prices already
 * converted to integer cents by ListsService) so it's testable without
 * infrastructure and fast enough to hit RNF-01 (<2s, up to 500 items).
 *
 * valor(i) = w1*utilidad(i) + w2*sostenibilidad(i) + w3*ahorroRelativo(i)
 *
 * Budget is discretized into cells of `discretizationStepCents`; the step
 * doubles (up to `maxStepCents`) until the DP table fits under
 * `maxDpCells`. If it still doesn't fit, or there are more than
 * `maxItemsDp` candidates, falls back to a greedy value/price selection
 * (known approximation, not exact) rather than blowing the 2s budget.
 */
export function optimizeKnapsack(
  items: KnapsackCandidate[],
  params: KnapsackParams,
): KnapsackResult {
  if (items.length === 0 || params.budgetCents <= 0) {
    return {
      selectedIds: [],
      totalValue: 0,
      totalCostCents: 0,
      usedFallback: false,
    };
  }

  const values = items.map(
    (i) =>
      params.weights.utility * i.utility +
      params.weights.sustainability * i.sustainabilityScore +
      params.weights.saving * i.relativeSaving,
  );

  let step = params.discretizationStepCents;
  let capacity = Math.floor(params.budgetCents / step);
  while (
    items.length * (capacity + 1) > params.maxDpCells &&
    step < params.maxStepCents
  ) {
    step *= 2;
    capacity = Math.floor(params.budgetCents / step);
  }

  const dpTooLarge = items.length * (capacity + 1) > params.maxDpCells;
  if (items.length > params.maxItemsDp || dpTooLarge) {
    return greedyFallback(items, values, params.budgetCents);
  }

  return exactDp(items, values, capacity, step);
}

function exactDp(
  items: KnapsackCandidate[],
  values: number[],
  capacity: number,
  step: number,
): KnapsackResult {
  const n = items.length;
  const weights = items.map((i) => Math.round(i.priceCents / step));

  const dp = new Float64Array(capacity + 1);
  const keep: Uint8Array[] = Array.from(
    { length: n },
    () => new Uint8Array(capacity + 1),
  );

  for (let i = 0; i < n; i++) {
    const w = weights[i];
    const v = values[i];
    if (w > capacity) continue;
    for (let c = capacity; c >= w; c--) {
      const candidateValue = dp[c - w] + v;
      if (candidateValue > dp[c]) {
        dp[c] = candidateValue;
        keep[i][c] = 1;
      }
    }
  }

  let c = capacity;
  const selectedIds: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i][c]) {
      selectedIds.push(items[i].id);
      c -= weights[i];
    }
  }

  const totalCostCents = selectedIds.reduce((sum, id) => {
    const item = items.find((x) => x.id === id)!;
    return sum + item.priceCents;
  }, 0);

  return {
    selectedIds,
    totalValue: dp[capacity],
    totalCostCents,
    usedFallback: false,
  };
}

function greedyFallback(
  items: KnapsackCandidate[],
  values: number[],
  budgetCents: number,
): KnapsackResult {
  const order = items
    .map((item, index) => ({
      index,
      ratio: values[index] / Math.max(item.priceCents, 1),
    }))
    .sort((a, b) => b.ratio - a.ratio);

  let remaining = budgetCents;
  let totalValue = 0;
  const selectedIds: string[] = [];

  for (const { index } of order) {
    const item = items[index];
    if (item.priceCents <= remaining) {
      selectedIds.push(item.id);
      remaining -= item.priceCents;
      totalValue += values[index];
    }
  }

  return {
    selectedIds,
    totalValue,
    totalCostCents: budgetCents - remaining,
    usedFallback: true,
  };
}
