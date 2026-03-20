import { test, expect } from '@playwright/test';

// ─── Smoke Tests ──────────────────────────────────────────────────
// Verify core pages render without errors and key UI elements are present.
// These tests do NOT depend on API data or a database connection.

test.describe('Homepage', () => {
  test('loads and shows the InfoHub heading', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);

    // The homepage should contain "InfoHub" in a heading or prominent element
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=InfoHub').first()).toBeVisible({ timeout: 10000 });
  });

  test('has no uncaught JS errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const realErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Loading chunk')
    );
    expect(realErrors).toHaveLength(0);
  });
});

test.describe('Navigation links', () => {
  test('header nav contains links to main pages', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for navigation to render
    const nav = page.locator('nav');
    await expect(nav.first()).toBeVisible({ timeout: 10000 });

    // Verify links to key pages exist somewhere on the page (header or mobile nav)
    await expect(page.locator('a[href="/funding"]').first()).toBeAttached();
    await expect(page.locator('a[href="/open-interest"]').first()).toBeAttached();
    await expect(page.locator('a[href="/liquidations"]').first()).toBeAttached();
  });
});

test.describe('Header component', () => {
  test('renders with navigation elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Header should be present
    const header = page.locator('header');
    await expect(header.first()).toBeVisible({ timeout: 10000 });

    // Should contain at least one nav element
    const nav = page.locator('nav');
    await expect(nav.first()).toBeAttached();

    // InfoHub logo/brand link should be present
    await expect(page.locator('a[href="/"]').first()).toBeAttached();
  });
});

test.describe('Funding page', () => {
  test('loads without error', async ({ page }) => {
    const res = await page.goto('/funding', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);

    // Should have a heading
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows exchange data table headers', async ({ page }) => {
    await page.goto('/funding', { waitUntil: 'domcontentloaded' });

    // Wait for the page content to render — look for table-like column headers
    // Common funding table headers: Symbol/Pair, Exchange, Rate, etc.
    const tableArea = page.locator('table, [role="table"], [class*="grid"]').first();
    await expect(tableArea).toBeVisible({ timeout: 15000 });

    // Verify recognizable column header text is present on the page
    const pageText = await page.locator('body').textContent();
    const hasExchangeHeader =
      pageText?.includes('Exchange') ||
      pageText?.includes('Symbol') ||
      pageText?.includes('Pair') ||
      pageText?.includes('Rate');
    expect(hasExchangeHeader).toBe(true);
  });
});
