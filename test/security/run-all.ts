/**
 * Runs the full security test suite in the order that respects the shared
 * rate-limit buckets (5/min on auth register+login independently, 100/min
 * global). See the plan's "Orden de ejecución" section.
 *
 * Any script that makes /auth/register calls needs a mostly-fresh 60s
 * window to get clean pass/fail signal, so we sleep between them rather
 * than trying to hand-track partial remaining budget across processes.
 */
import { execSync } from 'child_process';
import * as path from 'path';

const TS_NODE = 'pnpm exec ts-node --transpile-only';
const DIR = __dirname;

interface Step {
  label: string;
  cmd: string;
  sleepAfterMs?: number;
}

const AUTH_WINDOW_COOLDOWN_MS = 65_000;

const steps: Step[] = [
  { label: 'Headers & CORS', cmd: `bash "${path.join(DIR, 'headers-cors.sh')}"` },
  { label: 'Secrets check', cmd: `bash "${path.join(DIR, 'secrets-check.sh')}"` },
  { label: 'Dependency audit', cmd: `bash "${path.join(DIR, 'dependency-audit.sh')}"` },
  {
    label: 'Rate limit A (auth buckets)',
    cmd: `${TS_NODE} "${path.join(DIR, 'rate-limit.spec.ts')}"`,
    sleepAfterMs: AUTH_WINDOW_COOLDOWN_MS,
  },
  {
    label: 'Auth / JWT tampering',
    cmd: `${TS_NODE} "${path.join(DIR, 'auth-jwt.spec.ts')}"`,
    sleepAfterMs: AUTH_WINDOW_COOLDOWN_MS,
  },
  {
    label: 'IDOR / ownership bypass',
    cmd: `${TS_NODE} "${path.join(DIR, 'idor-lists.spec.ts')}"`,
    sleepAfterMs: AUTH_WINDOW_COOLDOWN_MS,
  },
  {
    label: 'Mass assignment + enumeration',
    cmd: `${TS_NODE} "${path.join(DIR, 'mass-assignment.spec.ts')}"`,
    sleepAfterMs: AUTH_WINDOW_COOLDOWN_MS,
  },
  { label: 'Injection', cmd: `${TS_NODE} "${path.join(DIR, 'injection.spec.ts')}"` },
  {
    label: 'Input validation',
    cmd: `${TS_NODE} "${path.join(DIR, 'input-validation.spec.ts')}"`,
    sleepAfterMs: AUTH_WINDOW_COOLDOWN_MS,
  },
  { label: 'Error handling / info leakage', cmd: `${TS_NODE} "${path.join(DIR, 'error-handling.spec.ts')}"` },
  { label: 'Rate limit B (global)', cmd: `${TS_NODE} "${path.join(DIR, 'rate-limit-global.spec.ts')}"` },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let anyFailed = false;
  for (const step of steps) {
    console.log(`\n\n########## ${step.label} ##########`);
    try {
      execSync(step.cmd, { cwd: DIR, stdio: 'inherit' });
    } catch {
      anyFailed = true;
      console.error(`>>> Step "${step.label}" reported failures (see output above).`);
    }
    if (step.sleepAfterMs) {
      console.log(`\n(waiting ${step.sleepAfterMs / 1000}s for the auth rate-limit window to reset...)`);
      await sleep(step.sleepAfterMs);
    }
  }
  console.log(anyFailed ? '\n\nSome steps reported failures — see output above.' : '\n\nAll steps completed cleanly.');
  process.exit(anyFailed ? 1 : 0);
}

main();
