/**
 * Checkout Page JavaScript
 * Handles plan selection and Stripe checkout session creation
 */

const isDevelopment =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
(function () {
  'use strict';

  // Stripe instance (will be initialized after loading config)
  let stripe = null;
  // Config from backend (includes introPricingEnabled, proPriceId)
  let stripeConfig = null;

  // Pricing plans configuration - aligned with updated pricing
  const PLANS = {
    free: {
      name: 'Free',
      price: 0.0,
      priceDisplay: '£0',
      interval: 'month',
      features: [
        'Basic supplier profile',
        'Up to 3 packages',
        'Up to 10 bookings per month',
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
      const response = await fetch('/api/v1/payments/config', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.error('Failed to get Stripe config:', data);

          // Show user-friendly error message
          if (response.status === 500) {
            showError('Payment system temporarily unavailable. Please try again in a few moments.');
          } else if (response.status === 503) {
            showError('Payment processing is not currently available. Please contact support.');
          } else {
            showError(data.message || 'Failed to initialize payment system.');
          }
        } else {
          console.error('Failed to get Stripe config: Non-JSON response');
          showError('Payment system error. Please try again later.');
        }
        return false;
      }

      const config = await response.json();
      if (!config.publishableKey) {
        console.error('No Stripe publishable key received');
        showError('Payment configuration error. Please contact support.');
        return false;
      }

      // Store config for use during checkout
      stripeConfig = config;

      // Initialize Stripe
      stripe = Stripe(config.publishableKey);
      if (isDevelopment) {
        console.log('✅ Stripe.js initialized');
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      showError('Unable to connect to payment system. Please check your connection and try again.');
      return false;
    }
  }

  // Check authentication
  async function checkAuth() {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.user) {
        // User not authenticated
        const urlParams = new URLSearchParams(window.location.search);
        const plan = urlParams.get('plan');

        if (plan === 'free') {
          // Show signup option for free plan
          return 'unauthenticated_free';
        }

        // For paid plans, redirect to auth with return URL
        window.location.href = `/auth?redirect=${encodeURIComponent(
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
        window.location.href = '/auth?plan=free';
        return;
      }

      // For paid plans, ensure Stripe is initialized (also loads stripeConfig)
      if (!stripe) {
        const initialized = await initializeStripe();
        if (!initialized) {
          throw new Error('Payment system unavailable. Please try again later.');
        }
      }

      // Fetch CSRF token if not already available
      if (!window.__CSRF_TOKEN__) {
        try {
          const csrfResponse = await fetch('/api/v1/csrf-token', { credentials: 'include' });
          const csrfData = await csrfResponse.json();
          if (csrfData && csrfData.csrfToken) {
            window.__CSRF_TOKEN__ = csrfData.csrfToken;
          }
        } catch (err) {
          console.warn('Could not fetch CSRF token:', err);
        }
      }

      const headers = {
        'Content-Type': 'application/json',
      };

      // Add CSRF token if available
      if (window.__CSRF_TOKEN__) {
        headers['X-CSRF-Token'] = window.__CSRF_TOKEN__;
      }

      // Decide payment mode: prefer subscription when a Stripe priceId is available
      let requestBody;

      if (stripeConfig?.proPriceId && planKey === 'pro') {
        // Use subscription mode with server-configured price
        requestBody = {
          type: 'subscription',
          priceId: stripeConfig.proPriceId,
          planName: plan.name,
        };
      } else if (stripeConfig?.proPriceId && planKey === 'pro_plus') {
        // Use subscription mode for pro_plus — falls back to the server-configured proPriceId
        // when STRIPE_PRO_PLUS_PRICE_ID is not separately set. The server's create-checkout-session
        // endpoint will select the correct price from env if a dedicated pro_plus price exists.
        requestBody = {
          type: 'subscription',
          priceId: stripeConfig.proPriceId,
          planName: plan.name,
        };
      } else {
        // Fallback: one-time payment
        const amount = Math.round(plan.price * 100);
        requestBody = {
          type: 'one_time',
          amount,
          currency: 'gbp',
          planName: plan.name,
        };
      }
      if (isDevelopment) {
        console.log(`[Checkout] Mode: ${requestBody.type} for plan: ${planKey}`);
      }

      const response = await fetch('/api/v1/payments/create-checkout-session', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // Provide user-friendly error messages
        let errorMsg = data.message || data.error || 'Failed to create checkout session';
        if (response.status === 500) {
          errorMsg = data.message || 'Payment system temporarily unavailable. Please try again.';
        } else if (response.status === 503) {
          errorMsg = 'Payment processing is not currently available. Please contact support.';
        }
        throw new Error(errorMsg);
      }

      // Prefer direct URL redirect (works for both hosted and embedded checkout)
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        // Fallback: use Stripe.js redirectToCheckout
        const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (result.error) {
          throw new Error(result.error.message);
        }
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
