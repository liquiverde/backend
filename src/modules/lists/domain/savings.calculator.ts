export interface SavingsLineInput {
  productId: string;
  price: number;
  /** Category average price; null when unknown (e.g. sole product in its category) — contributes 0 saving, never invented. */
  categoryAvgPrice: number | null;
}

export interface SavingsLine {
  productId: string;
  saving: number;
}

export interface SavingsResult {
  totalEstSaving: number;
  lines: SavingsLine[];
}

/**
 * Pure savings calculator (RF-05, doc §8.1). Compares each selected item's
 * price against its category average — not against discarded candidates,
 * so "not purchased" is never confused with "saved money".
 */
export function calculateSavings(items: SavingsLineInput[]): SavingsResult {
  const lines = items.map((item) => ({
    productId: item.productId,
    saving:
      item.categoryAvgPrice === null ? 0 : item.categoryAvgPrice - item.price,
  }));

  return {
    totalEstSaving: lines.reduce((sum, l) => sum + l.saving, 0),
    lines,
  };
}
