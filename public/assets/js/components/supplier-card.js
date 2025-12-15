/**
 * SupplierCard Component
 * Displays supplier information card
 */

class SupplierCard {
  constructor(containerId, supplier = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`SupplierCard: Container ${containerId} not found`);
      return;
    }
    this.supplier = supplier;
    this.injectStyles();
    this.render();
  }

  injectStyles() {
    if (document.getElementById('supplier-card-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'supplier-card-styles';
    style.textContent = `
      .supplier-card {
        background-color: var(--color-card-bg, #ffffff);
        border: 1px solid var(--color-border, #dee2e6);
        border-radius: 12px;
        padding: 24px;
        margin-top: 24px;
      }

      .supplier-card-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }

      .supplier-card-logo {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--color-border, #dee2e6);
      }

      .supplier-card-info {
        flex: 1;
      }

      .supplier-card-name {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: var(--color-text-primary, #212529);
      }

      .supplier-card-blurb {
        font-size: 0.95rem;
        color: var(--color-text-secondary, #6c757d);
        margin: 0;
      }

      .supplier-card-description {
        font-size: 0.95rem;
        color: var(--color-text-primary, #212529);
        line-height: 1.6;
        margin-bottom: 16px;
      }

      .supplier-card-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .supplier-card-meta-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6c757d);
      }

      .supplier-card-meta-icon {
        font-size: 1.2rem;
      }

      .supplier-card-actions {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--color-border, #dee2e6);
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .supplier-card-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: background-color 0.2s ease;
      }

      .supplier-card-btn.primary {
        background-color: var(--accent, #13B6A2);
        color: white;
      }

      .supplier-card-btn.primary:hover {
        background-color: var(--ink, #0B8073);
      }

      .supplier-card-btn.secondary {
        background-color: var(--color-bg-secondary, #f8f9fa);
        color: var(--color-text-primary, #212529);
        border: 1px solid var(--color-border, #dee2e6);
      }

      .supplier-card-btn.secondary:hover {
        background-color: #e2e6ea;
      }

      @media (max-width: 768px) {
        .supplier-card-header {
          flex-direction: column;
          text-align: center;
        }

        .supplier-card-meta {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    const card = document.createElement('div');
    card.className = 'supplier-card';

    const hasLogo = this.supplier.logo && this.supplier.logo.trim() !== '';
    const logoHtml = hasLogo
      ? `<img class="supplier-card-logo" src="${this.supplier.logo}" alt="${this.supplier.name} logo">`
      : `<div class="supplier-card-logo" style="background-color: var(--accent, #13B6A2); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: 600;">${this.supplier.name ? this.supplier.name.charAt(0) : 'S'}</div>`;

    card.innerHTML = `
      <div class="supplier-card-header">
        ${logoHtml}
        <div class="supplier-card-info">
          <h2 class="supplier-card-name">${this.supplier.name || 'Supplier'}</h2>
          <p class="supplier-card-blurb">${this.supplier.blurb || this.supplier.description_short || ''}</p>
        </div>
      </div>

      ${this.supplier.description_long ? `<p class="supplier-card-description">${this.supplier.description_long}</p>` : ''}

      <div class="supplier-card-meta">
        ${this.supplier.category ? `<div class="supplier-card-meta-item"><span class="supplier-card-meta-icon">📂</span> ${this.supplier.category}</div>` : ''}
        ${this.supplier.location ? `<div class="supplier-card-meta-item"><span class="supplier-card-meta-icon">📍</span> ${this.supplier.location}</div>` : ''}
        ${this.supplier.price_display ? `<div class="supplier-card-meta-item"><span class="supplier-card-meta-icon">💰</span> ${this.supplier.price_display}</div>` : ''}
        ${this.supplier.email ? `<div class="supplier-card-meta-item"><span class="supplier-card-meta-icon">✉️</span> ${this.supplier.email}</div>` : ''}
        ${this.supplier.phone ? `<div class="supplier-card-meta-item"><span class="supplier-card-meta-icon">📞</span> ${this.supplier.phone}</div>` : ''}
        ${this.supplier.website ? `<div class="supplier-card-meta-item"><span class="supplier-card-meta-icon">🌐</span> <a href="${this.supplier.website}" target="_blank" rel="noopener">Website</a></div>` : ''}
      </div>

      <div class="supplier-card-actions">
        ${this.supplier.id ? `<button class="supplier-card-btn secondary" onclick="window.location.href='/supplier.html?id=${this.supplier.id}'">View All Packages</button>` : ''}
      </div>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(card);
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.SupplierCard = SupplierCard;
}
