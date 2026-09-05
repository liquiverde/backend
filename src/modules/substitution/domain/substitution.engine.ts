import { cosineSimilarity } from './similarity';
import type {
  RankedSubstitute,
  SubstitutionParams,
  SubstitutionProduct,
} from './substitution.types';

/**
 * Pure substitution engine (RF-06, doc §8.3). No @nestjs/* or
 * @prisma/client imports — the caller is responsible for fetching the pool
 * (same category / parent category, top candidates by score) from Prisma.
 */

function minMax(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function buildAttributeVector(
  product: SubstitutionProduct,
  priceRange: { min: number; max: number },
  carbonRange: { min: number; max: number } | null,
): number[] {
  const priceNorm = normalize(product.price, priceRange.min, priceRange.max);
  const carbonNorm =
    carbonRange && product.carbonFootprintKg !== null
      ? 1 -
        normalize(product.carbonFootprintKg, carbonRange.min, carbonRange.max)
      : 0.5; // unknown carbon — neutral, doesn't push similarity either way

  return [
    priceNorm,
    carbonNorm,
    product.envScore / 100,
    product.socialScore / 100,
    product.economicScore / 100,
  ];
}

export function findSubstitutes(
  target: SubstitutionProduct,
  pool: SubstitutionProduct[],
  params: SubstitutionParams,
): RankedSubstitute[] {
  const maxPrice = target.price * (1 + params.maxPriceIncreasePct / 100);

  const eligible = pool.filter(
    (candidate) =>
      candidate.id !== target.id &&
      candidate.finalScore > target.finalScore &&
      candidate.price <= maxPrice,
  );

  if (eligible.length === 0) return [];

  const allForNormalization = [target, ...eligible];
  const priceRange = minMax(allForNormalization.map((p) => p.price));
  const carbonValues = allForNormalization
    .map((p) => p.carbonFootprintKg)
    .filter((v): v is number => v !== null);
  const carbonRange = carbonValues.length > 0 ? minMax(carbonValues) : null;

  const targetVector = buildAttributeVector(target, priceRange, carbonRange);

  const ranked: RankedSubstitute[] = eligible.map((candidate) => {
    const candidateVector = buildAttributeVector(
      candidate,
      priceRange,
      carbonRange,
    );
    const similarity = cosineSimilarity(targetVector, candidateVector);
    const scoreDelta = (candidate.finalScore - target.finalScore) / 100;
    const priceDelta =
      target.price === 0 ? 0 : (candidate.price - target.price) / target.price;

    const compositeRank =
      params.weights.score * scoreDelta -
      params.weights.price * priceDelta +
      params.weights.similarity * similarity;

    return {
      id: candidate.id,
      compositeRank,
      scoreDelta,
      priceDelta,
      similarity,
    };
  });

  return ranked.sort((a, b) => b.compositeRank - a.compositeRank);
}
