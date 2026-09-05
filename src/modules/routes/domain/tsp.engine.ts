export interface RoutePoint {
  id: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  orderedIds: string[];
  totalDistanceKm: number;
}

const EARTH_RADIUS_KM = 6371;
const MAX_TWO_OPT_PASSES = 200;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathLength(path: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineKm(path[i - 1], path[i]);
  }
  return total;
}

function nearestNeighbor(
  origin: RoutePoint,
  points: RoutePoint[],
): RoutePoint[] {
  const remaining = [...points];
  const route: RoutePoint[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    }
    const [next] = remaining.splice(nearestIndex, 1);
    route.push(next);
    current = next;
  }

  return route;
}

/**
 * Change in total length from reversing route[i..k] — for an OPEN path
 * (no edge closing the last point back to the origin), only the boundary
 * edges (i-1,i) and, when k isn't the last index, (k,k+1) are affected.
 */
function reversalDelta(route: RoutePoint[], i: number, k: number): number {
  const a = route[i - 1];
  const b = route[i];
  const c = route[k];
  const d = k + 1 < route.length ? route[k + 1] : null;

  const removed = haversineKm(a, b) + (d ? haversineKm(c, d) : 0);
  const added = haversineKm(a, c) + (d ? haversineKm(b, d) : 0);
  return added - removed;
}

/** Standard 2-opt local search: reverses a segment whenever it shortens the total path. Origin (index 0) stays fixed as the route's start. */
function twoOptImprove(path: RoutePoint[]): RoutePoint[] {
  let improved = true;
  let passes = 0;
  const route = [...path];

  while (improved && passes < MAX_TWO_OPT_PASSES) {
    improved = false;
    passes++;
    for (let i = 1; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        if (reversalDelta(route, i, k) < -1e-9) {
          const reversed = [
            ...route.slice(0, i),
            ...route.slice(i, k + 1).reverse(),
            ...route.slice(k + 1),
          ];
          route.splice(0, route.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Pure TSP approximation (RF-09, doc §8.4): nearest-neighbor construction
 * + 2-opt local search, starting from a fixed origin (the user's location
 * or the first store). No @nestjs/* or @prisma/client imports.
 */
export function optimizeRoute(
  origin: RoutePoint,
  stores: RoutePoint[],
): RouteResult {
  if (stores.length === 0) {
    return { orderedIds: [], totalDistanceKm: 0 };
  }

  const constructed = [origin, ...nearestNeighbor(origin, stores)];
  const improved = twoOptImprove(constructed);

  return {
    orderedIds: improved.slice(1).map((p) => p.id),
    totalDistanceKm: pathLength(improved),
  };
}
