import { calculateSavings } from './savings.calculator';

describe('calculateSavings', () => {
  it('sums (categoryAvgPrice - price) across all lines', () => {
    const result = calculateSavings([
      { productId: 'a', price: 800, categoryAvgPrice: 1000 },
      { productId: 'b', price: 1200, categoryAvgPrice: 1000 },
    ]);
    expect(result.totalEstSaving).toBe(0); // +200 - 200
    expect(result.lines).toEqual([
      { productId: 'a', saving: 200 },
      { productId: 'b', saving: -200 },
    ]);
  });

  it('contributes 0 saving for a line with an unknown category average, never inventing a value', () => {
    const result = calculateSavings([
      { productId: 'a', price: 500, categoryAvgPrice: null },
    ]);
    expect(result.lines[0].saving).toBe(0);
    expect(result.totalEstSaving).toBe(0);
  });

  it('returns 0 total saving for an empty list', () => {
    expect(calculateSavings([]).totalEstSaving).toBe(0);
  });
});
