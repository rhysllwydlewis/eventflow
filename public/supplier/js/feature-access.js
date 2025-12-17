/**
 * Feature Access Control for EventFlow Suppliers
 * Manages premium feature access based on subscription tier
 */

import { db, auth, doc, getDoc, onAuthStateChanged } from '../../assets/js/firebase-config.js';

// Feature tiers
const FEATURE_TIERS = {
  free: {
    maxPackages: 3,
    maxBookings: 10,
    priorityListing: false,
    analytics: false,
    badge: null,
    support: 'community',
    customBranding: false,
    homepageCarousel: false,
  },
  pro: {
    maxPackages: 50,
    maxBookings: 50,
    priorityListing: true,
    analytics: true,
    badge: 'pro',
    support: 'email',
    customBranding: false,
    homepageCarousel: false,
  },
  pro_plus: {
    maxPackages: -1, // unlimited
    maxBookings: -1, // unlimited
    priorityListing: true,
    analytics: true,
    badge: 'pro_plus',
    support: 'priority',
    customBranding: true,
    homepageCarousel: true,
  },
};

let currentSupplierTier = 'free';
let currentSupplierId = null;

/**
 * Initialize feature access control
 */
export async function initializeFeatureAccess() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        resolve();
        return;
      }

      try {
        // Get supplier tier
        const tier = await getSupplierTier(user.uid);
        currentSupplierTier = tier;
        resolve();
      } catch (error) {
        console.error('Error initializing feature access:', error);
        reject(error);
      }
    });
  });
}

/**
 * Get supplier tier for current user
 */
export async function getSupplierTier(userId) {
  try {
    // Query suppliers collection for this user
    const { collection, query, where, getDocs } = await import('../../assets/js/firebase-config.js');
    
    const suppliersQuery = query(
      collection(db, 'suppliers'),
      where('ownerUserId', '==', userId)
    );

    const suppliersSnapshot = await getDocs(suppliersQuery);

    if (suppliersSnapshot.empty) {
      return 'free';
    }

    // Get the first supplier
    const supplierData = suppliersSnapshot.docs[0].data();
    currentSupplierId = suppliersSnapshot.docs[0].id;

    // Check subscription
    const subscription = supplierData.subscription;
    if (!subscription || !subscription.tier) {
      return 'free';
    }

    // Check if subscription is active
    if (subscription.status !== 'active' && subscription.status !== 'trial') {
      return 'free';
    }

    return subscription.tier;
  } catch (error) {
    console.error('Error getting supplier tier:', error);
    return 'free';
  }
}

/**
 * Check if a feature is available for current tier
 */
export function hasFeatureAccess(featureName) {
  const tierFeatures = FEATURE_TIERS[currentSupplierTier] || FEATURE_TIERS.free;
  return tierFeatures[featureName] !== false && tierFeatures[featureName] !== null;
}

/**
 * Get feature limit for current tier
 */
export function getFeatureLimit(featureName) {
  const tierFeatures = FEATURE_TIERS[currentSupplierTier] || FEATURE_TIERS.free;
  return tierFeatures[featureName];
}

/**
 * Check if user has reached package limit
 */
export async function hasReachedPackageLimit(currentCount) {
  const limit = getFeatureLimit('maxPackages');
  if (limit === -1) return false; // unlimited
  return currentCount >= limit;
}

/**
 * Check if user has reached booking limit
 */
export async function hasReachedBookingLimit(currentCount) {
  const limit = getFeatureLimit('maxBookings');
  if (limit === -1) return false; // unlimited
  return currentCount >= limit;
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier = null) {
  const t = tier || currentSupplierTier;
  switch (t) {
    case 'pro':
      return 'Pro';
    case 'pro_plus':
      return 'Pro+';
    default:
      return 'Free';
  }
}

/**
 * Show upgrade prompt
 */
export function showUpgradePrompt(featureName, message = null) {
  const defaultMessage = `This feature requires an EventFlow Pro subscription. Upgrade now to unlock this feature.`;
  const displayMessage = message || defaultMessage;

  const modal = document.createElement('div');
  modal.className = 'upgrade-modal';
  modal.innerHTML = `
    <div class="upgrade-modal-overlay"></div>
    <div class="upgrade-modal-content">
      <button class="upgrade-modal-close" aria-label="Close">&times;</button>
      <div class="upgrade-modal-icon">🔒</div>
      <h3>Premium Feature</h3>
      <p>${displayMessage}</p>
      <div class="upgrade-modal-features">
        <h4>Unlock with Pro:</h4>
        <ul>
          <li>✓ Priority listing in search</li>
          <li>✓ Featured supplier badge</li>
          <li>✓ Advanced analytics</li>
          <li>✓ Up to 50 bookings/month</li>
        </ul>
      </div>
      <div class="upgrade-modal-actions">
        <a href="/supplier/subscription.html" class="btn-upgrade">Upgrade Now</a>
        <button class="btn-cancel">Maybe Later</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add styles if not already added
  if (!document.getElementById('upgrade-modal-styles')) {
    const styles = document.createElement('style');
    styles.id = 'upgrade-modal-styles';
    styles.textContent = `
      .upgrade-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .upgrade-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
      }
      .upgrade-modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      .upgrade-modal-close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #999;
      }
      .upgrade-modal-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      .upgrade-modal-content h3 {
        margin: 0 0 1rem 0;
        font-size: 1.5rem;
      }
      .upgrade-modal-content p {
        margin-bottom: 1.5rem;
        color: #666;
      }
      .upgrade-modal-features {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1.5rem;
        text-align: left;
      }
      .upgrade-modal-features h4 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
      }
      .upgrade-modal-features ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .upgrade-modal-features li {
        padding: 0.25rem 0;
        color: #28a745;
        font-weight: 600;
      }
      .upgrade-modal-actions {
        display: flex;
        gap: 1rem;
      }
      .btn-upgrade {
        flex: 1;
        padding: 0.75rem 1.5rem;
        background: #007bff;
        color: white;
        text-decoration: none;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.3s;
      }
      .btn-upgrade:hover {
        background: #0056b3;
      }
      .btn-cancel {
        flex: 1;
        padding: 0.75rem 1.5rem;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.3s;
      }
      .btn-cancel:hover {
        background: #545b62;
      }
    `;
    document.head.appendChild(styles);
  }

  // Close handlers
  const closeModal = () => modal.remove();
  modal.querySelector('.upgrade-modal-close').addEventListener('click', closeModal);
  modal.querySelector('.btn-cancel').addEventListener('click', closeModal);
  modal.querySelector('.upgrade-modal-overlay').addEventListener('click', closeModal);
}

/**
 * Lock a feature element visually
 */
export function lockFeature(element, featureName) {
  element.classList.add('feature-locked');
  element.style.position = 'relative';

  const badge = document.createElement('div');
  badge.className = 'feature-lock-badge';
  badge.innerHTML = `
    <div>🔒 Pro Feature</div>
    <a href="/supplier/subscription.html" class="upgrade-cta">Upgrade to unlock</a>
  `;

  element.appendChild(badge);
  element.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    showUpgradePrompt(featureName);
  });
}

/**
 * Check and enforce package limit
 */
export async function enforcePackageLimit(currentPackageCount) {
  const limit = getFeatureLimit('maxPackages');

  if (limit === -1) {
    // Unlimited
    return { allowed: true, remaining: -1 };
  }

  const remaining = limit - currentPackageCount;

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, limit };
  }

  return { allowed: true, remaining, limit };
}

/**
 * Display package limit notice
 */
export function displayPackageLimitNotice(container, currentCount) {
  const limit = getFeatureLimit('maxPackages');

  if (limit === -1) {
    container.innerHTML = '<p class="small">✓ Unlimited packages with Pro+ subscription</p>';
    return;
  }

  const remaining = limit - currentCount;
  const percentage = (currentCount / limit) * 100;

  let statusClass = 'info';
  let statusIcon = 'ℹ️';

  if (percentage >= 100) {
    statusClass = 'danger';
    statusIcon = '⚠️';
  } else if (percentage >= 80) {
    statusClass = 'warning';
    statusIcon = '⚠️';
  }

  container.innerHTML = `
    <p class="small ${statusClass}">
      ${statusIcon} You have used ${currentCount} of ${limit} packages. 
      ${remaining > 0 ? `${remaining} remaining.` : 'Upgrade to add more packages.'}
    </p>
    ${
      remaining <= 0
        ? '<a href="/supplier/subscription.html" class="cta" style="margin-top: 0.5rem;">Upgrade to Pro</a>'
        : ''
    }
  `;
}

/**
 * Get supplier badge HTML
 */
export function getSupplierBadgeHtml(tier = null) {
  const t = tier || currentSupplierTier;

  if (t === 'free') {
    return '';
  }

  if (t === 'pro') {
    return '<span class="supplier-badge pro">Pro</span>';
  }

  if (t === 'pro_plus') {
    return '<span class="supplier-badge pro_plus">Pro+</span>';
  }

  return '';
}

/**
 * Export current tier for use in other modules
 */
export function getCurrentTier() {
  return currentSupplierTier;
}

/**
 * Export current supplier ID
 */
export function getCurrentSupplierId() {
  return currentSupplierId;
}
