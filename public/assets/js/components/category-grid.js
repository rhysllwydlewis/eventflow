/**
 * CategoryGrid Component
 * Displays a grid of category cards for browsing
 */

class CategoryGrid {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`CategoryGrid: Container ${containerId} not found`);
      return;
    }
    this.options = {
      showFeaturedPackages: false,
      ...options,
    };
    this.categories = [];
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('category-grid-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'category-grid-styles';
    style.textContent = `
      .category-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
        margin-top: 24px;
      }

      .category-card {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        background-color: var(--color-card-bg, #ffffff);
        border: 1px solid var(--color-border, #dee2e6);
      }

      .category-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .category-card-image {
        width: 100%;
        height: 200px;
        object-fit: cover;
        display: block;
      }

      .category-card-content {
        padding: 20px;
      }

      .category-card-icon {
        font-size: 32px;
        margin-bottom: 12px;
        display: block;
      }

      .category-card-name {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--color-text-primary, #212529);
      }

      .category-card-description {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6c757d);
        margin: 0;
        line-height: 1.5;
      }

      .category-empty-state {
        text-align: center;
        padding: 48px 24px;
        color: var(--color-text-secondary, #6c757d);
      }

      @media (max-width: 768px) {
        .category-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async loadCategories() {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      const data = await response.json();
      this.categories = data.items || [];
      this.render();
    } catch (error) {
      console.error('Error loading categories:', error);
      this.container.innerHTML =
        '<div class="category-empty-state">Unable to load categories. Please try again later.</div>';
    }
  }

  render() {
    if (this.categories.length === 0) {
      this.container.innerHTML =
        '<div class="category-empty-state">No categories available at the moment.</div>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'category-grid';

    this.categories.forEach(category => {
      const card = this.createCategoryCard(category);
      grid.appendChild(card);
    });

    this.container.innerHTML = '';
    this.container.appendChild(grid);
  }

  createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.onclick = () => {
      window.location.href = `/category.html?slug=${category.slug}`;
    };

    const hasImage = category.heroImage && category.heroImage.trim() !== '';
    const imageHtml = hasImage
      ? `<img class="category-card-image" src="${category.heroImage}" alt="${category.name}" loading="lazy">`
      : '';

    card.innerHTML = `
      ${imageHtml}
      <div class="category-card-content">
        ${category.icon ? `<span class="category-card-icon">${category.icon}</span>` : ''}
        <h3 class="category-card-name">${category.name}</h3>
        <p class="category-card-description">${category.description || ''}</p>
      </div>
    `;

    return card;
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.CategoryGrid = CategoryGrid;
}
