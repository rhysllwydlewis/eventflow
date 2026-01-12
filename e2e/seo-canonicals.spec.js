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
    { path: '/blog.html', canonical: 'https://event-flow.co.uk/blog.html' },
    { path: '/suppliers.html', canonical: 'https://event-flow.co.uk/suppliers.html' },
    { path: '/marketplace', canonical: 'https://event-flow.co.uk/marketplace' },
    { path: '/pricing.html', canonical: 'https://event-flow.co.uk/pricing.html' },
    { path: '/start.html', canonical: 'https://event-flow.co.uk/start.html' },
    { path: '/for-suppliers.html', canonical: 'https://event-flow.co.uk/for-suppliers.html' },
    { path: '/faq.html', canonical: 'https://event-flow.co.uk/faq.html' },
    { path: '/contact.html', canonical: 'https://event-flow.co.uk/contact.html' },
    { path: '/privacy.html', canonical: 'https://event-flow.co.uk/privacy.html' },
    { path: '/terms.html', canonical: 'https://event-flow.co.uk/terms.html' },
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
    canonical: `https://event-flow.co.uk/articles/${article}`
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
      const ogUrlContent = await browserPage.locator('meta[property="og:url"]').getAttribute('content');

      // They must match exactly
      expect(canonicalHref).toBe(ogUrlContent);
      expect(canonicalHref).toBe(page.canonical);
    });
  }

  test('marketplace.html should redirect to /marketplace', async ({ page }) => {
    const response = await page.goto('/marketplace.html');
    
    // Should get a redirect response
    expect(response?.status()).toBe(301);
    
    // Should end up at /marketplace
    expect(page.url()).toContain('/marketplace');
  });
});
