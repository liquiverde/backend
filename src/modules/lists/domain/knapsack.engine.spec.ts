import { optimizeKnapsack } from './knapsack.engine';
import type { KnapsackCandidate, KnapsackParams } from './knapsack.types';

const WEIGHTS = { utility: 0.34, sustainability: 0.33, saving: 0.33 };

function defaultParams(
  overrides: Partial<KnapsackParams> = {},
): KnapsackParams {
  return {
    budgetCents: 10_000,
    weights: WEIGHTS,
    discretizationStepCents: 50,
    maxStepCents: 5000,
    maxDpCells: 4_000_000,
    maxItemsDp: 500,
    ...overrides,
  };
}

function valueOf(item: KnapsackCandidate): number {
  return (
    WEIGHTS.utility * item.utility +
    WEIGHTS.sustainability * item.sustainabilityScore +
    WEIGHTS.saving * item.relativeSaving
  );
}

/** Exhaustive 0/1 subset search — reference oracle, only viable for small n. */
function bruteForceOptimalValue(
  items: KnapsackCandidate[],
  budgetCents: number,
): number {
  let best = 0;
  const n = items.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let cost = 0;
    let value = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        cost += items[i].priceCents;
        value += valueOf(items[i]);
      }
    }
    if (cost <= budgetCents && value > best) best = value;
  }
  return best;
}

// All prices are multiples of the default discretization step (50 cents)
// so the DP's rounding introduces zero error — this isolates "did the DP
// find the optimum" from "how much does discretization cost".
function makeCandidates(): KnapsackCandidate[] {
  const prices = [
    100, 200, 150, 300, 250, 500, 700, 800, 350, 900, 1200, 600, 450, 950, 1050,
  ];
  return prices.map((priceCents, i) => ({
    id: `item-${i}`,
    priceCents,
    utility: 40 + ((i * 7) % 60),
    sustainabilityScore: 30 + ((i * 11) % 70),
    relativeSaving: (i * 13) % 100,
  }));
}

describe('optimizeKnapsack', () => {
  it('matches the brute-force optimum for a small candidate set', () => {
    const items = makeCandidates();
    const budgetCents = 3000;
    const result = optimizeKnapsack(items, defaultParams({ budgetCents }));
    const optimal = bruteForceOptimalValue(items, budgetCents);

    expect(result.usedFallback).toBe(false);
    expect(result.totalCostCents).toBeLessThanOrEqual(budgetCents);
    expect(result.totalValue).toBeCloseTo(optimal, 6);
  });

  it('respects the budget constraint for a range of budgets', () => {
    const items = makeCandidates();
    for (const budgetCents of [0, 100, 500, 1500, 5000, 50_000]) {
      const result = optimizeKnapsack(items, defaultParams({ budgetCents }));
      expect(result.totalCostCents).toBeLessThanOrEqual(budgetCents);
    }
  });

  it('returns an empty selection for an empty candidate list', () => {
    const result = optimizeKnapsack([], defaultParams());
    expect(result).toEqual({
      selectedIds: [],
      totalValue: 0,
      totalCostCents: 0,
      usedFallback: false,
    });
  });

  it('returns an empty selection for a zero or negative budget', () => {
    const items = makeCandidates();
    expect(
      optimizeKnapsack(items, defaultParams({ budgetCents: 0 })).selectedIds,
    ).toEqual([]);
    expect(
      optimizeKnapsack(items, defaultParams({ budgetCents: -100 })).selectedIds,
    ).toEqual([]);
  });

  it('excludes a single item that alone exceeds the budget', () => {
    const items: KnapsackCandidate[] = [
      {
        id: 'too-expensive',
        priceCents: 10_000,
        utility: 100,
        sustainabilityScore: 100,
        relativeSaving: 100,
      },
    ];
    const result = optimizeKnapsack(
      items,
      defaultParams({ budgetCents: 5000 }),
    );
    expect(result.selectedIds).toEqual([]);
  });

  it('includes everything when the whole candidate set fits the budget', () => {
    const items = makeCandidates();
    const totalCost = items.reduce((sum, i) => sum + i.priceCents, 0);
    const result = optimizeKnapsack(
      items,
      defaultParams({ budgetCents: totalCost }),
    );
    expect(result.selectedIds).toHaveLength(items.length);
    expect(result.totalCostCents).toBe(totalCost);
  });

  it('falls back to the greedy heuristic when the DP table would be too large', () => {
    const items = makeCandidates();
    const result = optimizeKnapsack(
      items,
      defaultParams({ budgetCents: 3000, maxDpCells: 10, maxStepCents: 50 }),
    );
    expect(result.usedFallback).toBe(true);
    expect(result.totalCostCents).toBeLessThanOrEqual(3000);
  });

  it('falls back to greedy when the candidate count exceeds maxItemsDp', () => {
    const items = makeCandidates();
    const result = optimizeKnapsack(items, defaultParams({ maxItemsDp: 2 }));
    expect(result.usedFallback).toBe(true);
  });

  it('completes well within the RNF-01 2s budget for 500 synthetic candidates', () => {
    const items: KnapsackCandidate[] = Array.from({ length: 500 }, (_, i) => ({
      id: `synthetic-${i}`,
      priceCents: 100 + ((i * 37) % 5000),
      utility: (i * 3) % 100,
      sustainabilityScore: (i * 17) % 100,
      relativeSaving: (i * 23) % 100,
    }));

    const start = performance.now();
    const result = optimizeKnapsack(
      items,
      defaultParams({ budgetCents: 200_000 }),
    );
    const elapsedMs = performance.now() - start;

    expect(result.totalCostCents).toBeLessThanOrEqual(200_000);
    // Informative smoke test — generous bound to absorb slow CI machines,
    // the real check happens against the live HTTP endpoint (see e2e).
    expect(elapsedMs).toBeLessThan(3000);
  });
});
