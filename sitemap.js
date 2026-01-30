/**
 * Dynamic Sitemap Generator for EventFlow
 * Generates sitemap.xml dynamically from database
 */

'use strict';

const dbUnified = require('./db-unified');

/**
 * Generate sitemap XML
 * @param {string} baseUrl - Base URL of the site
 * @returns {Promise<string>} Sitemap XML
 */
async function generateSitemap(baseUrl) {
  const now = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Static pages - only canonical, indexable URLs
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/suppliers', priority: '0.9', changefreq: 'daily' },
    { url: '/marketplace', priority: '0.9', changefreq: 'daily' },
    { url: '/blog.html', priority: '0.7', changefreq: 'weekly' },
    { url: '/start.html', priority: '0.8', changefreq: 'weekly' },
    { url: '/pricing.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/for-suppliers.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/contact.html', priority: '0.6', changefreq: 'monthly' },
    { url: '/faq.html', priority: '0.6', changefreq: 'monthly' },
    { url: '/privacy.html', priority: '0.5', changefreq: 'monthly' },
    { url: '/terms.html', priority: '0.5', changefreq: 'monthly' },
  ];

  staticPages.forEach(page => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  try {
    // Dynamic pages - Suppliers (use canonical /supplier.html?id= route)
    const suppliers = await dbUnified.read('suppliers');
    if (Array.isArray(suppliers)) {
      suppliers
        .filter(s => s.approved)
        .forEach(supplier => {
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/supplier.html?id=${supplier.id}</loc>\n`;
          xml += `    <lastmod>${supplier.updatedAt || now}</lastmod>\n`;
          xml += `    <changefreq>weekly</changefreq>\n`;
          xml += `    <priority>0.8</priority>\n`;
          xml += '  </url>\n';
        });
    }

    // Dynamic pages - Packages (use canonical /package.html?slug= route)
    const packages = await dbUnified.read('packages');
    if (Array.isArray(packages)) {
      packages.forEach(pkg => {
        // Use slug if available, fallback to id
        const identifier = pkg.slug ? `slug=${pkg.slug}` : `id=${pkg.id}`;
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/package.html?${identifier}</loc>\n`;
        xml += `    <lastmod>${pkg.updatedAt || now}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += '  </url>\n';
      });
    }

    // Dynamic pages - Articles
    const articles = [
      'wedding-venue-selection-guide.html',
      'wedding-catering-trends-2024.html',
      'perfect-wedding-day-timeline-guide.html',
      'event-photography-complete-guide.html',
      'event-budget-management-guide.html',
      'sustainable-event-planning-guide.html',
      'corporate-event-planning-guide.html',
      'birthday-party-planning-guide.html',
      'marketplace-guide.html',
    ];

    articles.forEach(article => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/articles/${article}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += '  </url>\n';
    });
  } catch (error) {
    console.error('Error generating dynamic sitemap entries:', error);
  }

  xml += '</urlset>';
  return xml;
}

/**
 * Generate robots.txt content
 * @param {string} baseUrl - Base URL of the site
 * @returns {string} Robots.txt content
 */
function generateRobotsTxt(baseUrl) {
  return `# EventFlow Robots.txt
User-agent: *
Allow: /

# Disallow API endpoints and temporary files only
# Note: We don't Disallow HTML pages (auth, dashboard, etc.) because:
# - They use X-Robots-Tag: noindex, nofollow headers
# - Google needs to crawl them to see the noindex directive
# - Disallow prevents crawling and can leave URLs indexed by reference
Disallow: /api/
Disallow: /uploads/temp/
Disallow: /*.json$

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay for specific bots
User-agent: Googlebot
Crawl-delay: 0

User-agent: Bingbot
Crawl-delay: 1
`;
}

module.exports = {
  generateSitemap,
  generateRobotsTxt,
};
