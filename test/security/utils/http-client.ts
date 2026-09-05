import axios from 'axios';

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/** validateStatus always true so we can assert on any status code without axios throwing. */
export const client = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
  timeout: 15000,
});

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
