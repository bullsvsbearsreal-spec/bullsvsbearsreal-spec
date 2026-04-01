import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('login page renders form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /log.?in|sign.?in/i })).toBeVisible();
  });

  test('signup page renders form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('forgot password page is accessible', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"], input[name="email"]').fill('invalid@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForTimeout(2000);

    // Should show an error, not crash
    const body = await page.locator('body').textContent();
    expect(body?.toLowerCase()).toMatch(/error|invalid|incorrect|failed/);
  });

  test('protected pages redirect to login', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(2000);

    // Should redirect to login or show auth gate
    const url = page.url();
    const body = await page.locator('body').textContent();
    const isProtected = url.includes('login') || body?.toLowerCase().includes('sign in') || body?.toLowerCase().includes('log in');
    expect(isProtected).toBe(true);
  });
});
