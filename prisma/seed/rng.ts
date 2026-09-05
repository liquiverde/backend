/**
 * Deterministic RNG (mulberry32) so the synthetic seed dataset is
 * reproducible across `docker compose up` runs — same products, same
 * barcodes every time, which is what makes the upsert-based seed
 * idempotent rather than just non-crashing.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export function createSeededRng(seedString: string) {
  const rng = mulberry32(hashStringToSeed(seedString));
  return {
    next: rng,
    int: (minInclusive: number, maxInclusive: number) =>
      Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive,
    float: (min: number, max: number) => min + rng() * (max - min),
    pick: <T>(items: readonly T[]): T =>
      items[Math.floor(rng() * items.length)],
    pickSome: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items];
      const result: T[] = [];
      for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(rng() * pool.length);
        result.push(pool.splice(idx, 1)[0]);
      }
      return result;
    },
    bool: (probability = 0.5) => rng() < probability,
  };
}
