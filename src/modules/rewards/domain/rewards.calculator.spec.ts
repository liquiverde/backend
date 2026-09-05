import {
  calculateOptimizedItemPoints,
  calculateSubstitutionPoints,
  HIGH_SCORE_THRESHOLD,
} from './rewards.calculator';

describe('calculateOptimizedItemPoints', () => {
  it('awards 0 points below the threshold', () => {
    expect(calculateOptimizedItemPoints(HIGH_SCORE_THRESHOLD - 1)).toBe(0);
  });

  it('awards points proportional to how far above the threshold the score is', () => {
    expect(calculateOptimizedItemPoints(HIGH_SCORE_THRESHOLD + 10)).toBe(10);
    expect(calculateOptimizedItemPoints(100)).toBe(100 - HIGH_SCORE_THRESHOLD);
  });

  it('awards 0 exactly at the threshold', () => {
    expect(calculateOptimizedItemPoints(HIGH_SCORE_THRESHOLD)).toBe(0);
  });
});

describe('calculateSubstitutionPoints', () => {
  it('awards 0 points when the substitute does not improve the score', () => {
    expect(calculateSubstitutionPoints(60, 60)).toBe(0);
    expect(calculateSubstitutionPoints(60, 50)).toBe(0);
  });

  it('awards points proportional to the score improvement', () => {
    expect(calculateSubstitutionPoints(50, 70)).toBe(10); // (70-50)*0.5
  });
});
