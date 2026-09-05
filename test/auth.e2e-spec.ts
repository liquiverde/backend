import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './utils/create-test-app';

/**
 * RF-12's throttle is intentionally strict (5 req/min, shared across
 * register+login — see AuthController). This suite is written to spend
 * exactly that budget: 1 register, 1 duplicate register, 1 invalid
 * register, 1 correct login, 1 wrong-password login — everything else
 * (protected-route checks) reuses the token from the first call instead
 * of making new throttled requests.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let email: string;
  let password: string;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    email = uniqueEmail('auth-suite');
    password = 'SuperSecret123';
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password,
      name: 'E2E Tester',
    });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user and returns a bearer token (RF-12)', () => {
    expect(accessToken).toEqual(expect.any(String));
  });

  it('rejects registering the same email twice with 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('rejects registration with a password below the minimum length', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('short'),
        password: 'short',
        name: 'Too Short',
      });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects login with the wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a protected route without a token and accepts it with one', async () => {
    const withoutToken = await request(app.getHttpServer()).get('/users/me');
    expect(withoutToken.status).toBe(401);

    const withToken = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(withToken.status).toBe(200);
    expect(withToken.body.email).toBe(email);
  });
});
