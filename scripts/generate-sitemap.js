#!/usr/bin/env node

/**
 * Sitemap Generator for EventFlow
 * Generates a sitemap.xml file in the public/ directory
 *
 * Usage: node scripts/generate-sitemap.js
 * Or: npm run sitemap
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://event-flow.co.uk';
const OUTPUT_FILE = path.join(__dirname, '../public/sitemap.xml');

// Static pages to include in the sitemap
// Format: { url, changefreq, priority }
const STATIC_PAGES = [
  // Main pages
  { url: '/', changefreq: 'weekly', priority: '1.0' },
  { url: '/start', changefreq: 'weekly', priority: '0.9' },
  { url: '/suppliers', changefreq: 'daily', priority: '0.9' },
  { url: '/marketplace', changefreq: 'daily', priority: '0.9' },
  { url: '/pricing', changefreq: 'monthly', priority: '0.8' },
  { url: '/blog', changefreq: 'weekly', priority: '0.8' },

  // Information pages
  { url: '/faq', changefreq: 'monthly', priority: '0.7' },
  { url: '/contact', changefreq: 'monthly', priority: '0.6' },
  { url: '/for-suppliers', changefreq: 'monthly', priority: '0.7' },
  { url: '/gallery', changefreq: 'weekly', priority: '0.6' },

  // Planning tools
  { url: '/plan', changefreq: 'monthly', priority: '0.7' },
  { url: '/budget', changefreq: 'monthly', priority: '0.7' },
  { url: '/timeline', changefreq: 'monthly', priority: '0.7' },
  { url: '/guests', changefreq: 'monthly', priority: '0.7' },

  // Legal pages
  { url: '/legal', changefreq: 'monthly', priority: '0.4' },
  { url: '/privacy', changefreq: 'monthly', priority: '0.4' },
  { url: '/terms', changefreq: 'monthly', priority: '0.4' },
  { url: '/data-rights', changefreq: 'monthly', priority: '0.4' },

  // Other pages
  { url: '/credits', changefreq: 'yearly', priority: '0.3' },

  // Auth pages (lower priority, but should be indexed)
  { url: '/auth', changefreq: 'yearly', priority: '0.3' },

  // Additional public pages
  { url: '/category', changefreq: 'monthly', priority: '0.6' },
  { url: '/compare', changefreq: 'monthly', priority: '0.6' },
];

// Pages to exclude from sitemap (admin, auth-required, test pages, etc.)
// eslint-disable-next-line no-unused-vars
const EXCLUDED_PAGES = [
  // Admin pages
  '/admin',
  '/admin-',

  // User-specific pages
  '/dashboard',
  '/settings',
  '/messages',
  '/conversation',
  '/my-marketplace-listings',

  // Payment/checkout pages (user-specific)
  '/checkout',
  '/payment-success',
  '/payment-cancel',

  // Detail pages that need IDs (will be added dynamically)
  '/package',
  '/supplier',

  // Test/demo pages
  '/test-',
  '/demo-',
  '/messaging-demo',

  // System pages
  '/offline',
  '/maintenance',
  '/reset-password',
  '/verify',
];

/**
 * Format date to W3C datetime format (YYYY-MM-DD)
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate XML for a single URL entry
 */
function generateUrlEntry(url, changefreq = 'monthly', priority = '0.5', lastmod = null) {
  const fullUrl = `${BASE_URL}${url}`;
  const lastmodStr = lastmod ? `\n    <lastmod>${formatDate(lastmod)}</lastmod>` : '';

  return `  <url>
    <loc>${fullUrl}</loc>${lastmodStr}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Generate the complete sitemap XML
 */
function generateSitemap() {
  const now = new Date();
  const urlEntries = STATIC_PAGES.map(page =>
    generateUrlEntry(page.url, page.changefreq, page.priority, now)
  );

  // Add comments for dynamic routes
  const dynamicRoutesComment = `
  <!-- Dynamic routes (to be added when available): -->
  <!-- Supplier profiles: /supplier?id={supplierId} -->
  <!-- Package details: /package?id={packageId} -->
  <!-- Blog posts: /blog?post={postId} -->
  <!-- Marketplace items: /marketplace?item={itemId} -->
  <!-- Note: These should be dynamically generated based on actual content in the database -->
  `;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}

${dynamicRoutesComment}
</urlset>`;

  return xml;
}

/**
 * Write sitemap to file
 */
function writeSitemap() {
  try {
    const sitemap = generateSitemap();
    fs.writeFileSync(OUTPUT_FILE, sitemap, 'utf8');
    console.log(`✅ Sitemap generated successfully: ${OUTPUT_FILE}`);
    console.log(`📊 Total URLs: ${STATIC_PAGES.length}`);
    console.log(`🌐 Base URL: ${BASE_URL}`);
    console.log(
      '\n💡 Tip: To include dynamic routes, modify this script to fetch data from your database.'
    );
  } catch (error) {
    console.error('❌ Error generating sitemap:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  writeSitemap();
}

module.exports = { generateSitemap, generateUrlEntry, formatDate };
