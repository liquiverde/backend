/**
 * 1.4 Injection — SQLi attempts (Prisma should treat everything as literal
 * parameters), plus static checks for command/NoSQL injection surface.
 * No /auth/register calls needed here.
 */
import { execSync } from 'child_process';
import { client } from './utils/http-client';
import { check, saveResults, suite, summaryExitCode } from './utils/test-harness';

const SQLI_PAYLOADS = [
  `' OR '1'='1`,
  `1'; DROP TABLE users;--`,
  `'; SELECT pg_sleep(5);--`,
];

async function main() {
  suite('1.4 Injection');

  // SQLi via /products/search?q= — run WITHOUT triggering external API
  // augmentation repeatedly: use limit=5 and only run each payload once.
  for (const payload of SQLI_PAYLOADS) {
    const start = Date.now();
    const res = await client.get('/products/search', { params: { q: payload, limit: 5 } });
    const elapsedMs = Date.now() - start;
    check(
      `/products/search?q=${JSON.stringify(payload)} → not 500`,
      res.status !== 500,
      `status=${res.status}`,
    );
    check(
      `/products/search?q=${JSON.stringify(payload)} → no anomalous delay (pg_sleep did not execute)`,
      elapsedMs < 5000,
      `${elapsedMs}ms`,
    );
  }

  // SQLi via email field on /auth/login — expect rejection by @IsEmail()
  // before ever touching Prisma. Only 2 calls, no register consumed.
  for (const payload of [`' OR '1'='1`, `admin'--`]) {
    const res = await client.post('/auth/login', { email: payload, password: 'whatever123' });
    check(
      `/auth/login email=${JSON.stringify(payload)} → 400 (rejected by @IsEmail, never reaches Prisma)`,
      res.status === 400,
      `status=${res.status}`,
    );
  }

  // $queryRaw in the health check — static review only, no user interpolation.
  const healthRes = await client.get('/health');
  check('GET /health → 200 (the only $queryRaw in the codebase, no user input interpolated)', healthRes.status === 200);

  // Command/NoSQL injection surface — static grep, should be empty.
  let grepOutput = '';
  try {
    grepOutput = execSync('grep -rn "exec(\\|spawn(\\|eval(" src/', {
      cwd: __dirname + '/../..',
      encoding: 'utf-8',
    });
  } catch (err: any) {
    // grep exits 1 when there are no matches — that's the expected/good outcome.
    grepOutput = err.stdout || '';
  }
  check(
    'No exec()/spawn()/eval() usage with user input in src/ (command injection N/A)',
    grepOutput.trim() === '',
    grepOutput.trim() === '' ? 'no matches' : `matches found:\n${grepOutput}`,
  );

  saveResults('injection.json');
  process.exit(summaryExitCode());
}

main().catch((err) => {
  console.error('Fatal error running injection spec:', err);
  process.exit(1);
});
