import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';

describe('Substitution (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('suggests substitutes cheaper-or-better-scored than the target, cheapest-price-ceiling respected (RF-06)', async () => {
    // Pull enough candidates to find one whose category actually has substitutes.
    const search = await request(app.getHttpServer()).get(
      '/products/search?limit=20',
    );
    const candidates = search.body.items;

    let found: { productId: string; result: any[] } | null = null;
    for (const candidate of candidates) {
      const res = await request(app.getHttpServer()).get(
        `/substitution/${candidate.id}?limit=3`,
      );
      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        found = { productId: candidate.id, result: res.body };
        break;
      }
    }

    expect(found).not.toBeNull();
    const target = candidates.find(
      (c: { id: string }) => c.id === found!.productId,
    );
    for (const suggestion of found!.result) {
      expect(suggestion.product.finalScore).toBeGreaterThan(target.finalScore);
      expect(suggestion.product.price).toBeLessThanOrEqual(
        target.price * 1.1 + 0.01,
      );
    }
  });

  it('returns an empty array (not an error) for a product with no valid substitutes', async () => {
    const search = await request(app.getHttpServer()).get(
      '/products/search?limit=1',
    );
    const productId = search.body.items[0].id;

    // A very tight limit still returns 200 with an array, never throws.
    const res = await request(app.getHttpServer()).get(
      `/substitution/${productId}?limit=0`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 for a non-existent product', async () => {
    const res = await request(app.getHttpServer()).get(
      '/substitution/00000000-0000-4000-8000-000000000000',
    );
    expect(res.status).toBe(404);
  });
});
