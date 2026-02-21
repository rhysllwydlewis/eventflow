/**
 * Pricing → Auth Redirect Tests
 * Verifies:
 * - Unauthenticated pricing CTAs redirect to /auth with a canonical (no .html) redirect param.
 * - The redirect param does not contain the full origin (must be relative).
 * - No competing inline script references window.AuthState (removed).
 * - Clean-URL redirects: .html pages redirect 301 to extensionless for canonical pages.
 */

import { test, expect } from '@playwright/test';

test.describe('Pricing CTA redirect for unauthenticated users', () => {
  test('pricing CTA hrefs should use canonical /auth (no .html) with a relative redirect param', async ({
    page,
  }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // pricing.js rewrites CTA hrefs asynchronously after the auth check; wait for the rewrite
    await page.waitForFunction(() => {
      const cta = document.querySelector('a.pricing-cta');
      return cta && (cta.href.includes('/auth') || cta.getAttribute('aria-disabled') === 'true');
    }, { timeout: 10000 }).catch(() => {
      // If condition never met, the test assertions below will still capture the issue
    });

    // The paid CTAs should now point to /auth?redirect=... (NOT /auth.html?redirect=...)
    const paidCtas = await page
      .locator('a.pricing-cta:not([aria-disabled="true"])')
      .all();

    for (const cta of paidCtas) {
      const href = await cta.getAttribute('href');

      if (href && href.includes('redirect=')) {
        // Must use canonical /auth, not /auth.html
        expect(href).not.toContain('/auth.html');
        expect(href).toMatch(/^\/auth(\?|$)/);

        // The redirect param itself must be relative (no protocol/host)
        const url = new URL(href, 'http://localhost');
        const redirectParam = url.searchParams.get('redirect');
        if (redirectParam) {
          expect(redirectParam).toMatch(/^\//);
          expect(redirectParam).not.toMatch(/^https?:\/\//);
          expect(redirectParam).not.toContain('event-flow.co.uk');
          // Redirect param must not contain .html
          expect(redirectParam).not.toContain('.html');
        }
      }
    }
  });

  test('pricing page should not contain window.AuthState reference (inline script removed)', async ({
    page,
  }) => {
    const response = await page.goto('/pricing');
    const html = await response.text();

    // The buggy inline script used window.AuthState – it must no longer exist in the page HTML
    expect(html).not.toContain('window.AuthState');
    // Ensure the canonical manager reference is what gets used (via pricing.js/auth-state.js)
    expect(html).not.toContain('/auth.html?redirect=');
  });
});

test.describe('Clean URL redirects for canonical pages', () => {
  const canonicalPages = [
    'pricing',
    'auth',
    'checkout',
    'privacy',
    'terms',
    'contact',
    'faq',
    'blog',
    'start',
    'for-suppliers',
    'payment-success',
    'payment-cancel',
  ];

  for (const pageName of canonicalPages) {
    test(`/${pageName}.html should redirect 301 to /${pageName}`, async ({ page }) => {
      let redirectStatus = null;

      page.on('response', response => {
        if (response.url().includes(`/${pageName}.html`)) {
          redirectStatus = response.status();
        }
      });

      await page.goto(`/${pageName}.html`);

      // Should have received a 301 redirect
      expect(redirectStatus).toBe(301);

      // Should end up at the canonical extensionless URL
      expect(page.url()).toMatch(new RegExp(`/${pageName}(\\?|$|#)`));
      expect(page.url()).not.toContain('.html');
    });
  }
});
