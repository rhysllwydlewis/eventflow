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
    price: 9.99,
    billingCycle: 'monthly',
    trialDays: 14,
    features: [
      'Priority listing in search results',
      'Featured supplier badge on profile',
      'Advanced analytics dashboard',
      'Up to 50 event bookings per month',
      'Email support',
    ],
  },
  pro_plus_monthly: {
    id: 'pro_plus_monthly',
    name: 'Pro+ Monthly',
    tier: 'pro_plus',
    price: 19.99,
    billingCycle: 'monthly',
    trialDays: 14,
    features: [
      'All Pro features',
      'Premium badge on profile',
      'Unlimited event bookings',
      'Priority phone support',
      'Custom branding options',
      'Featured in homepage carousel',
    ],
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    tier: 'pro',
    price: 99.99,
    billingCycle: 'yearly',
    trialDays: 28,
    features: [
      'Priority listing in search results',
      'Featured supplier badge on profile',
      'Advanced analytics dashboard',
      'Up to 50 event bookings per month',
      'Email support',
      'Save 17% vs monthly',
    ],
  },
  pro_plus_yearly: {
    id: 'pro_plus_yearly',
    name: 'Pro+ Yearly',
    tier: 'pro_plus',
    price: 199.99,
    billingCycle: 'yearly',
    trialDays: 28,
    features: [
      'All Pro features',
      'Premium badge on profile',
      'Unlimited event bookings',
      'Priority phone support',
      'Custom branding options',
      'Featured in homepage carousel',
      'Save 17% vs monthly',
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
    const available = await isGooglePayAvailable(paymentsClient);

    if (!available) {
      console.warn('Google Pay not available');
      showWarning('Google Pay is not available on this device. Please try another payment method.');
    }
  } catch (error) {
    console.error('Error initializing Google Pay:', error);
    showWarning('Could not initialize Google Pay. Payment buttons may not work.');
  }
}

/**
 * Render subscription plan cards
 */
function renderSubscriptionPlans() {
  const container = document.getElementById('subscription-plans');
  if (!container) return;

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

  if (plan.tier === 'pro_plus') {
    card.classList.add('featured');
  }

  const currentTier = currentSupplier?.subscription?.tier || 'free';
  const isCurrentPlan = currentSupplier?.subscription?.planId === plan.id;

  card.innerHTML = `
    <div class="plan-header">
      <h3>${plan.name}</h3>
      ${plan.tier === 'pro_plus' ? '<span class="badge-recommended">Most Popular</span>' : ''}
    </div>
    <div class="plan-price">
      <span class="price">£${plan.price.toFixed(2)}</span>
      <span class="period">/${plan.billingCycle}</span>
    </div>
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

    if (result.success) {
      showSuccess('Payment successful! Your subscription is being activated...');

      // Wait a moment for the Cloud Function to process
      setTimeout(() => {
        window.location.href = '/dashboard-supplier.html?subscription=success';
      }, 2000);
    } else {
      showError(result.error || 'Payment failed. Please try again.');
    }
  } catch (error) {
    console.error('Error processing Google Pay payment:', error);
    showError('Payment failed. Please try again.');
  } finally {
    hideLoading();
  }
}

/**
 * Display current subscription status
 */
function displayCurrentSubscription() {
  const statusContainer = document.getElementById('current-subscription-status');
  if (!statusContainer) return;

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
    subscription.status === 'active' ? 'status-active' : subscription.status === 'trial' ? 'status-trial' : 'status-expired';

  let statusText = subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);
  if (subscription.status === 'trial') {
    const daysLeft = Math.ceil(
      (subscription.trialEndDate.toDate() - new Date()) / (1000 * 60 * 60 * 24)
    );
    statusText = `Trial (${daysLeft} days left)`;
  }

  const endDateStr = subscription.endDate
    ? new Date(subscription.endDate.toDate()).toLocaleDateString('en-GB')
    : 'N/A';

  statusContainer.innerHTML = `
    <div class="subscription-status">
      <h3>Current Subscription</h3>
      <div class="subscription-badge ${subscription.tier}">
        ${subscription.tier === 'pro' ? 'Pro' : 'Pro+'}
      </div>
      <p class="${statusClass}">${statusText}</p>
      <p class="small">Plan: ${plan ? plan.name : subscription.planId}</p>
      <p class="small">Renews: ${endDateStr}</p>
      <p class="small">Auto-renew: ${subscription.autoRenew ? 'Yes' : 'No'}</p>
      <div class="subscription-actions">
        ${
          subscription.status === 'active' || subscription.status === 'trial'
            ? `
          <button class="btn-manage" id="cancel-subscription-btn">Cancel Subscription</button>
          <button class="btn-manage" id="change-plan-btn">Change Plan</button>
        `
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
}

/**
 * Handle subscription cancellation
 */
async function handleCancelSubscription() {
  if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
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
