import { Page, expect } from '@playwright/test';

/**
 * Collect console errors during a test. Call the returned function at the end
 * to assert zero critical console errors.
 */
export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      errors.push(msg.text());
    }
  });
  return () => {
    const critical = errors.filter(
      e =>
        !e.includes('ResizeObserver') &&
        !e.includes('Loading chunk') &&
        !e.includes('hydration'),
    );
    expect(critical, 'Console errors detected').toHaveLength(0);
  };
}

/**
 * Collect network failures (status >= 400). Call the returned function to assert.
 */
export async function expectNoNetworkFailures(page: Page, ignorePaths: string[] = []) {
  const failures: string[] = [];
  page.on('response', res => {
    if (res.status() >= 400 && !ignorePaths.some(p => res.url().includes(p))) {
      failures.push(`${res.status()} ${res.url()}`);
    }
  });
  return () => expect(failures, 'Network failures detected').toHaveLength(0);
}

/** Wait for network idle (data loaded). */
export async function waitForDataLoad(page: Page, timeout = 15000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/** Assert a string like "$1.23K" or "+4.5%" is a valid number, not NaN/Infinity. */
export function expectValidNumber(text: string | null, label: string) {
  expect(text, `${label} should not be null`).not.toBeNull();
  const cleaned = text!.replace(/[$,%+\-KMBk\s]/g, '');
  const num = parseFloat(cleaned);
  expect(Number.isNaN(num), `${label} "${text}" is NaN`).toBe(false);
  expect(Number.isFinite(num), `${label} "${text}" is Infinite`).toBe(true);
}
