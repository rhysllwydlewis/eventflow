/**
 * Supplier Profile Page - Reviews and Package Cards
 * Handles reviews loading and package card interactions
 * Phase 1: Added hero section rendering and SEO meta tags
 */

(function () {
  'use strict';

  let supplierId = null;
  let supplierData = null;

  /**
   * Update SEO meta tags dynamically based on supplier data
   * @param {Object} supplier - Supplier data
   */
  function updateMetaTags(supplier) {
    if (!supplier) {
      return;
    }

    const title = `${supplier.name} — EventFlow`;
    const description =
      supplier.metaDescription ||
      supplier.description ||
      `View ${supplier.name} on EventFlow - the UK's leading event planning platform.`;
    const image =
      supplier.openGraphImage ||
      supplier.coverImage ||
      supplier.logo ||
      'https://event-flow.co.uk/assets/images/eventflow-og-image.jpg';
    const url = `https://event-flow.co.uk/supplier.html?id=${supplier.id}`;

    // Update page title
    document.title = title;
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
      pageTitle.textContent = title;
    }

    // Update meta description
    const metaDesc = document.getElementById('meta-description');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }

    // Update Open Graph tags
    const ogTitle = document.getElementById('og-title');
    if (ogTitle) {
      ogTitle.setAttribute('content', title);
    }

    const ogDesc = document.getElementById('og-description');
    if (ogDesc) {
      ogDesc.setAttribute('content', description);
    }

    const ogImage = document.getElementById('og-image');
    if (ogImage) {
      ogImage.setAttribute('content', image);
    }

    const ogUrl = document.getElementById('og-url');
    if (ogUrl) {
      ogUrl.setAttribute('content', url);
    }

    // Update Twitter Card tags
    const twitterTitle = document.getElementById('twitter-title');
    if (twitterTitle) {
      twitterTitle.setAttribute('content', title);
    }

    const twitterDesc = document.getElementById('twitter-description');
    if (twitterDesc) {
      twitterDesc.setAttribute('content', description);
    }

    const twitterImage = document.getElementById('twitter-image');
    if (twitterImage) {
      twitterImage.setAttribute('content', image);
    }

    const twitterUrl = document.getElementById('twitter-url');
    if (twitterUrl) {
      twitterUrl.setAttribute('content', url);
    }
  }

  /**
   * Render hero section with supplier data
   * @param {Object} supplier - Supplier data
   */
  function renderHeroSection(supplier) {
    if (!supplier) {
      return;
    }

    // Update banner image
    const heroBanner = document.getElementById('hero-banner');
    if (heroBanner && supplier.coverImage) {
      heroBanner.src = supplier.coverImage;
      heroBanner.alt = `${supplier.name} banner`;
    }

    // Render badges
    const badgesContainer = document.getElementById('hero-badges');
    if (badgesContainer) {
      const badges = [];

      if (supplier.verified) {
        badges.push(
          '<span class="badge badge-verified" aria-label="Verified supplier">✓ Verified</span>'
        );
      }

      if (supplier.isPro) {
        const now = new Date();
        const proExpiry = supplier.proExpiresAt ? new Date(supplier.proExpiresAt) : null;
        const isProActive = !proExpiry || proExpiry > now;

        if (isProActive) {
          // Check if Pro+ based on some criteria (could be a separate field)
          const isProPlus = supplier.proTier === 'plus' || supplier.isPro === 'plus';
          if (isProPlus) {
            badges.push(
              '<span class="badge badge-pro-plus" aria-label="Pro Plus supplier">⭐ Pro+</span>'
            );
          } else {
            badges.push('<span class="badge badge-pro" aria-label="Pro supplier">✨ Pro</span>');
          }
        }
      }

      badgesContainer.innerHTML = badges.join('');
    }

    // Update title
    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) {
      heroTitle.textContent = supplier.name;
    }

    // Update breadcrumb
    const breadcrumbName = document.getElementById('breadcrumb-supplier-name');
    if (breadcrumbName) {
      breadcrumbName.textContent = supplier.name;
    }

    // Update tagline
    const heroTagline = document.getElementById('hero-tagline');
    if (heroTagline) {
      heroTagline.textContent = supplier.tagline || supplier.description?.substring(0, 150) || '';
      heroTagline.style.display = heroTagline.textContent ? 'block' : 'none';
    }

    // Render meta information
    const heroMeta = document.getElementById('hero-meta');
    if (heroMeta) {
      const metaItems = [];

      // Rating
      if (supplier.rating && supplier.reviewCount) {
        metaItems.push(`
          <div class="meta-item meta-rating">
            <span class="star-icon" aria-hidden="true">⭐</span>
            <span>${supplier.rating.toFixed(1)} (${supplier.reviewCount} reviews)</span>
          </div>
        `);
      }

      // Location
      if (supplier.location) {
        metaItems.push(`
          <div class="meta-item meta-location">
            <span aria-hidden="true">📍</span>
            <span>${supplier.location}${supplier.postcode ? `, ${supplier.postcode}` : ''}</span>
          </div>
        `);
      }

      // Price range
      if (supplier.priceRange) {
        metaItems.push(`
          <div class="meta-item meta-price">
            <span aria-hidden="true">💰</span>
            <span>${supplier.priceRange}</span>
          </div>
        `);
      }

      heroMeta.innerHTML = metaItems.join('');
    }

    // Setup CTA buttons
    const btnEnquiry = document.getElementById('btn-enquiry');
    if (btnEnquiry) {
      btnEnquiry.onclick = () => {
        // TODO: Open enquiry modal
        alert('Enquiry form coming soon!');
      };
    }

    const btnCall = document.getElementById('btn-call');
    if (btnCall && supplier.phone) {
      btnCall.href = `tel:${supplier.phone}`;
      btnCall.style.display = 'inline-flex';
    } else if (btnCall) {
      btnCall.style.display = 'none';
    }

    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
      btnSave.onclick = () => {
        // TODO: Save to favorites
        alert('Save feature coming soon!');
      };
    }

    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
      btnShare.onclick = async () => {
        const shareData = {
          title: supplier.name,
          text: supplier.description || `Check out ${supplier.name} on EventFlow`,
          url: window.location.href,
        };

        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('Error sharing:', err);
            }
          }
        } else {
          // Fallback: Copy to clipboard
          navigator.clipboard.writeText(window.location.href);
          alert('Link copied to clipboard!');
        }
      };
    }
  }

  /**
   * Load supplier data and render hero
   */
  async function loadSupplierData() {
    if (!supplierId) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load supplier data');
      }

      supplierData = await response.json();

      // Update meta tags
      updateMetaTags(supplierData);

      // Render hero section
      renderHeroSection(supplierData);
    } catch (error) {
      console.error('Error loading supplier data:', error);
      const heroTitle = document.getElementById('hero-title');
      if (heroTitle) {
        heroTitle.textContent = 'Supplier Not Found';
      }
    }
  }

  /**
   * Initialize supplier profile page
   */
  function init() {
    const urlParams = new URLSearchParams(window.location.search);
    supplierId = urlParams.get('id');

    if (!supplierId) {
      console.warn('No supplier ID found');
      return;
    }

    loadSupplierData();
    loadReviews();
    initializePackageCards();
  }

  /**
   * Load reviews for supplier
   */
  async function loadReviews() {
    const reviewsContainer = document.getElementById('reviews-container');
    if (!reviewsContainer) {
      return;
    }

    showLoadingState(reviewsContainer);

    try {
      const response = await fetch(`/api/v1/reviews?supplierId=${supplierId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load reviews');
      }

      const data = await response.json();
      const reviews = data.reviews || data.items || [];

      if (reviews.length === 0) {
        showEmptyState(reviewsContainer);
      } else {
        renderReviews(reviewsContainer, reviews);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      showErrorState(reviewsContainer, error.message);
    }
  }

  /**
   * Show loading state
   */
  function showLoadingState(container) {
    container.innerHTML = `
      <div class="reviews-loading" style="text-align: center; padding: 2rem;">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p>Loading reviews...</p>
      </div>
    `;
  }

  /**
   * Show empty state
   */
  function showEmptyState(container) {
    container.innerHTML = `
      <div class="reviews-empty" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; opacity: 0.5;">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <h3 style="margin-bottom: 0.5rem;">No reviews yet</h3>
        <p>Be the first to review this supplier</p>
      </div>
    `;
  }

  /**
   * Show error state with retry button
   */
  function showErrorState(container, errorMessage) {
    container.innerHTML = `
      <div class="reviews-error" style="text-align: center; padding: 3rem 1rem;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: #ef4444; opacity: 0.8;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h3 style="margin-bottom: 0.5rem; color: #ef4444;">Failed to load reviews</h3>
        <p style="color: var(--muted); margin-bottom: 1rem;">${escapeHtml(errorMessage)}</p>
        <button id="retry-reviews-btn" class="btn btn-primary">Retry</button>
      </div>
    `;

    document.getElementById('retry-reviews-btn').addEventListener('click', loadReviews);
  }

  /**
   * Render reviews
   */
  function renderReviews(container, reviews) {
    const reviewsHTML = reviews
      .map(review => {
        const rating = Math.max(1, Math.min(5, review.rating || 0));
        const starsHTML = generateStarRating(rating);

        return `
        <div class="review-card" style="padding: 1.5rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
              <div class="review-stars" style="margin-bottom: 0.5rem;" aria-label="${rating} out of 5 stars">
                ${starsHTML}
              </div>
              <div style="font-weight: 500;">${escapeHtml(review.customerName || 'Anonymous')}</div>
              <div class="small" style="color: var(--muted);">${formatDate(review.createdAt)}</div>
            </div>
          </div>
          <div class="review-content" data-review-index="${reviews.indexOf(review)}"></div>
        </div>
      `;
      })
      .join('');

    container.innerHTML = `
      <div class="reviews-list">
        <h2 style="margin-bottom: 1.5rem;">Customer Reviews</h2>
        ${reviewsHTML}
      </div>
    `;

    reviews.forEach((review, index) => {
      const reviewElement = container.querySelector(`[data-review-index="${index}"]`);
      if (reviewElement) {
        reviewElement.textContent = review.comment || review.content || 'No comment provided';
      }
    });
  }

  /**
   * Generate star rating HTML
   */
  function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let html = '';

    for (let i = 0; i < fullStars; i++) {
      html += '<span style="color: #fbbf24; font-size: 1.25rem;">★</span>';
    }

    if (hasHalfStar) {
      html += '<span style="color: #fbbf24; font-size: 1.25rem;">⯨</span>';
    }

    for (let i = 0; i < emptyStars; i++) {
      html += '<span style="color: #d1d5db; font-size: 1.25rem;">★</span>';
    }

    return html;
  }

  /**
   * Format date for display
   */
  function formatDate(date) {
    if (!date) {
      return '';
    }

    try {
      const d = new Date(date);
      const now = new Date();
      const diffTime = Math.abs(now - d);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      }
      if (diffDays === 1) {
        return 'Yesterday';
      }
      if (diffDays < 7) {
        return `${diffDays} days ago`;
      }
      if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)} weeks ago`;
      }
      if (diffDays < 365) {
        return `${Math.floor(diffDays / 30)} months ago`;
      }

      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  /**
   * Initialize package card click handlers
   */
  function initializePackageCards() {
    const packageCards = document.querySelectorAll('[data-package-id]');

    packageCards.forEach(card => {
      const packageId = card.getAttribute('data-package-id');

      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `View details for package ${packageId}`);
      card.classList.add('package-card-interactive');

      card.addEventListener('click', () => handlePackageClick(packageId));

      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlePackageClick(packageId);
        }
      });

      card.addEventListener('mouseenter', () => {
        card.classList.add('package-card-hover');
      });

      card.addEventListener('mouseleave', () => {
        card.classList.remove('package-card-hover');
      });
    });

    if (packageCards.length > 0) {
      addPackageCardStyles();
    }
  }

  /**
   * Handle package card click
   */
  function handlePackageClick(packageId) {
    window.location.href = `/package.html?id=${packageId}`;
  }

  /**
   * Add CSS styles for package cards
   */
  function addPackageCardStyles() {
    if (document.getElementById('package-card-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'package-card-styles';
    style.textContent = `
      .package-card-interactive {
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      
      .package-card-interactive:hover,
      .package-card-hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
      }
      
      .package-card-interactive:focus {
        outline: 2px solid #0B8073;
        outline-offset: 2px;
      }
      
      .package-card-interactive:active {
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
      return '';
    }

    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
