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

  // Static pages
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/index.html', priority: '1.0', changefreq: 'daily' },
    { url: '/auth.html', priority: '0.8', changefreq: 'weekly' },
    { url: '/suppliers.html', priority: '0.9', changefreq: 'daily' },
    { url: '/packages.html', priority: '0.9', changefreq: 'daily' },
    { url: '/blog.html', priority: '0.7', changefreq: 'weekly' },
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
    // Dynamic pages - Suppliers
    const suppliers = await dbUnified.read('suppliers');
    if (Array.isArray(suppliers)) {
      suppliers
        .filter(s => s.approved)
        .forEach(supplier => {
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/supplier-detail.html?id=${supplier.id}</loc>\n`;
          xml += `    <lastmod>${supplier.updatedAt || now}</lastmod>\n`;
          xml += `    <changefreq>weekly</changefreq>\n`;
          xml += `    <priority>0.8</priority>\n`;
          xml += '  </url>\n';
        });
    }

    // Dynamic pages - Packages
    const packages = await dbUnified.read('packages');
    if (Array.isArray(packages)) {
      packages.forEach(pkg => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/package-detail.html?id=${pkg.id}</loc>\n`;
        xml += `    <lastmod>${pkg.updatedAt || now}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += '  </url>\n';
      });
    }

    // Dynamic pages - Categories
    const categories = [
      'venues',
      'catering',
      'photography',
      'videography',
      'florists',
      'entertainment',
      'decorators',
      'planners',
    ];

    categories.forEach(category => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/category.html?category=${category}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
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
Disallow: /admin*
Disallow: /dashboard*
Disallow: /api/
Disallow: /uploads/temp/
Disallow: *.json$

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
