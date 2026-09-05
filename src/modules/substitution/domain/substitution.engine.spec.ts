import { findSubstitutes } from './substitution.engine';
import type {
  SubstitutionParams,
  SubstitutionProduct,
} from './substitution.types';

const WEIGHTS = { score: 0.5, price: 0.2, similarity: 0.3 };
const PARAMS: SubstitutionParams = {
  maxPriceIncreasePct: 10,
  weights: WEIGHTS,
};

function product(overrides: Partial<SubstitutionProduct>): SubstitutionProduct {
  return {
    id: 'p',
    categoryId: 'cat-1',
    price: 1000,
    finalScore: 50,
    economicScore: 50,
    envScore: 50,
    socialScore: 50,
    carbonFootprintKg: 1,
    ...overrides,
  };
}

describe('findSubstitutes', () => {
  const target = product({ id: 'target', price: 1000, finalScore: 50 });

  it('returns an empty array when the pool is empty (no exception)', () => {
    expect(findSubstitutes(target, [], PARAMS)).toEqual([]);
  });

  it('excludes candidates with finalScore <= target', () => {
    const equalScore = product({ id: 'equal', finalScore: 50, price: 1000 });
    const lowerScore = product({ id: 'lower', finalScore: 40, price: 1000 });
    const result = findSubstitutes(target, [equalScore, lowerScore], PARAMS);
    expect(result).toEqual([]);
  });

  it('excludes candidates priced more than maxPriceIncreasePct above target', () => {
    const tooExpensive = product({
      id: 'expensive',
      finalScore: 80,
      price: 1101,
    }); // +10.1%
    const result = findSubstitutes(target, [tooExpensive], PARAMS);
    expect(result).toEqual([]);
  });

  it('includes a candidate at exactly the price ceiling', () => {
    const atCeiling = product({ id: 'ceiling', finalScore: 80, price: 1100 }); // +10%
    const result = findSubstitutes(target, [atCeiling], PARAMS);
    expect(result.map((r) => r.id)).toContain('ceiling');
  });

  it('excludes the target itself even if present in the pool', () => {
    const result = findSubstitutes(target, [target], PARAMS);
    expect(result).toEqual([]);
  });

  it('ranks a cheaper, higher-scoring, more-similar candidate above a pricier one', () => {
    const better = product({
      id: 'better',
      finalScore: 90,
      price: 900,
      envScore: 90,
      socialScore: 90,
      economicScore: 90,
    });
    const worse = product({
      id: 'worse',
      finalScore: 60,
      price: 1090,
      envScore: 55,
      socialScore: 55,
      economicScore: 55,
    });
    const result = findSubstitutes(target, [better, worse], PARAMS);
    expect(result[0].id).toBe('better');
  });

  it('never returns a candidate for a zero-price target without throwing', () => {
    const zeroPriceTarget = product({
      id: 'free-target',
      price: 0,
      finalScore: 30,
    });
    const candidate = product({ id: 'candidate', price: 0, finalScore: 60 });
    expect(() =>
      findSubstitutes(zeroPriceTarget, [candidate], PARAMS),
    ).not.toThrow();
  });
});
