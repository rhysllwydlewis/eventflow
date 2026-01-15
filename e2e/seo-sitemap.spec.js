import { test, expect } from '@playwright/test';

/**
 * Sitemap Content Tests
 *
 * Tests that sitemap.xml contains the correct URLs:
 * - Should include canonical URLs like /marketplace
 * - Should NOT include non-canonical URLs like /index.html or /auth.html
 */

test.describe('Sitemap Content', () => {
  test('sitemap.xml should be accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');

    // Should return 200 OK
    expect(response?.status()).toBe(200);

    // Should have XML content type
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('xml');
  });

  test('sitemap.xml should include /marketplace', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should include the canonical marketplace URL
    expect(content).toContain('/marketplace');
  });

  test('sitemap.xml should NOT include /index.html', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should not include /index.html (it's a duplicate of /)
    expect(content).not.toContain('/index.html');
  });

  test('sitemap.xml should NOT include /auth.html', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should not include /auth.html (it's a login page, not for indexing)
    expect(content).not.toContain('/auth.html');
  });

  test('sitemap.xml should include root URL', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should include the root URL
    // The URL will contain the base URL, so we just check for the closing tag after the base
    expect(content).toMatch(/<loc>[^<]*\/<\/loc>/);
  });

  test('sitemap.xml should include public pages', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should include key public pages
    expect(content).toContain('/suppliers.html');
    expect(content).toContain('/blog.html');
    expect(content).toContain('/pricing.html');
  });

  test('sitemap.xml should NOT include dashboard pages', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should not include private dashboard pages
    expect(content).not.toContain('/dashboard.html');
    expect(content).not.toContain('/dashboard-customer.html');
    expect(content).not.toContain('/dashboard-supplier.html');
  });

  test('sitemap.xml should be valid XML', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    const content = await response?.text();

    // Should start with XML declaration
    expect(content).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);

    // Should have urlset root element
    expect(content).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(content).toContain('</urlset>');
  });
});
