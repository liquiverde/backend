/**
 * Pure rewards calculator (RF-11, doc §8.4). No @nestjs/* or @prisma/client
 * imports. Two triggers, per the design doc: a high-scoring item included
 * in the optimized basket, or an accepted substitution.
 */

/** A product only "earns its inclusion" once it's meaningfully above the
 *  category-neutral score of 50 — otherwise every basket would trivially
 *  earn points regardless of sustainability quality. */
export const HIGH_SCORE_THRESHOLD = 70;

export function calculateOptimizedItemPoints(
  finalScore: number,
  threshold = HIGH_SCORE_THRESHOLD,
): number {
  if (finalScore < threshold) return 0;
  return Math.round(finalScore - threshold);
}

export function calculateSubstitutionPoints(
  originalFinalScore: number,
  newFinalScore: number,
): number {
  const improvement = newFinalScore - originalFinalScore;
  if (improvement <= 0) return 0;
  return Math.round(improvement * 0.5);
}
