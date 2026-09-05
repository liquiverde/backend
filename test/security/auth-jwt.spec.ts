/**
 * 1.1 Auth / JWT — tampering and edge-case token attacks.
 * Requires JWT_SECRET from backend/.env (the same secret the running api
 * container uses, since both point at the same local dev config).
 */
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { client, uniqueEmail } from './utils/http-client';
import { check, finding, saveResults, suite, summaryExitCode } from './utils/test-harness';

function readEnvVar(envPath: string, key: string): string | undefined {
  const content = fs.readFileSync(envPath, 'utf-8');
  const line = content.split('\n').find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim();
}

async function main() {
  suite('1.1 Auth / JWT tampering');

  // The running `api` container is started by docker-compose.yml at the
  // repo ROOT, which loads env_file: .env (the ROOT .env, not backend/.env
  // — those are two separate files with independently generated secrets).
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  const realSecret = readEnvVar(envPath, 'JWT_SECRET');
  if (!realSecret) {
    console.error('Could not read JWT_SECRET from backend/.env — aborting.');
    process.exit(1);
  }

  // Baseline: register a real user and get a real, valid token.
  const email = uniqueEmail('jwt-test');
  const password = 'SuperSecret123';
  const registerRes = await client.post('/auth/register', { email, password, name: 'JWT Test' });
  const realToken: string = registerRes.data.accessToken;
  const realUserId: string = registerRes.data.userId;
  check('setup: registration succeeds and returns a token', registerRes.status === 201 && !!realToken);

  const authed = (token: string) => client.get('/users/me', { headers: { Authorization: `Bearer ${token}` } });

  // No token at all.
  const noTokenRes = await client.get('/users/me');
  check('no token → 401', noTokenRes.status === 401, `status=${noTokenRes.status}`);

  // Malformed header.
  const malformedRes = await authed('not-a-jwt');
  check('malformed token → 401', malformedRes.status === 401, `status=${malformedRes.status}`);

  // Real token, sanity check it actually works before tampering with it.
  const realRes = await authed(realToken);
  check('real token → 200 (baseline)', realRes.status === 200, `status=${realRes.status}`);

  // Tampered signature: flip a character in the last segment.
  const parts = realToken.split('.');
  const tamperedSig = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'A' ? 'B' : 'A');
  const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;
  const tamperedRes = await authed(tamperedToken);
  check('tampered signature → 401', tamperedRes.status === 401, `status=${tamperedRes.status}`);

  // alg: none, unsigned.
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const nonePayload = Buffer.from(JSON.stringify({ sub: realUserId, email })).toString('base64url');
  const noneToken = `${noneHeader}.${nonePayload}.`;
  const noneRes = await authed(noneToken);
  check('alg:none unsigned token → 401', noneRes.status === 401, `status=${noneRes.status}`);

  // Signed with a different (attacker-controlled) secret.
  const foreignToken = jwt.sign({ sub: realUserId, email }, 'attacker-controlled-secret-value-32chars', {
    expiresIn: '2h',
  });
  const foreignRes = await authed(foreignToken);
  check('token signed with a different secret → 401', foreignRes.status === 401, `status=${foreignRes.status}`);

  // Expired token, signed with the REAL secret.
  const expiredToken = jwt.sign({ sub: realUserId, email }, realSecret, { expiresIn: '-1h' });
  const expiredRes = await authed(expiredToken);
  check('expired token (real secret) → 401', expiredRes.status === 401, `status=${expiredRes.status}`);

  // Valid signature (real secret), but sub is a made-up UUID that doesn't exist.
  const fakeUuid = '00000000-0000-4000-8000-000000000099';
  const forgedSubToken = jwt.sign({ sub: fakeUuid, email: 'ghost@example.com' }, realSecret, {
    expiresIn: '2h',
  });
  const forgedMeRes = await authed(forgedSubToken);
  check(
    'forged sub (real secret, nonexistent user) on /users/me → 404 clean (not 500)',
    forgedMeRes.status === 404,
    `status=${forgedMeRes.status}`,
  );

  const forgedListRes = await client.post(
    '/lists',
    { budgetMax: 1000 },
    { headers: { Authorization: `Bearer ${forgedSubToken}` } },
  );
  if (forgedListRes.status === 500) {
    finding(
      'Forged-but-validly-signed sub causes an unmapped 500 on POST /lists',
      'low',
      `A JWT with a valid signature (requires possessing JWT_SECRET, which is already game-over) but a nonexistent user id causes an unhandled Prisma FK violation on POST /lists, surfaced as a generic 500 instead of a clean 4xx. Low severity: exploiting this already requires the real JWT_SECRET. Recommendation: AllExceptionsFilter could map Prisma P2003 (FK violation) similarly to P2002/P2025.`,
    );
  } else {
    check(
      'forged sub on POST /lists does not produce an unmapped 500',
      forgedListRes.status !== 500,
      `status=${forgedListRes.status}`,
    );
  }

  saveResults('auth-jwt.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running auth-jwt spec:', err);
  process.exit(1);
});
