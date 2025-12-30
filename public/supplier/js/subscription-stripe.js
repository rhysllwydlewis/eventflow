/**
 * Subscription Management for EventFlow Suppliers
 * Handles subscription plan selection and Stripe integration
 * Replaces Google Pay/Firebase with Stripe implementation
 */

// Subscription plans - aligned with SUBSCRIPTION-TIERS.md
const PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    tier: 'pro',
    price: 49.0,
    billingCycle: 'monthly',
    trialDays: 14,
    introductoryPrice: 49.0,
    regularPrice: 99.0,
    introductoryMonths: 3,
    features: [
      'Pro supplier badge on profile',
      'Lead quality scoring (High/Medium/Low)',
      'Priority listing in search results',
      'Unlimited photos',
      'Email & phone verification badges',
      'Profile analytics dashboard',
      'Priority support (24-hour response)',
    ],
  },
  featured_monthly: {
    id: 'featured_monthly',
    name: 'Featured Monthly',
    tier: 'featured',
    price: 199.0,
    billingCycle: 'monthly',
    trialDays: 14,
    features: [
      'Featured badge on profile',
      'All Pro features included',
      'Homepage featured carousel placement',
      'Top 3 positions in category pages',
      'Business verification badge',
      'Dedicated onboarding call',
      'Monthly performance review',
      'Export analytics to CSV',
      'VIP support (4-hour response)',
    ],
  },
};

let currentUser = null;
let currentSubscription = null;

/**
 * Initialize subscription page
 */
async function initSubscriptionPage() {
  try {
    // Check authentication
    const user = await checkAuth();
    if (!user) {
      window.location.href = `/auth.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    currentUser = user;

    // Load current subscription status
    await loadSubscriptionStatus();

    // Render subscription plans
    renderSubscriptionPlans();

    // Set up manage billing button
    setupBillingPortal();
  } catch (error) {
    console.error('Error initializing subscription page:', error);
    showError('Failed to load subscription information');
  }
}

/**
 * Check user authentication
 */
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

/**
 * Load user's current subscription status
 */
async function loadSubscriptionStatus() {
  try {
    const response = await fetch('/api/payments', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load subscription status');
    }

    const data = await response.json();

    // Find active subscription
    const activeSubscription = data.payments.find(
      p =>
        p.type === 'subscription' &&
        p.status === 'succeeded' &&
        p.subscriptionDetails &&
        !p.subscriptionDetails.cancelAtPeriodEnd
    );

    currentSubscription = activeSubscription;
    displaySubscriptionStatus(activeSubscription);
  } catch (error) {
    console.error('Error loading subscription:', error);
    // Don't show error - user might not have subscription yet
  }
}

/**
 * Display current subscription status
 */
function displaySubscriptionStatus(subscription) {
  const statusContainer = document.getElementById('current-subscription-status');
  if (!statusContainer) {
    return;
  }

  if (!subscription) {
    statusContainer.innerHTML = `
      <div class="subscription-status-card">
        <div class="status-badge free">Free Plan</div>
        <h3>You're currently on the Free plan</h3>
        <p>Upgrade to unlock premium features and boost your visibility on EventFlow.</p>
      </div>
    `;
    return;
  }

  const details = subscription.subscriptionDetails;
  const planName = details.planName || 'Pro Plan';
  const endDate = new Date(details.currentPeriodEnd);
  const isCancelling = details.cancelAtPeriodEnd;

  statusContainer.innerHTML = `
    <div class="subscription-status-card active">
      <div class="status-badge ${isCancelling ? 'cancelling' : 'active'}">${isCancelling ? 'Cancelling' : 'Active'}</div>
      <h3>Your Current Plan: ${planName}</h3>
      <div class="subscription-details">
        <p><strong>Status:</strong> ${isCancelling ? 'Active until ' : 'Renews on '} ${endDate.toLocaleDateString('en-GB')}</p>
        <p><strong>Billing:</strong> ${details.interval === 'month' ? 'Monthly' : 'Yearly'}</p>
        <p><strong>Amount:</strong> £${subscription.amount.toFixed(2)}</p>
      </div>
      ${
        isCancelling
          ? `
        <div class="cancellation-notice">
          <p>⚠️ Your subscription will be cancelled at the end of the current billing period.</p>
        </div>
      `
          : ''
      }
      <button class="btn btn-secondary" id="manage-billing-btn">Manage Billing</button>
    </div>
  `;

  // Set up manage billing button
  document.getElementById('manage-billing-btn')?.addEventListener('click', openBillingPortal);
}

/**
 * Render subscription plans
 */
function renderSubscriptionPlans() {
  const plansContainer = document.getElementById('subscription-plans');
  if (!plansContainer) {
    return;
  }

  const plansHtml = Object.values(PLANS)
    .map(plan => {
      const isCurrentPlan =
        currentSubscription && currentSubscription.subscriptionDetails?.planId?.includes(plan.id);
      const isFeatured = plan.tier === 'featured';

      return `
      <div class="pricing-card ${isFeatured ? 'featured' : ''}">
        ${isFeatured ? '<div class="popular-badge">PREMIUM</div>' : ''}
        <h3>${plan.name}</h3>
        <div class="price">
          £${plan.price.toFixed(2)}
          <span class="period">/month</span>
        </div>
        ${
          plan.introductoryPrice && plan.regularPrice && plan.introductoryMonths
            ? `
          <div class="price-note">First ${plan.introductoryMonths} months, then £${plan.regularPrice}/month</div>
        `
            : ''
        }
        <div class="trial-badge">
          ${plan.trialDays}-day free trial
        </div>
        <ul class="features">
          ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
        </ul>
        ${
          isCurrentPlan
            ? `
          <button class="btn btn-current" disabled>Current Plan</button>
        `
            : `
          <button class="btn btn-primary" 
                  data-plan-id="${plan.id}"
                  onclick="handleSubscribe('${plan.id}')">
            ${currentSubscription ? 'Switch Plan' : 'Start Free Trial'}
          </button>
        `
        }
      </div>
    `;
    })
    .join('');

  plansContainer.innerHTML = `
    <div class="pricing-grid">
      ${plansHtml}
    </div>
  `;
}

/**
 * Handle subscription button click
 */
async function handleSubscribe(planId) {
  const plan = PLANS[planId];
  if (!plan) {
    showError('Invalid plan selected');
    return;
  }

  const button = document.querySelector(`button[data-plan-id="${planId}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = 'Processing...';
  }

  try {
    // For now, use one-time payment
    // In production, you'd create a Stripe Price ID for each plan
    const amount = Math.round(plan.price * 100); // Convert to pence

    const response = await fetch('/api/payments/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        type: 'one_time',
        amount: amount,
        currency: 'gbp',
        planName: plan.name,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }

    // Redirect to Stripe checkout
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (error) {
    console.error('Subscription error:', error);
    showError(error.message || 'Failed to start subscription. Please try again.');

    if (button) {
      button.disabled = false;
      button.textContent = currentSubscription ? 'Switch Plan' : 'Start Free Trial';
    }
  }
}

/**
 * Set up billing portal
 */
function setupBillingPortal() {
  const manageBillingBtn = document.getElementById('manage-billing-btn');
  if (manageBillingBtn) {
    manageBillingBtn.addEventListener('click', openBillingPortal);
  }
}

/**
 * Open Stripe billing portal
 */
async function openBillingPortal() {
  try {
    const button = event.target;
    button.disabled = true;
    button.textContent = 'Loading...';

    const response = await fetch('/api/payments/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        returnUrl: window.location.href,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to open billing portal');
    }

    // Redirect to Stripe billing portal
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No portal URL returned');
    }
  } catch (error) {
    console.error('Billing portal error:', error);
    showError(error.message || 'Failed to open billing portal. Please try again.');

    const button = event.target;
    if (button) {
      button.disabled = false;
      button.textContent = 'Manage Billing';
    }
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorContainer = document.getElementById('error-message');
  if (errorContainer) {
    errorContainer.innerHTML = `
      <div class="alert alert-error">
        <strong>Error:</strong> ${message}
      </div>
    `;
    errorContainer.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  } else {
    alert(message);
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successContainer = document.getElementById('success-message');
  if (successContainer) {
    successContainer.innerHTML = `
      <div class="alert alert-success">
        ${message}
      </div>
    `;
    successContainer.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      successContainer.style.display = 'none';
    }, 5000);
  }
}

// Make functions available globally
window.handleSubscribe = handleSubscribe;
window.openBillingPortal = openBillingPortal;

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubscriptionPage);
} else {
  initSubscriptionPage();
}
