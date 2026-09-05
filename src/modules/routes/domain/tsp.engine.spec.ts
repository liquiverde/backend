import { optimizeRoute, type RoutePoint } from './tsp.engine';

const origin: RoutePoint = { id: 'origin', lat: 0, lng: 0 };

describe('optimizeRoute', () => {
  it('returns an empty route for no stores', () => {
    expect(optimizeRoute(origin, [])).toEqual({
      orderedIds: [],
      totalDistanceKm: 0,
    });
  });

  it('returns a single-leg route for one store', () => {
    const store: RoutePoint = { id: 's1', lat: 0.1, lng: 0 };
    const result = optimizeRoute(origin, [store]);
    expect(result.orderedIds).toEqual(['s1']);
    expect(result.totalDistanceKm).toBeGreaterThan(0);
  });

  it('includes every store exactly once regardless of input order', () => {
    const stores: RoutePoint[] = [
      { id: 's1', lat: 0.05, lng: 0.02 },
      { id: 's2', lat: -0.03, lng: 0.04 },
      { id: 's3', lat: 0.01, lng: -0.05 },
      { id: 's4', lat: 0.08, lng: 0.08 },
    ];
    const result = optimizeRoute(origin, stores);
    expect(new Set(result.orderedIds)).toEqual(
      new Set(['s1', 's2', 's3', 's4']),
    );
    expect(result.orderedIds).toHaveLength(4);
  });

  it('visits collinear stores nearest-to-farthest even when given out of order', () => {
    const near: RoutePoint = { id: 'near', lat: 0.01, lng: 0 };
    const mid: RoutePoint = { id: 'mid', lat: 0.02, lng: 0 };
    const far: RoutePoint = { id: 'far', lat: 0.03, lng: 0 };
    const result = optimizeRoute(origin, [far, near, mid]);
    expect(result.orderedIds).toEqual(['near', 'mid', 'far']);
  });

  it('never produces a longer route than the unoptimized input order', () => {
    // A classic nearest-neighbor trap: greedy NN alone can zig-zag; 2-opt
    // must not leave the route worse than simply visiting in input order.
    const stores: RoutePoint[] = [
      { id: 'a', lat: 0, lng: 1 },
      { id: 'b', lat: 1, lng: 0 },
      { id: 'c', lat: 0, lng: -1 },
      { id: 'd', lat: -1, lng: 0 },
    ];
    const naiveOrderDistanceKm = (() => {
      const path = [origin, ...stores];
      let total = 0;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const R = 6371;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLng = ((b.lng - a.lng) * Math.PI) / 180;
        const h =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        total += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
      }
      return total;
    })();

    const result = optimizeRoute(origin, stores);
    expect(result.totalDistanceKm).toBeLessThanOrEqual(
      naiveOrderDistanceKm + 1e-6,
    );
  });
});
