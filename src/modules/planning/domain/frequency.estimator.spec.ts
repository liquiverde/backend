import { estimateRepurchase } from './frequency.estimator';

const day = (n: number) => new Date(2026, 0, n);

describe('estimateRepurchase', () => {
  it('returns null with fewer than 2 data points', () => {
    expect(
      estimateRepurchase({ productId: 'p', purchaseDates: [] }, day(10)),
    ).toBeNull();
    expect(
      estimateRepurchase({ productId: 'p', purchaseDates: [day(1)] }, day(10)),
    ).toBeNull();
  });

  it('computes the average interval across purchases, unsorted input included', () => {
    const result = estimateRepurchase(
      { productId: 'p', purchaseDates: [day(20), day(1), day(10)] },
      day(21),
    );
    // sorted: 1, 10, 20 -> intervals 9, 10 -> avg 9.5
    expect(result?.avgIntervalDays).toBeCloseTo(9.5, 6);
    expect(result?.lastPurchaseDate).toEqual(day(20));
  });

  it('flags isDueSoon when now is within the buffer of the suggested date', () => {
    // last=10, interval=9 (10-1) -> suggested=19; buffer=3 -> due from day 16
    const result = estimateRepurchase(
      { productId: 'p', purchaseDates: [day(1), day(10)] },
      day(18),
    );
    expect(result?.suggestedNextPurchaseDate).toEqual(day(19));
    expect(result?.isDueSoon).toBe(true);
  });

  it('does not flag isDueSoon when the suggested date is well in the future', () => {
    const result = estimateRepurchase(
      { productId: 'p', purchaseDates: [day(1), day(10)] },
      day(12),
    );
    expect(result?.isDueSoon).toBe(false);
  });
});
