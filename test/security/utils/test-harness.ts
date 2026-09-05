import * as fs from 'fs';
import * as path from 'path';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Result {
  suite: string;
  name: string;
  pass: boolean;
  details?: string;
  isFinding?: boolean;
  severity?: Severity;
  scopeLimitation?: boolean;
}

const results: Result[] = [];
let currentSuite = 'unnamed';

export function suite(name: string): void {
  currentSuite = name;
  console.log(`\n=== ${name} ===`);
}

/** A pass/fail assertion — pass=true means the security control behaved as expected. */
export function check(name: string, pass: boolean, details?: string): void {
  results.push({ suite: currentSuite, name, pass, details });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${name}${details ? ' — ' + details : ''}`);
}

/** A documented finding — not a pass/fail of the harness itself, but something to report. */
export function finding(name: string, severity: Severity, details: string): void {
  results.push({ suite: currentSuite, name, pass: true, details, isFinding: true, severity });
  console.log(`⚠️  [${severity.toUpperCase()}] ${name} — ${details}`);
}

/** A documented scope limitation (not a bug) — kept separate from findings in the report. */
export function scopeLimitation(name: string, details: string): void {
  results.push({ suite: currentSuite, name, pass: true, details, scopeLimitation: true });
  console.log(`ℹ️  [SCOPE] ${name} — ${details}`);
}

export function getResults(): Result[] {
  return results;
}

export function saveResults(filename: string): void {
  const dir = path.join(__dirname, '..', 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(results, null, 2));
}

/** Prints a summary and returns a process exit code (0 if all checks passed, 1 otherwise). */
export function summaryExitCode(): number {
  const failed = results.filter((r) => !r.pass);
  const findings = results.filter((r) => r.isFinding);
  console.log(
    `\n${results.length} checks — ${results.length - failed.length} passed, ${failed.length} failed, ${findings.length} findings documented`,
  );
  if (failed.length > 0) {
    console.log('Failed checks:');
    for (const f of failed) console.log(`  - [${f.suite}] ${f.name}: ${f.details ?? ''}`);
  }
  return failed.length > 0 ? 1 : 0;
}
