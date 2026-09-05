/**
 * 1.9 Error handling / information leakage.
 * Uses 1 /auth/register call (baseline user for the login-timing comparison).
 */
import { client, uniqueEmail, sleep } from './utils/http-client';
import { check, finding, saveResults, suite, summaryExitCode } from './utils/test-harness';

const STACK_TRACE_PATTERNS = [/\bat\s+.+\(.*:\d+:\d+\)/, /node_modules/, /prisma\.\$/i, /PrismaClientKnownRequestError/];

function looksLikeStackLeak(body: unknown): boolean {
  const text = JSON.stringify(body);
  return STACK_TRACE_PATTERNS.some((p) => p.test(text));
}

async function timeRequest(fn: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

async function main() {
  suite('1.9 Error handling / information leakage');

  // Sample a handful of error responses generated fresh here and confirm no stack leakage.
  const notFoundRes = await client.get('/lists/00000000-0000-4000-8000-000000000001'); // no token -> 401 first
  check(
    '401 body has no stack trace leakage',
    !looksLikeStackLeak(notFoundRes.data),
    JSON.stringify(notFoundRes.data),
  );

  const badBodyRes = await client.post('/auth/register', { email: 'not-an-email', password: '123' });
  check(
    '400 validation error body has no stack trace leakage',
    !looksLikeStackLeak(badBodyRes.data),
    JSON.stringify(badBodyRes.data),
  );

  // Login timing / message-consistency check.
  const email = uniqueEmail('errhandling');
  const password = 'SuperSecret123';
  const reg = await client.post('/auth/register', { email, password, name: 'Error Handling Test' });
  check('setup: baseline user registered', reg.status === 201);

  const nonexistentEmailRes = await client.post('/auth/login', {
    email: uniqueEmail('does-not-exist'),
    password: 'whatever123',
  });
  const wrongPasswordRes = await client.post('/auth/login', { email, password: 'totally-wrong-password' });

  check('nonexistent email login → 401', nonexistentEmailRes.status === 401, `status=${nonexistentEmailRes.status}`);
  check('wrong password login → 401', wrongPasswordRes.status === 401, `status=${wrongPasswordRes.status}`);
  check(
    'both branches return the exact same error message (no enumeration via message content)',
    JSON.stringify(nonexistentEmailRes.data.message) === JSON.stringify(wrongPasswordRes.data.message),
    `nonexistent="${nonexistentEmailRes.data.message}" vs wrongPassword="${wrongPasswordRes.data.message}"`,
  );

  // Timing comparison — informative only, not a pass/fail gate.
  const SAMPLES = 6;
  const nonexistentTimes: number[] = [];
  const wrongPasswordTimes: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    nonexistentTimes.push(
      await timeRequest(() =>
        client.post('/auth/login', { email: uniqueEmail(`timing-${i}`), password: 'whatever123' }),
      ),
    );
    wrongPasswordTimes.push(
      await timeRequest(() => client.post('/auth/login', { email, password: `wrong-${i}` })),
    );
    await sleep(50);
  }
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgNonexistent = avg(nonexistentTimes);
  const avgWrongPassword = avg(wrongPasswordTimes);
  finding(
    'Login timing asymmetry between nonexistent-email and wrong-password branches',
    'info',
    `Average response time: nonexistent email ${avgNonexistent.toFixed(1)}ms vs wrong password ${avgWrongPassword.toFixed(1)}ms (${SAMPLES} samples each). AuthService.login() only runs argon2.verify() when a user record is found, so a timing side-channel exists by design. Explotability is very low in this context (network jitter dwarfs the argon2 cost difference for most attackers) — documented as informative, not a blocking finding.`,
  );

  saveResults('error-handling.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running error-handling spec:', err);
  process.exit(1);
});
