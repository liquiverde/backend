/** GS1 prefix for Chile — matches the example barcode used in the API docs. */
const DEFAULT_PREFIX = '780';

function checkDigit(twelveDigits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Generates a structurally valid EAN-13 barcode (correct check digit) from a sequence number. */
export function generateEan13(
  sequence: number,
  prefix = DEFAULT_PREFIX,
): string {
  const body = prefix + String(sequence).padStart(12 - prefix.length, '0');
  return body + String(checkDigit(body));
}
