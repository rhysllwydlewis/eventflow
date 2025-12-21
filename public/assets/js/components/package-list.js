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
      .package-list-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 24px;
        margin-top: 24px;
      }

      .package-card {
        background-color: var(--color-card-bg, #ffffff);
        border: 1px solid var(--color-border, #dee2e6);
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        position: relative;
      }

      .package-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .package-card-featured-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        background-color: var(--accent, #13B6A2);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        z-index: 1;
      }

      .package-card-image {
        width: 100%;
        height: 220px;
        object-fit: cover;
        display: block;
      }

      .package-card-content {
        padding: 20px;
      }

      .package-card-categories {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .package-card-category-badge {
        background-color: var(--color-bg-secondary, #f8f9fa);
        color: var(--color-text-secondary, #6c757d);
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 500;
      }

      .package-card-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--color-text-primary, #212529);
      }

      .package-card-description {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6c757d);
        margin: 0 0 12px 0;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .package-card-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--color-border, #dee2e6);
      }

      .package-card-price {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--accent, #13B6A2);
      }

      .package-card-location {
        font-size: 0.85rem;
        color: var(--color-text-secondary, #6c757d);
      }

      .package-empty-state {
        text-align: center;
        padding: 48px 24px;
        color: var(--color-text-secondary, #6c757d);
      }

      @media (max-width: 768px) {
        .package-list-grid {
          grid-template-columns: 1fr;
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
    card.onclick = () => {
      window.location.href = `/package.html?slug=${pkg.slug}`;
    };

    const isFeatured = pkg.featured || pkg.isFeatured || false;
    const featuredBadge = isFeatured
      ? '<div class="package-card-featured-badge">Featured</div>'
      : '';

    const imageUrl = pkg.image || '/assets/images/placeholders/package-event.svg';

    card.innerHTML = `
      ${featuredBadge}
      <img class="package-card-image" src="${imageUrl}" alt="${pkg.title}" loading="lazy">
      <div class="package-card-content">
        <h3 class="package-card-title">${pkg.title}</h3>
        <p class="package-card-description">${pkg.description || ''}</p>
        <div class="package-card-meta">
          <div class="package-card-price">${pkg.price || 'Contact for price'}</div>
          ${pkg.location ? `<div class="package-card-location">📍 ${pkg.location}</div>` : ''}
        </div>
      </div>
    `;

    return card;
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.PackageList = PackageList;
}
