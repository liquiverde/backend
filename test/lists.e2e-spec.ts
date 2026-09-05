import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './utils/create-test-app';

describe('Lists (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('lists'),
        password: 'SuperSecret123',
        name: 'Lists Tester',
      });
    token = user.body.accessToken;

    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('other'),
        password: 'SuperSecret123',
        name: 'Other User',
      });
    otherToken = other.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (t: string) => `Bearer ${t}`;

  it('runs the full create -> add items -> optimize flow within budget (RF-04, RF-05)', async () => {
    const budgetMax = 15000;
    const created = await request(app.getHttpServer())
      .post('/lists')
      .set('Authorization', auth(token))
      .send({ budgetMax });
    expect(created.status).toBe(201);
    const listId = created.body.id;

    const search = await request(app.getHttpServer()).get(
      '/products/search?limit=6',
    );
    const products = search.body.items;
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      const added = await request(app.getHttpServer())
        .post(`/lists/${listId}/items`)
        .set('Authorization', auth(token))
        .send({ productId: p.id, quantity: 1 });
      expect(added.status).toBe(201);
    }

    const start = Date.now();
    const optimized = await request(app.getHttpServer())
      .post(`/lists/${listId}/optimize`)
      .set('Authorization', auth(token));
    const elapsedMs = Date.now() - start;

    expect(optimized.status).toBe(201);
    expect(optimized.body.status).toBe('OPTIMIZED');
    expect(elapsedMs).toBeLessThan(2000); // RNF-01, live over-the-wire smoke check

    const totalCost = optimized.body.items
      .filter((i: { includedInOptimum: boolean }) => i.includedInOptimum)
      .reduce(
        (sum: number, i: { unitPrice: number; quantity: number }) =>
          sum + i.unitPrice * i.quantity,
        0,
      );
    expect(totalCost).toBeLessThanOrEqual(budgetMax);

    const savings = await request(app.getHttpServer())
      .get(`/lists/${listId}/savings`)
      .set('Authorization', auth(token));
    expect(savings.status).toBe(200);
    expect(savings.body.totalEstSaving).toBe(optimized.body.totalEstSaving);
  });

  it("rejects access to another user's list with 403 (ownership guard)", async () => {
    const created = await request(app.getHttpServer())
      .post('/lists')
      .set('Authorization', auth(token))
      .send({ budgetMax: 1000 });
    const listId = created.body.id;

    const res = await request(app.getHttpServer())
      .get(`/lists/${listId}`)
      .set('Authorization', auth(otherToken));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a list that does not exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/lists/00000000-0000-4000-8000-000000000000')
      .set('Authorization', auth(token));
    expect(res.status).toBe(404);
  });
});
