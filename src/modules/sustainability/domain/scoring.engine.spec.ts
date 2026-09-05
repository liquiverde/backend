import { calculateSustainabilityScore } from './scoring.engine';
import type { ScoringInput } from './scoring.types';

const DEFAULT_WEIGHTS = { economic: 0.4, env: 0.35, social: 0.25 };

function baseInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    price: 1000,
    categoryAvgPrice: 1000,
    carbonFootprintKg: 1,
    categoryAvgCarbon: 1,
    packagingScore: 70,
    originDistanceKm: 100,
    socialCertifications: ['Fair Trade'],
    weights: DEFAULT_WEIGHTS,
    ...overrides,
  };
}

describe('calculateSustainabilityScore', () => {
  it('returns HIGH confidence with no missing fields when all data is present', () => {
    const result = calculateSustainabilityScore(baseInput());
    expect(result.missingFields).toHaveLength(0);
    expect(result.dataConfidence).toBe('HIGH');
  });

  it('scores economicScore=50 when price equals the category average exactly', () => {
    const result = calculateSustainabilityScore(
      baseInput({ price: 500, categoryAvgPrice: 500 }),
    );
    expect(result.economicScore).toBe(50);
  });

  it('rewards a cheaper-than-average price with economicScore > 50', () => {
    const result = calculateSustainabilityScore(
      baseInput({ price: 500, categoryAvgPrice: 1000 }),
    );
    expect(result.economicScore).toBeGreaterThan(50);
  });

  it('penalizes a pricier-than-average product with economicScore < 50', () => {
    const result = calculateSustainabilityScore(
      baseInput({ price: 1500, categoryAvgPrice: 1000 }),
    );
    expect(result.economicScore).toBeLessThan(50);
  });

  it('stays HIGH confidence with a single missing field (carbon)', () => {
    const result = calculateSustainabilityScore(
      baseInput({ carbonFootprintKg: null, categoryAvgCarbon: null }),
    );
    expect(result.missingFields).toContain('carbonFootprintKg');
    expect(result.dataConfidence).toBe('HIGH');
  });

  it('degrades to MEDIUM once two fields are missing', () => {
    const result = calculateSustainabilityScore(
      baseInput({
        carbonFootprintKg: null,
        categoryAvgCarbon: null,
        originDistanceKm: null,
      }),
    );
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['carbonFootprintKg', 'originDistanceKm']),
    );
    expect(result.dataConfidence).toBe('MEDIUM');
  });

  it('never invents data — everything missing degrades to a neutral 50 and LOW confidence', () => {
    const result = calculateSustainabilityScore({
      price: 1000,
      categoryAvgPrice: null,
      carbonFootprintKg: null,
      categoryAvgCarbon: null,
      packagingScore: null,
      originDistanceKm: null,
      socialCertifications: null,
      weights: DEFAULT_WEIGHTS,
    });
    expect(result.economicScore).toBe(50);
    expect(result.envScore).toBe(50);
    expect(result.socialScore).toBe(50);
    expect(result.finalScore).toBe(50);
    expect(result.dataConfidence).toBe('LOW');
  });

  it('treats a known-empty certification list as socialScore=30, not a data gap', () => {
    const result = calculateSustainabilityScore(
      baseInput({ socialCertifications: [] }),
    );
    expect(result.socialScore).toBe(30);
    expect(result.missingFields).not.toContain('socialCertifications');
  });

  it('rewards more certifications with a higher socialScore', () => {
    const one = calculateSustainabilityScore(
      baseInput({ socialCertifications: ['Fair Trade'] }),
    );
    const three = calculateSustainabilityScore(
      baseInput({
        socialCertifications: ['Fair Trade', 'Organic', 'B-Corp'],
      }),
    );
    expect(three.socialScore).toBeGreaterThan(one.socialScore);
  });

  it('computes finalScore as the configured weighted sum of the three sub-scores', () => {
    const result = calculateSustainabilityScore(baseInput());
    const expected =
      DEFAULT_WEIGHTS.economic * result.economicScore +
      DEFAULT_WEIGHTS.env * result.envScore +
      DEFAULT_WEIGHTS.social * result.socialScore;
    expect(result.finalScore).toBeCloseTo(expected, 6);
  });

  it('keeps all scores within the 0-100 range for extreme inputs', () => {
    const result = calculateSustainabilityScore(
      baseInput({
        price: 100_000,
        categoryAvgPrice: 100,
        carbonFootprintKg: 1000,
        categoryAvgCarbon: 1,
        originDistanceKm: 1_000_000,
      }),
    );
    for (const score of [
      result.economicScore,
      result.envScore,
      result.socialScore,
      result.finalScore,
    ]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
