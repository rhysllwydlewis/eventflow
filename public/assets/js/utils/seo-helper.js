/**
 * SEO Metadata Helper
 * Dynamically updates page metadata for better SEO
 */

class SEOHelper {
  constructor() {
    this.defaultMeta = {
      title: 'EventFlow — Plan your event the simple way',
      description:
        'Find suppliers, build your plan and keep everything in one place — beautifully simple on mobile and desktop.',
      keywords: 'event planning, wedding planning, suppliers, venues, catering',
      author: 'EventFlow',
      type: 'website',
      image: '/assets/images/og-default.jpg',
      twitterCard: 'summary_large_image',
    };
  }

  /**
   * Update page title
   * @param {string} title - Page title
   * @param {boolean} includeSiteName - Whether to include site name
   */
  setTitle(title, includeSiteName = true) {
    const fullTitle = includeSiteName ? `${title} — EventFlow` : title;
    document.title = fullTitle;

    // Update Open Graph title
    this.setMetaTag('og:title', fullTitle);
    this.setMetaTag('twitter:title', fullTitle);
  }

  /**
   * Update page description
   * @param {string} description - Page description
   */
  setDescription(description) {
    this.setMetaTag('description', description, 'name');
    this.setMetaTag('og:description', description);
    this.setMetaTag('twitter:description', description);
  }

  /**
   * Update page keywords
   * @param {string|Array} keywords - Keywords as string or array
   */
  setKeywords(keywords) {
    const keywordString = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    this.setMetaTag('keywords', keywordString, 'name');
  }

  /**
   * Update Open Graph image
   * @param {string} imageUrl - Image URL
   * @param {Object} options - Image options (width, height, alt)
   */
  setImage(imageUrl, options = {}) {
    const fullUrl = this.getFullUrl(imageUrl);

    this.setMetaTag('og:image', fullUrl);
    this.setMetaTag('twitter:image', fullUrl);

    if (options.width) {
      this.setMetaTag('og:image:width', options.width);
    }
    if (options.height) {
      this.setMetaTag('og:image:height', options.height);
    }
    if (options.alt) {
      this.setMetaTag('og:image:alt', options.alt);
      this.setMetaTag('twitter:image:alt', options.alt);
    }
  }

  /**
   * Set canonical URL
   * @param {string} url - Canonical URL
   */
  setCanonical(url) {
    const fullUrl = this.getFullUrl(url);

    // Update or create canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = fullUrl;

    // Update Open Graph URL
    this.setMetaTag('og:url', fullUrl);
  }

  /**
   * Set page type
   * @param {string} type - Page type (website, article, product, etc.)
   */
  setType(type) {
    this.setMetaTag('og:type', type);
  }

  /**
   * Set structured data (JSON-LD)
   * @param {Object} data - Structured data object
   */
  setStructuredData(data) {
    // Remove existing structured data
    const existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) {
      existing.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /**
   * Set all metadata at once
   * @param {Object} meta - Metadata object
   */
  setAll(meta) {
    if (meta.title) {
      this.setTitle(meta.title, meta.includeSiteName !== false);
    }
    if (meta.description) {
      this.setDescription(meta.description);
    }
    if (meta.keywords) {
      this.setKeywords(meta.keywords);
    }
    if (meta.image) {
      this.setImage(meta.image, meta.imageOptions);
    }
    if (meta.canonical) {
      this.setCanonical(meta.canonical);
    }
    if (meta.type) {
      this.setType(meta.type);
    }
    if (meta.structuredData) {
      this.setStructuredData(meta.structuredData);
    }
  }

  /**
   * Set meta tag
   * @param {string} property - Meta property or name
   * @param {string} content - Meta content
   * @param {string} attribute - Attribute type (property or name)
   */
  setMetaTag(property, content, attribute = 'property') {
    let meta = document.querySelector(`meta[${attribute}="${property}"]`);

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, property);
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);
  }

  /**
   * Get the canonical base URL for SEO purposes.
   * Prefers configured EF_CANONICAL_BASE over window.location.origin
   * to ensure consistent canonical URLs in all environments.
   * @returns {string} - Canonical base URL (e.g., 'https://event-flow.co.uk')
   */
  getCanonicalBase() {
    // Prefer explicit production base URL configuration
    // This ensures canonical URLs are correct even in dev/test environments
    if (typeof window !== 'undefined' && window.EF_CANONICAL_BASE) {
      return window.EF_CANONICAL_BASE.replace(/\/$/, ''); // Remove trailing slash
    }
    // Fallback to current origin (may be localhost in dev)
    return window.location.origin;
  }

  /**
   * Get full URL from relative path (with validation)
   * @param {string} path - Relative or absolute path
   * @returns {string} - Full URL
   */
  getFullUrl(path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Prevent protocol-relative URLs (open redirect vulnerability)
    if (path.startsWith('//')) {
      throw new Error('Protocol-relative URLs are not allowed');
    }

    const baseUrl = this.getCanonicalBase();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Use URL constructor for safe URL building
    try {
      const url = new URL(cleanPath, baseUrl);
      return url.href;
    } catch (error) {
      console.error('Invalid URL:', path, error);
      return `${baseUrl}${cleanPath}`;
    }
  }

  /**
   * Generate breadcrumb structured data
   * @param {Array} items - Breadcrumb items [{ name, url }]
   * @returns {Object} - Structured data object
   */
  generateBreadcrumbs(items) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: this.getFullUrl(item.url),
      })),
    };
  }

  /**
   * Generate local business structured data
   * @param {Object} business - Business information
   * @returns {Object} - Structured data object
   */
  generateLocalBusiness(business) {
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: business.name,
      description: business.description,
      url: this.getFullUrl('/'),
      telephone: business.telephone,
      email: business.email,
      address: business.address
        ? {
            '@type': 'PostalAddress',
            streetAddress: business.address.street,
            addressLocality: business.address.city,
            addressRegion: business.address.region,
            postalCode: business.address.postalCode,
            addressCountry: business.address.country,
          }
        : undefined,
      openingHoursSpecification: business.hours
        ? business.hours.map(hours => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: hours.days,
            opens: hours.opens,
            closes: hours.closes,
          }))
        : undefined,
    };
  }

  /**
   * Generate event structured data
   * @param {Object} event - Event information
   * @returns {Object} - Structured data object
   */
  generateEvent(event) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location
        ? {
            '@type': 'Place',
            name: event.location.name,
            address: event.location.address,
          }
        : undefined,
      image: event.image ? this.getFullUrl(event.image) : undefined,
      organizer: event.organizer
        ? {
            '@type': 'Organization',
            name: event.organizer.name,
            url: event.organizer.url,
          }
        : undefined,
    };
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.seoHelper = new SEOHelper();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SEOHelper;
}
