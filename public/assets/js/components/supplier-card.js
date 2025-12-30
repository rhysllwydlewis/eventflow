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
        padding: 32px;
        margin-top: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .supplier-card-header {
        display: flex;
        align-items: flex-start;
        gap: 24px;
        margin-bottom: 24px;
        width: 100%;
      }

      .supplier-card-logo {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--color-border, #dee2e6);
        flex-shrink: 0;
        background-color: var(--color-bg-secondary, #f8f9fa);
      }

      .supplier-card-info {
        flex: 1;
        min-width: 0;
        width: 100%;
        display: block;
      }

      .supplier-card-name {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--color-text-primary, #212529);
        line-height: 1.3;
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: normal;
        display: block;
        width: 100%;
      }

      .supplier-card-blurb {
        font-size: 1rem;
        color: var(--color-text-secondary, #6c757d);
        margin: 0 0 12px 0;
        line-height: 1.5;
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: normal;
        display: block;
        width: 100%;
      }

      .supplier-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
        width: 100%;
      }

      .supplier-card-description {
        font-size: 0.95rem;
        color: var(--color-text-primary, #212529);
        line-height: 1.7;
        margin-bottom: 20px;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .supplier-card-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 20px;
        padding: 20px 0;
        border-top: 1px solid var(--color-border, #dee2e6);
        border-bottom: 1px solid var(--color-border, #dee2e6);
      }

      .supplier-card-meta-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.95rem;
        color: var(--color-text-secondary, #6c757d);
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .supplier-card-meta-icon {
        font-size: 1.3rem;
        flex-shrink: 0;
      }

      .supplier-card-actions {
        margin-top: 24px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }

      .supplier-card-btn {
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }

      .supplier-card-btn.primary {
        background-color: var(--accent, #13B6A2);
        color: white;
        box-shadow: 0 2px 4px rgba(19, 182, 162, 0.2);
      }

      .supplier-card-btn.primary:hover {
        background-color: var(--ink, #0B8073);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(19, 182, 162, 0.3);
      }

      .supplier-card-btn.secondary {
        background-color: var(--color-bg-secondary, #f8f9fa);
        color: var(--color-text-primary, #212529);
        border: 1px solid var(--color-border, #dee2e6);
      }

      .supplier-card-btn.secondary:hover {
        background-color: #e2e6ea;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      /* Desktop-specific improvements */
      @media (min-width: 769px) {
        .supplier-card {
          padding: 40px;
        }

        .supplier-card-header {
          gap: 32px;
        }

        .supplier-card-logo {
          width: 120px;
          height: 120px;
        }
      }

      @media (max-width: 768px) {
        .supplier-card {
          padding: 20px;
        }

        .supplier-card-header {
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }

        .supplier-card-logo {
          width: 90px;
          height: 90px;
        }

        .supplier-card-meta {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .supplier-card-actions {
          flex-direction: column;
          width: 100%;
        }

        .supplier-card-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  renderBadges() {
    const badges = [];

    // Founding supplier badge
    if (this.supplier.isFounding) {
      badges.push('<span class="badge badge-founding">Founding Supplier</span>');
    }

    // Pro/Featured tier badges
    if (this.supplier.subscription) {
      if (this.supplier.subscription.tier === 'featured') {
        badges.push('<span class="badge badge-featured">Featured</span>');
      } else if (this.supplier.subscription.tier === 'pro') {
        badges.push('<span class="badge badge-pro">Pro</span>');
      }
    } else if (this.supplier.isPro) {
      badges.push('<span class="badge badge-pro">Pro</span>');
    }

    // Verification badges
    if (this.supplier.verifications) {
      if (this.supplier.verifications.email && this.supplier.verifications.email.verified) {
        badges.push('<span class="badge badge-email-verified">Email Verified</span>');
      }
      if (this.supplier.verifications.phone && this.supplier.verifications.phone.verified) {
        badges.push('<span class="badge badge-phone-verified">Phone Verified</span>');
      }
      if (this.supplier.verifications.business && this.supplier.verifications.business.verified) {
        badges.push('<span class="badge badge-business-verified">Business Verified</span>');
      }
    }

    return badges.length > 0 ? `<div class="supplier-badges">${badges.join('')}</div>` : '';
  }

  render() {
    // Ensure badges CSS is loaded
    if (!document.getElementById('badges-css')) {
      const link = document.createElement('link');
      link.id = 'badges-css';
      link.rel = 'stylesheet';
      link.href = '/assets/css/badges.css';
      document.head.appendChild(link);
    }

    const card = document.createElement('div');
    card.className = 'supplier-card';

    const hasLogo = this.supplier.logo && this.supplier.logo.trim() !== '';
    const logoHtml = hasLogo
      ? `<img class="supplier-card-logo" src="${this.supplier.logo}" alt="${this.supplier.name} logo">`
      : `<div class="supplier-card-logo" style="background-color: var(--accent, #13B6A2); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: 600;">${this.supplier.name ? this.supplier.name.charAt(0) : 'S'}</div>`;

    const badgesHtml = this.renderBadges();

    card.innerHTML = `
      <div class="supplier-card-header">
        ${logoHtml}
        <div class="supplier-card-info">
          <h2 class="supplier-card-name">${this.supplier.name || 'Supplier'}</h2>
          <p class="supplier-card-blurb">${this.supplier.blurb || this.supplier.description_short || ''}</p>
          ${badgesHtml}
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
        ${this.supplier.id ? `<button class="supplier-card-btn primary" onclick="window.location.href='/supplier.html?id=${this.supplier.id}'">View Profile</button>` : ''}
        ${this.supplier.id ? `<button class="supplier-card-btn secondary" onclick="window.location.href='/supplier.html?id=${this.supplier.id}#packages'">View All Packages</button>` : ''}
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
