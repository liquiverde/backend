export interface PurchaseHistory {
  productId: string;
  /** Timestamps the product was included in an optimized/completed list, oldest first or not — sorted internally. */
  purchaseDates: Date[];
}

export interface RepurchaseSuggestion {
  productId: string;
  avgIntervalDays: number;
  lastPurchaseDate: Date;
  suggestedNextPurchaseDate: Date;
  isDueSoon: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DUE_SOON_BUFFER_DAYS = 3;

/**
 * Pure repurchase-frequency estimator (RF-10, doc §8.4). No @nestjs/* or
 * @prisma/client imports. `now` is an explicit parameter, not read
 * internally, so the function stays deterministic and testable.
 *
 * Needs at least two data points to derive an interval — a single past
 * purchase carries no frequency signal, so it's skipped (returns null)
 * rather than guessing.
 */
export function estimateRepurchase(
  history: PurchaseHistory,
  now: Date,
  dueSoonBufferDays = DEFAULT_DUE_SOON_BUFFER_DAYS,
): RepurchaseSuggestion | null {
  if (history.purchaseDates.length < 2) return null;

  const sorted = [...history.purchaseDates].sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  const intervalsDays: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervalsDays.push(
      (sorted[i].getTime() - sorted[i - 1].getTime()) / MS_PER_DAY,
    );
  }

  const avgIntervalDays =
    intervalsDays.reduce((sum, d) => sum + d, 0) / intervalsDays.length;
  const lastPurchaseDate = sorted[sorted.length - 1];
  const suggestedNextPurchaseDate = new Date(
    lastPurchaseDate.getTime() + avgIntervalDays * MS_PER_DAY,
  );
  const isDueSoon =
    now.getTime() >=
    suggestedNextPurchaseDate.getTime() - dueSoonBufferDays * MS_PER_DAY;

  return {
    productId: history.productId,
    avgIntervalDays,
    lastPurchaseDate,
    suggestedNextPurchaseDate,
    isDueSoon,
  };
}
