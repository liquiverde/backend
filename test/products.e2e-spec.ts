import { INestApplication } from '@nestjs/common';
import nock from 'nock';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';

const OFF_BASE_URL = 'https://world.openfoodfacts.org';

describe('Products (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('GET /products/search returns the seeded local catalog without hitting the network', async () => {
    const res = await request(app.getHttpServer()).get(
      '/products/search?limit=5',
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(50); // RF-13
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.degraded).toBe(false);
  });

  it('GET /products/barcode/:code resolves a locally-seeded product without calling Open Food Facts', async () => {
    const search = await request(app.getHttpServer()).get(
      '/products/search?limit=1',
    );
    const seeded = search.body.items[0];
    expect(seeded.barcode).toEqual(expect.any(String));

    // No nock interceptor registered — a real network call here would fail the test.
    const res = await request(app.getHttpServer()).get(
      `/products/barcode/${seeded.barcode}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(seeded.id);
  });

  it('upserts a new product discovered via Open Food Facts, flagging its estimated price (RF-01)', async () => {
    const barcode = '1234567890123';
    nock(OFF_BASE_URL)
      .get(`/api/v2/product/${barcode}.json`)
      .reply(200, {
        status: 1,
        product: {
          code: barcode,
          product_name: 'E2E Mocked Product',
          brands: 'MockBrand',
          categories: 'en:snacks',
          ecoscore_grade: 'b',
        },
      });

    const res = await request(app.getHttpServer()).get(
      `/products/barcode/${barcode}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('E2E Mocked Product');
    expect(res.body.source).toBe('OPENFOODFACTS');
    expect(res.body.priceIsEstimated).toBe(true);
    expect(res.body.ecoLabel).toBe('Eco-Score B');

    // Second lookup must hit the local upsert, not the network — no interceptor left standing.
    const again = await request(app.getHttpServer()).get(
      `/products/barcode/${barcode}`,
    );
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(res.body.id);
  });

  it('degrades to 503 (not a crash) when Open Food Facts is unreachable for an unknown barcode (RNF-02)', async () => {
    const barcode = '9999999999991';
    nock(OFF_BASE_URL)
      .get(`/api/v2/product/${barcode}.json`)
      .replyWithError('simulated network failure');

    const res = await request(app.getHttpServer()).get(
      `/products/barcode/${barcode}`,
    );
    expect(res.status).toBe(503);
    expect(res.body.message).toEqual(expect.stringContaining('unreachable'));
  });

  it('GET /products/compare requires 2-5 ids', async () => {
    const search = await request(app.getHttpServer()).get(
      '/products/search?limit=2',
    );
    const [a, b] = search.body.items;

    const ok = await request(app.getHttpServer()).get(
      `/products/compare?ids=${a.id},${b.id}`,
    );
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveLength(2);

    const tooFew = await request(app.getHttpServer()).get(
      `/products/compare?ids=${a.id}`,
    );
    expect(tooFew.status).toBe(400);
  });
});
