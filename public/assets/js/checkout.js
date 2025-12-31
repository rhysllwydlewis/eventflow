/**
 * Checkout Page JavaScript
 * Handles plan selection and Stripe checkout session creation
 */

(function () {
  'use strict';

  // Stripe instance (will be initialized after loading config)
  let stripe = null;

  // Pricing plans configuration - aligned with updated pricing
  const PLANS = {
    starter: {
      name: 'Starter',
      price: 0.0,
      priceDisplay: '£0',
      interval: 'month',
      features: [
        'Basic supplier profile',
        'Up to 5 photos',
        'Receive enquiries',
        'Standard listing in search',
        'Email support',
      ],
      isFree: true,
    },
    pro: {
      name: 'Professional',
      price: 39.0,
      priceDisplay: '£39',
      interval: 'month',
      introductoryPrice: 39.0,
      regularPrice: 69.0,
      introductoryMonths: 3,
      features: [
        'Everything in Free',
        'Unlimited photos',
        'Lead quality scoring (High/Medium/Low)',
        'Priority listing in search results',
        'Email & phone verification badges',
        'Response time tracking',
        'Profile analytics dashboard',
        'Priority support',
      ],
    },
    pro_plus: {
      name: 'Professional Plus',
      price: 159.0,
      priceDisplay: '£159',
      interval: 'month',
      features: [
        'Everything in Pro',
        'Homepage featured placement',
        'Top of category pages',
        'Business verification badge',
        'Dedicated onboarding call',
        'Monthly performance review',
        'Export analytics to CSV',
        'VIP support',
      ],
      featured: true,
    },
  };

  // Initialize Stripe with publishable key
  async function initializeStripe() {
    try {
      // Check if Stripe.js is loaded
      if (typeof Stripe === 'undefined') {
        console.error('Stripe.js not loaded');
        showError('Payment system not available. Please refresh the page.');
        return false;
      }

      // Get Stripe publishable key from backend
      const response = await fetch('/api/payments/config', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.error('Failed to get Stripe config:', data);
        } else {
          console.error('Failed to get Stripe config: Non-JSON response');
        }
        // Don't show error for free plans
        return false;
      }

      const config = await response.json();
      if (!config.publishableKey) {
        console.error('No Stripe publishable key received');
        return false;
      }

      // Initialize Stripe
      stripe = Stripe(config.publishableKey);
      console.log('✅ Stripe.js initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      return false;
    }
  }

  // Check authentication
  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        // For free plan, allow unauthenticated users to proceed to signup
        const urlParams = new URLSearchParams(window.location.search);
        const plan = urlParams.get('plan');

        if (plan === 'starter') {
          // Show signup option for free plan
          return 'unauthenticated_free';
        }

        // For paid plans, redirect to auth with return URL
        window.location.href = `/auth.html?redirect=${encodeURIComponent(
          `${window.location.pathname}${window.location.search}`
        )}`;
        return false;
      }

      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      showError('Failed to verify authentication');
      return false;
    }
  }

  // Display error message
  function showError(message) {
    const errorContainer = document.getElementById('error-container');
    if (!errorContainer) {
      return;
    }

    errorContainer.innerHTML = `
      <div class="error-message">
        <strong>Error:</strong> ${escapeHtml(message)}
      </div>
    `;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Render pricing cards
  function renderPricingCards() {
    const content = document.getElementById('checkout-content');
    if (!content) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const selectedPlan = urlParams.get('plan');

    // Filter plans if a specific plan is requested
    const plansToShow =
      selectedPlan && PLANS[selectedPlan] ? { [selectedPlan]: PLANS[selectedPlan] } : PLANS;

    content.className = '';
    content.innerHTML = `
      <div class="pricing-cards">
        ${Object.entries(plansToShow)
          .map(
            ([key, plan]) => `
          <div class="pricing-card ${plan.featured ? 'featured' : ''}">
            ${
              plan.featured
                ? '<div style="background: rgba(255,255,255,0.2); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; font-weight: bold;">MOST POPULAR</div>'
                : ''
            }
            ${
              plan.isFree
                ? '<div style="background: #10b981; color: white; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; font-weight: bold;">FREE FOREVER</div>'
                : ''
            }
            <h3>${escapeHtml(plan.name)}</h3>
            <div class="price">
              ${escapeHtml(plan.priceDisplay)}
              <small>/${escapeHtml(plan.interval)}</small>
            </div>
            ${
              plan.introductoryPrice && plan.regularPrice && plan.introductoryMonths
                ? `
              <div style="font-size: 0.875rem; color: #666; margin: 0.5rem 0;">
                First ${plan.introductoryMonths} months, then £${plan.regularPrice}/${plan.interval}
              </div>
            `
                : ''
            }
            <ul class="features">
              ${plan.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}
            </ul>
            <button 
              class="btn-checkout" 
              data-plan="${escapeHtml(key)}">
              ${plan.isFree ? 'Get Started Free' : `Choose ${escapeHtml(plan.name)}`}
            </button>
          </div>
        `
          )
          .join('')}
      </div>
      
      ${
        !selectedPlan
          ? `
      <div class="security-notice">
        <h3>🔒 Secure Payment Processing</h3>
        <p>All payments are processed securely through Stripe.</p>
        <p>Your payment information is encrypted and never stored on our servers.</p>
        <div class="icons">
          🔐 💳 ✓
        </div>
      </div>
      `
          : ''
      }
    `;

    // Attach event listeners to buttons
    const buttons = content.querySelectorAll('.btn-checkout');
    buttons.forEach(button => {
      button.addEventListener('click', function () {
        const planKey = this.getAttribute('data-plan');
        handleCheckout(planKey);
      });
    });
  }

  // Handle checkout
  async function handleCheckout(planKey) {
    const plan = PLANS[planKey];
    const button = document.querySelector(`button[data-plan="${planKey}"]`);

    if (!button) {
      return;
    }

    // Disable button and show loading
    button.disabled = true;
    button.textContent = 'Processing...';

    try {
      // Handle free plan - just redirect to sign up or dashboard
      if (plan.isFree) {
        window.location.href = '/auth.html?plan=starter';
        return;
      }

      // For paid plans, ensure Stripe is initialized
      if (!stripe) {
        const initialized = await initializeStripe();
        if (!initialized) {
          throw new Error('Payment system unavailable. Please try again later.');
        }
      }

      // Create Stripe checkout session
      const amount = Math.round(plan.price * 100); // Convert to pence/cents

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

      // Use Stripe.js to redirect to checkout (recommended by Stripe)
      if (data.sessionId) {
        const result = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      } else if (data.url) {
        // Fallback to direct URL redirect
        window.location.href = data.url;
      } else {
        throw new Error('No checkout session returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      showError(error.message);
      button.disabled = false;
      button.textContent = `Choose ${plan.name}`;
    }
  }

  // Initialize page
  async function init() {
    // Initialize Stripe in background (non-blocking for free plan users)
    initializeStripe().catch(err => {
      console.error('Stripe initialization failed:', err);
    });

    // Then check auth and render cards
    const authStatus = await checkAuth();
    if (authStatus === true || authStatus === 'unauthenticated_free') {
      renderPricingCards();
    }
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
