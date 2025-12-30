/**
 * PackageList Component
 * Displays a list of packages with featured-first sorting
 */

class PackageList {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`PackageList: Container ${containerId} not found`);
      return;
    }
    this.options = {
      sortFeaturedFirst: true,
      showSupplierInfo: true,
      cardLayout: 'grid', // 'grid' or 'list'
      ...options,
    };
    this.packages = [];
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('package-list-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'package-list-styles';
    style.textContent = `
      /* Mobile-first approach: base styles for mobile */
      .package-list-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: clamp(16px, 3vw, 24px);
        margin-top: clamp(16px, 3vw, 24px);
        contain: layout style;
      }

      .package-card {
        background-color: var(--color-card-bg, #ffffff);
        border: 1px solid var(--color-border, #dee2e6);
        border-radius: clamp(8px, 2vw, 12px);
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        display: flex;
        flex-direction: column;
        contain: layout style paint;
        /* Ensure minimum touch target */
        min-height: 48px;
      }

      .package-card:hover,
      .package-card:focus {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        outline: 2px solid var(--accent, #13B6A2);
        outline-offset: 2px;
      }

      .package-card:active {
        transform: translateY(0);
      }

      .package-card-featured-badge {
        position: absolute;
        top: clamp(8px, 2vw, 12px);
        right: clamp(8px, 2vw, 12px);
        background-color: var(--accent, #13B6A2);
        color: white;
        padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px);
        border-radius: 20px;
        font-size: clamp(0.7rem, 2vw, 0.75rem);
        font-weight: 600;
        z-index: 2;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .package-card-image {
        width: 100%;
        height: clamp(180px, 40vw, 220px);
        object-fit: cover;
        display: block;
        background-color: var(--color-bg-secondary, #f8f9fa);
      }

      .package-card-content {
        padding: clamp(16px, 3vw, 20px);
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .package-card-categories {
        display: flex;
        flex-wrap: wrap;
        gap: clamp(6px, 1.5vw, 8px);
        margin-bottom: clamp(10px, 2vw, 12px);
      }

      .package-card-category-badge {
        background-color: var(--color-bg-secondary, #f8f9fa);
        color: var(--color-text-secondary, #6c757d);
        padding: 4px 10px;
        border-radius: 12px;
        font-size: clamp(0.7rem, 1.8vw, 0.75rem);
        font-weight: 500;
      }

      .package-card-title {
        font-size: clamp(1.1rem, 4vw, 1.25rem);
        font-weight: 600;
        margin: 0 0 clamp(6px, 1.5vw, 8px) 0;
        color: var(--color-text-primary, #212529);
        line-height: 1.3;
        /* Better text wrapping */
        word-wrap: break-word;
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .package-card-description {
        font-size: clamp(0.875rem, 2.2vw, 0.9rem);
        color: var(--color-text-secondary, #6c757d);
        margin: 0 0 clamp(10px, 2vw, 12px) 0;
        line-height: 1.6;
        /* Improved text truncation */
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        word-wrap: break-word;
      }

      .package-card-supplier {
        display: flex;
        align-items: center;
        gap: clamp(8px, 2vw, 10px);
        margin-bottom: clamp(10px, 2vw, 12px);
        padding: clamp(8px, 2vw, 10px);
        background-color: var(--color-bg-secondary, #f8f9fa);
        border-radius: 8px;
        /* Ensure clickable area meets WCAG AA */
        min-height: 48px;
      }

      .package-card-supplier-link {
        display: flex;
        align-items: center;
        gap: clamp(8px, 2vw, 10px);
        text-decoration: none;
        color: inherit;
        flex: 1;
        /* Ensure touch target */
        min-height: 48px;
        padding: 4px 0;
      }

      .package-card-supplier-link:hover,
      .package-card-supplier-link:focus {
        text-decoration: underline;
        color: var(--accent, #13B6A2);
      }

      .package-card-supplier-avatar {
        width: clamp(32px, 8vw, 40px);
        height: clamp(32px, 8vw, 40px);
        border-radius: 50%;
        object-fit: cover;
        background-color: var(--color-border, #dee2e6);
        flex-shrink: 0;
      }

      .package-card-supplier-name {
        font-size: clamp(0.8rem, 2vw, 0.85rem);
        font-weight: 500;
        color: var(--color-text-primary, #212529);
      }

      .package-card-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: clamp(8px, 2vw, 12px);
        margin-top: auto;
        padding-top: clamp(10px, 2vw, 12px);
        border-top: 1px solid var(--color-border, #dee2e6);
      }

      .package-card-price {
        font-size: clamp(1rem, 2.5vw, 1.1rem);
        font-weight: 600;
        color: var(--accent, #13B6A2);
        white-space: nowrap;
      }

      .package-card-location {
        font-size: clamp(0.8rem, 2vw, 0.85rem);
        color: var(--color-text-secondary, #6c757d);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .package-empty-state {
        text-align: center;
        padding: clamp(32px, 8vw, 48px) clamp(16px, 4vw, 24px);
        color: var(--color-text-secondary, #6c757d);
      }

      /* Tablet and larger screens */
      @media (min-width: 600px) {
        .package-list-grid {
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }
      }

      /* Desktop screens */
      @media (min-width: 1024px) {
        .package-list-grid {
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        }

        .package-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
      }

      /* Reduce motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        .package-card {
          transition: none;
        }

        .package-card:hover {
          transform: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setPackages(packages) {
    this.packages = packages;
    if (this.options.sortFeaturedFirst) {
      this.sortFeaturedFirst();
    }
    this.render();
  }

  sortFeaturedFirst() {
    this.packages.sort((a, b) => {
      const aFeatured = a.featured === true || a.isFeatured === true;
      const bFeatured = b.featured === true || b.isFeatured === true;
      if (aFeatured && !bFeatured) {
        return -1;
      }
      if (!aFeatured && bFeatured) {
        return 1;
      }
      return 0;
    });
  }

  render() {
    if (this.packages.length === 0) {
      this.container.innerHTML = `
        <div class="package-empty-state">
          <p>No packages available in this category yet.</p>
          <p class="small">Check back soon for new offerings!</p>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'package-list-grid';

    this.packages.forEach(pkg => {
      const card = this.createPackageCard(pkg);
      grid.appendChild(card);
    });

    this.container.innerHTML = '';
    this.container.appendChild(grid);
  }

  createPackageCard(pkg) {
    const card = document.createElement('div');
    card.className = 'package-card';
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');

    // Make card keyboard accessible
    card.addEventListener('click', e => {
      // Don't navigate if clicking on supplier link
      if (e.target.closest('.package-card-supplier-link')) {
        return;
      }
      // Properly encode slug for URL to prevent XSS
      const safeSlug = encodeURIComponent(pkg.slug || '');
      window.location.href = `/package.html?slug=${safeSlug}`;
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Properly encode slug for URL to prevent XSS
        const safeSlug = encodeURIComponent(pkg.slug || '');
        window.location.href = `/package.html?slug=${safeSlug}`;
      }
    });

    const isFeatured = pkg.featured || pkg.isFeatured || false;
    const featuredBadge = isFeatured
      ? '<div class="package-card-featured-badge">Featured</div>'
      : '';

    // Escape HTML to prevent XSS
    const escapeHtml = str => {
      if (!str) {
        return '';
      }
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    const imageUrl = escapeHtml(pkg.image || '/assets/images/placeholders/package-event.svg');
    const slug = escapeHtml(String(pkg.slug || ''));
    const title = escapeHtml(pkg.title);
    const description = escapeHtml(pkg.description || '');
    // Use price_display as primary source, fallback to price for consistency across all views
    const priceValue = pkg.price_display || pkg.price || 'Contact for price';
    const price = escapeHtml(priceValue);
    const location = pkg.location ? escapeHtml(pkg.location) : '';

    // Build supplier info section if available
    let supplierHtml = '';
    if (this.options.showSupplierInfo && pkg.supplier) {
      const supplierName = escapeHtml(pkg.supplier.name || pkg.supplierName || 'Unknown Supplier');
      const rawSupplierId = pkg.supplier.id || pkg.supplierId;
      const supplierId = rawSupplierId ? encodeURIComponent(String(rawSupplierId)) : '';
      const supplierAvatar = escapeHtml(
        pkg.supplier.avatar || pkg.supplierAvatar || '/assets/images/placeholders/avatar.svg'
      );

      if (supplierId) {
        supplierHtml = `
          <div class="package-card-supplier">
            <a href="/supplier.html?id=${supplierId}" class="package-card-supplier-link" data-supplier-link>
              <img src="${supplierAvatar}" alt="${supplierName}" class="package-card-supplier-avatar" loading="lazy">
              <span class="package-card-supplier-name">${supplierName}</span>
            </a>
          </div>
        `;
      } else {
        supplierHtml = `
          <div class="package-card-supplier">
            <div class="package-card-supplier-link">
              <img src="${supplierAvatar}" alt="${supplierName}" class="package-card-supplier-avatar" loading="lazy">
              <span class="package-card-supplier-name">${supplierName}</span>
            </div>
          </div>
        `;
      }
    }

    card.innerHTML = `
      ${featuredBadge}
      <img class="package-card-image" src="${imageUrl}" alt="${title}" loading="lazy">
      <div class="package-card-content">
        <h3 class="package-card-title">${title}</h3>
        <p class="package-card-description">${description}</p>
        ${supplierHtml}
        <div class="package-card-meta">
          <div class="package-card-price">${price}</div>
          ${location ? `<div class="package-card-location"><span aria-hidden="true">📍</span> ${location}</div>` : ''}
        </div>
      </div>
    `;

    // Add event listener to supplier link to stop propagation
    const supplierLink = card.querySelector('[data-supplier-link]');
    if (supplierLink) {
      supplierLink.addEventListener('click', e => {
        e.stopPropagation();
      });
    }

    return card;
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.PackageList = PackageList;
}
