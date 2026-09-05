import type {
  DataConfidenceLevel,
  ScoringInput,
  ScoringResult,
} from './scoring.types';

/**
 * Pure sustainability scoring engine (RF-03, doc §8.2). No @nestjs/* or
 * @prisma/client imports — testable without infrastructure (RNF-06).
 *
 * Convention: the category average is the neutral score (50). A product
 * better than average scores above 50, worse scores below. When a data
 * point is missing, the neutral value is used and the gap is recorded
 * explicitly in `missingFields` instead of silently guessing (RNF-10).
 */

/** Generous upper bound for "distance travelled" normalization. */
const MAX_REASONABLE_ORIGIN_KM = 20_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeEconomicScore(
  price: number,
  categoryAvgPrice: number | null,
  missingFields: string[],
): number {
  if (categoryAvgPrice === null || categoryAvgPrice <= 0) {
    missingFields.push('categoryAvgPrice');
    return 50;
  }
  return clamp(50 + (1 - price / categoryAvgPrice) * 50, 0, 100);
}

function computeEnvScore(input: ScoringInput, missingFields: string[]): number {
  const subScores: number[] = [];

  if (
    input.carbonFootprintKg !== null &&
    input.categoryAvgCarbon !== null &&
    input.categoryAvgCarbon > 0
  ) {
    subScores.push(
      clamp(
        50 + (1 - input.carbonFootprintKg / input.categoryAvgCarbon) * 50,
        0,
        100,
      ),
    );
  } else {
    missingFields.push('carbonFootprintKg');
  }

  if (input.packagingScore !== null) {
    subScores.push(clamp(input.packagingScore, 0, 100));
  } else {
    missingFields.push('packagingScore');
  }

  if (input.originDistanceKm !== null) {
    subScores.push(
      clamp(
        100 - (input.originDistanceKm / MAX_REASONABLE_ORIGIN_KM) * 100,
        0,
        100,
      ),
    );
  } else {
    missingFields.push('originDistanceKm');
  }

  if (subScores.length === 0) {
    return 50;
  }
  return subScores.reduce((sum, s) => sum + s, 0) / subScores.length;
}

function computeSocialScore(
  certifications: string[] | null,
  missingFields: string[],
): number {
  if (certifications === null) {
    missingFields.push('socialCertifications');
    return 50;
  }
  if (certifications.length === 0) {
    // Known absence of certifications — not a data gap, but not neutral either.
    return 30;
  }
  return clamp(40 + 20 * certifications.length, 0, 100);
}

function resolveConfidence(missingFieldCount: number): DataConfidenceLevel {
  if (missingFieldCount <= 1) return 'HIGH';
  if (missingFieldCount <= 3) return 'MEDIUM';
  return 'LOW';
}

export function calculateSustainabilityScore(
  input: ScoringInput,
): ScoringResult {
  const missingFields: string[] = [];

  const economicScore = computeEconomicScore(
    input.price,
    input.categoryAvgPrice,
    missingFields,
  );
  const envScore = computeEnvScore(input, missingFields);
  const socialScore = computeSocialScore(
    input.socialCertifications,
    missingFields,
  );

  const finalScore = clamp(
    input.weights.economic * economicScore +
      input.weights.env * envScore +
      input.weights.social * socialScore,
    0,
    100,
  );

  return {
    economicScore,
    envScore,
    socialScore,
    finalScore,
    missingFields,
    dataConfidence: resolveConfidence(missingFields.length),
  };
}
