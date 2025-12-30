/**
 * Subscription Management for EventFlow Suppliers
 * Handles subscription plan selection, Google Pay integration, and subscription management
 */

import {
  db,
  auth,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  onAuthStateChanged,
  Timestamp,
} from '../../assets/js/firebase-config.js';

import {
  initializeGooglePay,
  isGooglePayAvailable,
  processGooglePayPayment,
  createGooglePayButton,
} from './googlepay-config.js';

// Subscription plans
const PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    tier: 'pro',
    price: 39.0,
    billingCycle: 'monthly',
    trialDays: 14,
    introductoryPrice: 39.0,
    regularPrice: 59.0,
    introductoryMonths: 3,
    features: [
      'Pro supplier badge on profile',
      'Priority listing in search results',
      'Up to 50 event bookings per month',
      'Email support',
      '£39/month for first 3 months, then £59/month',
    ],
  },
  pro_plus_monthly: {
    id: 'pro_plus_monthly',
    name: 'Pro+ Monthly',
    tier: 'pro_plus',
    price: 199.0,
    billingCycle: 'monthly',
    trialDays: 14,
    features: [
      'Premium Pro+ badge on profile',
      'All Pro features included',
      'Unlimited event bookings',
      'Advanced analytics dashboard',
      'Priority phone support',
      'Custom branding options',
      'Featured in homepage carousel',
    ],
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    tier: 'pro',
    price: 468.0,
    billingCycle: 'yearly',
    trialDays: 28,
    features: [
      'Pro supplier badge on profile',
      'Priority listing in search results',
      'Up to 50 event bookings per month',
      'Email support',
      'Save vs monthly billing',
    ],
  },
  pro_plus_yearly: {
    id: 'pro_plus_yearly',
    name: 'Pro+ Yearly',
    tier: 'pro_plus',
    price: 2388.0,
    billingCycle: 'yearly',
    trialDays: 28,
    features: [
      'Premium Pro+ badge on profile',
      'All Pro features included',
      'Unlimited event bookings',
      'Advanced analytics dashboard',
      'Priority phone support',
      'Custom branding options',
      'Featured in homepage carousel',
      'Save vs monthly billing',
    ],
  },
};

let paymentsClient = null;
let currentUser = null;
let currentSupplier = null;

/**
 * Initialize the subscription page
 */
async function init() {
  try {
    // Wait for auth state
    onAuthStateChanged(auth, async user => {
      if (!user) {
        window.location.href = '/auth.html';
        return;
      }

      currentUser = user;

      // Load supplier data
      await loadSupplierData();

      // Initialize Google Pay
      await initGooglePayAPI();

      // Render subscription plans
      renderSubscriptionPlans();

      // Display current subscription status
      displayCurrentSubscription();
    });
  } catch (error) {
    console.error('Error initializing subscription page:', error);
    showError('Failed to load subscription page. Please try again.');
  }
}

/**
 * Load supplier data for current user
 */
async function loadSupplierData() {
  try {
    const suppliersQuery = query(
      collection(db, 'suppliers'),
      where('ownerUserId', '==', currentUser.uid)
    );

    const suppliersSnapshot = await getDocs(suppliersQuery);

    if (suppliersSnapshot.empty) {
      showError('No supplier profile found. Please create a supplier profile first.');
      setTimeout(() => {
        window.location.href = '/dashboard-supplier.html';
      }, 3000);
      return;
    }

    // Get the first supplier (in case user has multiple)
    currentSupplier = {
      id: suppliersSnapshot.docs[0].id,
      ...suppliersSnapshot.docs[0].data(),
    };

    // Store supplier ID for payment processing
    sessionStorage.setItem('selectedSupplierId', currentSupplier.id);
  } catch (error) {
    console.error('Error loading supplier data:', error);
    throw error;
  }
}

/**
 * Initialize Google Pay API
 */
async function initGooglePayAPI() {
  try {
    paymentsClient = await initializeGooglePay();

    if (!paymentsClient) {
      console.warn('Google Pay not available - buttons will not render');
      return;
    }

    const available = await isGooglePayAvailable(paymentsClient);

    if (!available) {
      console.warn('Google Pay not ready on this device');
      paymentsClient = null;
    }
  } catch (error) {
    console.error('Error initializing Google Pay:', error);
    paymentsClient = null;
  }
}

/**
 * Render subscription plan cards
 */
function renderSubscriptionPlans() {
  const container = document.getElementById('subscription-plans');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  // Group plans by billing cycle
  const monthlyPlans = Object.values(PLANS).filter(p => p.billingCycle === 'monthly');
  const yearlyPlans = Object.values(PLANS).filter(p => p.billingCycle === 'yearly');

  // Create tabs
  const tabsHtml = `
    <div class="subscription-tabs">
      <button class="tab-button active" data-tab="monthly">Monthly</button>
      <button class="tab-button" data-tab="yearly">Yearly (Save 17%)</button>
    </div>
  `;

  container.innerHTML = tabsHtml;

  // Create plan containers
  const monthlyContainer = document.createElement('div');
  monthlyContainer.id = 'monthly-plans';
  monthlyContainer.className = 'plans-container active';

  const yearlyContainer = document.createElement('div');
  yearlyContainer.id = 'yearly-plans';
  yearlyContainer.className = 'plans-container';

  // Render monthly plans
  monthlyPlans.forEach(plan => {
    monthlyContainer.appendChild(createPlanCard(plan));
  });

  // Render yearly plans
  yearlyPlans.forEach(plan => {
    yearlyContainer.appendChild(createPlanCard(plan));
  });

  container.appendChild(monthlyContainer);
  container.appendChild(yearlyContainer);

  // Add tab switching logic
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.plans-container').forEach(c => c.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`${tab}-plans`).classList.add('active');
    });
  });
}

/**
 * Create a subscription plan card
 */
function createPlanCard(plan) {
  const card = document.createElement('div');
  card.className = 'subscription-card';

  // Pro Plus is NOT featured/promoted per requirements
  // Removed featured class for pro_plus

  const currentTier = currentSupplier?.subscription?.tier || 'free';
  const isCurrentPlan = currentSupplier?.subscription?.planId === plan.id;

  // Show introductory pricing for Pro plan
  let priceHtml = '';
  if (plan.introductoryPrice && plan.regularPrice) {
    priceHtml = `
      <div class="plan-price">
        <span class="price">£${plan.introductoryPrice.toFixed(2)}</span>
        <span class="period">/${plan.billingCycle}</span>
      </div>
      <p class="small" style="margin-top: 0.5rem; color: #666;">
        £${plan.regularPrice.toFixed(2)}/${plan.billingCycle} after ${plan.introductoryMonths} months
      </p>
    `;
  } else {
    priceHtml = `
      <div class="plan-price">
        <span class="price">£${plan.price.toFixed(2)}</span>
        <span class="period">/${plan.billingCycle}</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="plan-header">
      <h3>${plan.name}</h3>
    </div>
    ${priceHtml}
    <div class="plan-trial">
      <span class="trial-badge">${plan.trialDays}-day free trial</span>
    </div>
    <div class="plan-features">
      <ul>
        ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
    </div>
    <div class="plan-action">
      ${
        isCurrentPlan
          ? '<button class="btn-current" disabled>Current Plan</button>'
          : `<button class="btn-select" data-plan-id="${plan.id}">Select Plan</button>`
      }
      <div class="gpay-button-container" data-plan-id="${plan.id}"></div>
    </div>
  `;

  // Add event listener for plan selection
  const selectButton = card.querySelector('.btn-select');
  if (selectButton) {
    selectButton.addEventListener('click', () => handlePlanSelection(plan));
  }

  // Add Google Pay button if available
  if (paymentsClient) {
    const gpayContainer = card.querySelector('.gpay-button-container');
    createGooglePayButton(gpayContainer, () => handleGooglePayClick(plan));
  }

  return card;
}

/**
 * Handle plan selection (non-Google Pay)
 */
async function handlePlanSelection(plan) {
  try {
    showLoading('Processing your selection...');

    // Store selected plan details
    sessionStorage.setItem('selectedPlanId', plan.id);
    sessionStorage.setItem('selectedPlanAmount', plan.price.toString());

    // For now, show a message
    // In a full implementation, this would redirect to another payment method
    showMessage(`Plan ${plan.name} selected. Please use Google Pay to complete purchase.`);
  } catch (error) {
    console.error('Error selecting plan:', error);
    showError('Failed to select plan. Please try again.');
  } finally {
    hideLoading();
  }
}

/**
 * Handle Google Pay button click
 */
async function handleGooglePayClick(plan) {
  try {
    showLoading('Processing payment...');

    // Store selected plan details
    sessionStorage.setItem('selectedPlanId', plan.id);
    sessionStorage.setItem('selectedPlanAmount', plan.price.toString());

    // Process payment through Google Pay
    const result = await processGooglePayPayment(paymentsClient, plan.price, plan.id, plan.name);

    hideLoading();

    if (result.success) {
      showSuccess('Payment successful! Your subscription is being activated...');

      // Wait a moment for the Firebase extension to process
      setTimeout(() => {
        window.location.href = '/dashboard-supplier.html?subscription=success';
      }, 2000);
    } else if (result.cancelled) {
      // User cancelled payment - don't show error
      console.log('Payment cancelled by user');
    } else {
      showError(result.error || 'Payment failed. Please try again.');
    }
  } catch (error) {
    console.error('Error processing Google Pay payment:', error);
    hideLoading();
    showError('Payment failed. Please try again.');
  }
}

/**
 * Display current subscription status
 */
function displayCurrentSubscription() {
  const statusContainer = document.getElementById('current-subscription-status');
  if (!statusContainer) {
    return;
  }

  const subscription = currentSupplier?.subscription;

  if (!subscription || subscription.tier === 'free' || !subscription.status) {
    statusContainer.innerHTML = `
      <div class="subscription-status">
        <h3>Current Subscription</h3>
        <p class="status-free">Free Plan</p>
        <p class="small">Upgrade to unlock premium features and boost your visibility.</p>
      </div>
    `;
    return;
  }

  const plan = PLANS[subscription.planId];
  const statusClass =
    subscription.status === 'active'
      ? 'status-active'
      : subscription.status === 'trial'
        ? 'status-trial'
        : 'status-expired';

  let statusText = subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);
  if (subscription.status === 'trial') {
    const daysLeft = Math.max(
      0,
      Math.ceil((subscription.trialEndDate.toDate() - new Date()) / (1000 * 60 * 60 * 24))
    );
    statusText = `Trial (${daysLeft} days left)`;
  }

  const endDateStr = subscription.endDate
    ? new Date(subscription.endDate.toDate()).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  // Check if renewal is needed soon (within 14 days)
  const daysUntilRenewal = subscription.endDate
    ? Math.ceil((subscription.endDate.toDate() - new Date()) / (1000 * 60 * 60 * 24))
    : 0;
  const showRenewalPrompt =
    !subscription.autoRenew && daysUntilRenewal > 0 && daysUntilRenewal <= 14;

  statusContainer.innerHTML = `
    <div class="subscription-status">
      <h3>Current Subscription</h3>
      <div class="subscription-badge ${subscription.tier}">
        ${subscription.tier === 'pro' ? 'Pro' : 'Pro+'}
      </div>
      <p class="${statusClass}">${statusText}</p>
      <p class="small">Plan: ${plan ? plan.name : subscription.planId}</p>
      ${
        subscription.cancelledAt
          ? `<p class="small">Cancelled - Access until: ${endDateStr}</p>`
          : `<p class="small">${subscription.autoRenew ? 'Renews' : 'Expires'}: ${endDateStr}</p>`
      }
      <p class="small">Auto-renew: ${subscription.autoRenew ? 'Yes' : 'No'}</p>
      
      ${
        showRenewalPrompt
          ? `
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; padding: 12px; margin: 15px 0;">
          <p style="margin: 0 0 10px; color: #856404; font-size: 14px; font-weight: 600;">
            ⚠️ Your subscription expires in ${daysUntilRenewal} days
          </p>
          <p style="margin: 0; color: #856404; font-size: 13px;">
            Renew now to keep your premium features without interruption.
          </p>
        </div>
      `
          : ''
      }
      
      <div class="subscription-actions">
        ${
          (subscription.status === 'active' || subscription.status === 'trial') &&
          !subscription.cancelledAt
            ? `
          <button class="btn-manage" id="cancel-subscription-btn">Cancel Subscription</button>
          <button class="btn-manage" id="change-plan-btn">Change Plan</button>
        `
            : subscription.cancelledAt
              ? `<button class="btn-manage" id="reactivate-subscription-btn">Reactivate Subscription</button>`
              : ''
        }
      </div>
    </div>
  `;

  // Add event listeners
  const cancelBtn = document.getElementById('cancel-subscription-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancelSubscription);
  }

  const changeBtn = document.getElementById('change-plan-btn');
  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      document.getElementById('subscription-plans').scrollIntoView({ behavior: 'smooth' });
    });
  }

  const reactivateBtn = document.getElementById('reactivate-subscription-btn');
  if (reactivateBtn) {
    reactivateBtn.addEventListener('click', handleReactivateSubscription);
  }
}

/**
 * Handle subscription reactivation
 */
async function handleReactivateSubscription() {
  if (
    !confirm(
      'Would you like to reactivate your subscription? Your premium features will continue without interruption.'
    )
  ) {
    return;
  }

  try {
    showLoading('Reactivating subscription...');

    // Update supplier document to re-enable auto-renewal
    const supplierRef = doc(db, 'suppliers', currentSupplier.id);
    await setDoc(
      supplierRef,
      {
        subscription: {
          autoRenew: true,
          cancelledAt: null,
          lastUpdated: Timestamp.now(),
        },
      },
      { merge: true }
    );

    showSuccess('Subscription reactivated successfully!');

    // Reload the page to update status
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    showError('Failed to reactivate subscription. Please try again or contact support.');
  } finally {
    hideLoading();
  }
}

/**
 * Handle subscription cancellation
 */
async function handleCancelSubscription() {
  const endDate = currentSupplier.subscription?.endDate
    ? new Date(currentSupplier.subscription.endDate.toDate()).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'the end of your billing period';

  const confirmMessage = `Are you sure you want to cancel your subscription?\n\nYou'll lose access to premium features after ${endDate}.\n\nYou can reactivate anytime before this date.`;

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    showLoading('Cancelling subscription...');

    // Call Cloud Function to cancel subscription
    const response = await fetch(
      'https://europe-west2-eventflow-ffb12.cloudfunctions.net/cancelSubscription',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            supplierId: currentSupplier.id,
          },
        }),
      }
    );

    const result = await response.json();

    if (result.result && result.result.success) {
      showSuccess('Subscription cancelled successfully.');
      // Reload the page to update status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      throw new Error(result.error?.message || 'Failed to cancel subscription');
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    showError('Failed to cancel subscription. Please try again or contact support.');
  } finally {
    hideLoading();
  }
}

// UI Helper Functions

function showLoading(message) {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function showMessage(message) {
  showNotification(message, 'info');
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showWarning(message) {
  showNotification(message, 'warning');
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
