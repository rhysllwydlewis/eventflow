import { test, expect } from '@playwright/test';

/**
 * SEO Canonicals E2E Tests
 *
 * Tests that all public pages have:
 * - <link rel="canonical"> tag
 * - <meta property="og:url"> tag
 * - Both tags must match and use the correct canonical URL
 */

test.describe('SEO Canonicals', () => {
  const publicPages = [
    { path: '/', canonical: 'https://event-flow.co.uk/' },
    { path: '/blog', canonical: 'https://event-flow.co.uk/blog' },
    { path: '/suppliers', canonical: 'https://event-flow.co.uk/suppliers' },
    { path: '/marketplace', canonical: 'https://event-flow.co.uk/marketplace' },
    { path: '/pricing', canonical: 'https://event-flow.co.uk/pricing' },
    { path: '/start', canonical: 'https://event-flow.co.uk/start' },
    { path: '/for-suppliers', canonical: 'https://event-flow.co.uk/for-suppliers' },
    { path: '/faq', canonical: 'https://event-flow.co.uk/faq' },
    { path: '/contact', canonical: 'https://event-flow.co.uk/contact' },
    { path: '/privacy', canonical: 'https://event-flow.co.uk/privacy' },
    { path: '/terms', canonical: 'https://event-flow.co.uk/terms' },
  ];

  const articlePages = [
    'wedding-venue-selection-guide.html',
    'wedding-catering-trends-2024.html',
    'perfect-wedding-day-timeline-guide.html',
    'event-photography-complete-guide.html',
    'event-budget-management-guide.html',
    'sustainable-event-planning-guide.html',
    'corporate-event-planning-guide.html',
    'birthday-party-planning-guide.html',
  ].map(article => ({
    path: `/articles/${article}`,
    canonical: `https://event-flow.co.uk/articles/${article}`,
  }));

  const allPages = [...publicPages, ...articlePages];

  for (const page of allPages) {
    test(`${page.path} should have canonical tag`, async ({ page: browserPage }) => {
      await browserPage.goto(page.path);

      // Check for canonical link tag
      const canonicalLink = browserPage.locator('link[rel="canonical"]');
      await expect(canonicalLink).toBeAttached();

      // Verify canonical URL
      const canonicalHref = await canonicalLink.getAttribute('href');
      expect(canonicalHref).toBe(page.canonical);
    });

    test(`${page.path} should have og:url meta tag`, async ({ page: browserPage }) => {
      await browserPage.goto(page.path);

      // Check for og:url meta tag
      const ogUrl = browserPage.locator('meta[property="og:url"]');
      await expect(ogUrl).toBeAttached();

      // Verify og:url matches canonical
      const ogUrlContent = await ogUrl.getAttribute('content');
      expect(ogUrlContent).toBe(page.canonical);
    });

    test(`${page.path} canonical and og:url should match`, async ({ page: browserPage }) => {
      await browserPage.goto(page.path);

      // Get both values
      const canonicalHref = await browserPage.locator('link[rel="canonical"]').getAttribute('href');
      const ogUrlContent = await browserPage
        .locator('meta[property="og:url"]')
        .getAttribute('content');

      // They must match exactly
      expect(canonicalHref).toBe(ogUrlContent);
      expect(canonicalHref).toBe(page.canonical);
    });
  }

  // Canonical URL redirect tests
  // These verify that non-canonical URLs (with .html) redirect to canonical versions
  const redirectTests = [
    { from: '/marketplace.html', to: '/marketplace', urlMatcher: '/marketplace.html' },
    { from: '/suppliers.html', to: '/suppliers', urlMatcher: '/suppliers.html' },
    { from: '/index.html', to: '/', urlMatcher: '/index.html' },
  ];

  for (const redirect of redirectTests) {
    test(`${redirect.from} should redirect to ${redirect.to}`, async ({ page }) => {
      // Track the initial redirect response
      let redirectStatus = null;
      page.on('response', response => {
        if (response.url().includes(redirect.urlMatcher)) {
          redirectStatus = response.status();
        }
      });

      await page.goto(redirect.from);

      // Should get a redirect response (301) - captured before following
      expect(redirectStatus).toBe(301);

      // Should end up at the canonical URL
      const finalUrl = page.url();
      if (redirect.to === '/') {
        expect(finalUrl.endsWith('/') || finalUrl === page.context()._options.baseURL).toBe(true);
      } else {
        expect(finalUrl).toContain(redirect.to);
      }
    });
  }
});
