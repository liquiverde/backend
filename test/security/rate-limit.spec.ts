/**
 * 1.6-A Rate limiting — auth buckets (register vs login).
 * IMPORTANT: run this FIRST, with a clean 60s window with no prior traffic
 * to /auth/* — this test depends on a clean rate-limit bucket.
 * (1.6-B, the global-limit test, lives in rate-limit-global.spec.ts and
 * runs LAST in the security phase since it deliberately saturates the
 * shared 100/min bucket.)
 */
import { client, uniqueEmail } from './utils/http-client';
import { check, finding, saveResults, suite, summaryExitCode } from './utils/test-harness';

async function testA_authBuckets() {
  suite('1.6-A Rate limit — auth buckets (register vs login)');

  const password = 'SuperSecret123';
  let lastEmail = '';
  let sawRegister429 = false;

  for (let i = 0; i < 5; i++) {
    const email = uniqueEmail('ratelimit-a');
    lastEmail = email;
    const res = await client.post('/auth/register', { email, password, name: 'RL Test' });
    check(
      `register #${i + 1}/5 within budget returns non-429`,
      res.status !== 429,
      `status=${res.status}`,
    );
    if (res.status === 429) sawRegister429 = true;
  }

  // Immediately try a login with the last registered user's credentials.
  const loginRes = await client.post('/auth/login', { email: lastEmail, password });
  if (loginRes.status === 429) {
    finding(
      'Auth throttle buckets are shared',
      'info',
      'POST /auth/login was rate-limited immediately after 5 register calls — register and login share one 5/min bucket, matching the documented design intent.',
    );
  } else {
    check(
      'login right after 5 registers succeeds (200)',
      loginRes.status === 200,
      `status=${loginRes.status}`,
    );
    finding(
      'Auth throttle buckets are independent, not shared',
      'info',
      '@nestjs/throttler generates the rate-limit key as `${Controller}-${Handler}-${throttlerName}-${ip}` (confirmed in node_modules/@nestjs/throttler/dist/throttler.guard.js). Because the handler name is part of the key, POST /auth/register and POST /auth/login have independent 5 req/min counters even though both use the throttler name "default" — the effective combined auth limit is 10 req/min (5+5), not 5 as the design intent (a single shared bucket) suggests. To share a bucket, a custom generateKey would be needed on the @Throttle decorator.',
    );
  }

  // 6th register call within the same 60s window — should now hit the register-specific limit.
  const sixthEmail = uniqueEmail('ratelimit-a-6th');
  const sixthRes = await client.post('/auth/register', { email: sixthEmail, password, name: 'RL 6th' });
  check('6th register call within 60s is throttled (429)', sixthRes.status === 429, `status=${sixthRes.status}`);
  if (sixthRes.status === 429) {
    const retryAfter = sixthRes.headers['retry-after'];
    check('429 response includes Retry-After header', !!retryAfter, `Retry-After=${retryAfter}`);
    if (retryAfter) {
      const seconds = Number(retryAfter);
      check(
        'Retry-After is a sane value (<=60s)',
        !Number.isNaN(seconds) && seconds > 0 && seconds <= 60,
        `${seconds}s`,
      );
    }
  }

  if (sawRegister429) {
    check(
      'None of the first 5 register calls were 429 (clean window assumption)',
      false,
      'window was not clean — results above may be skewed; re-run with a clean 60s window',
    );
  }
}

async function main() {
  await testA_authBuckets();
  saveResults('rate-limit-a.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running rate-limit-a spec:', err);
  process.exit(1);
});
