/**
 * Payment Routes
 * Handles Stripe payment processing, subscriptions, and webhooks
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const dbUnified = require('../db-unified');
const { uid } = require('../store');

const router = express.Router();

// Initialize Stripe only if configured
let stripe = null;
let STRIPE_ENABLED = false;

try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (stripeSecretKey) {
    // eslint-disable-next-line global-require
    const stripeLib = require('stripe');
    stripe = stripeLib(stripeSecretKey);
    STRIPE_ENABLED = true;
    console.log('✅ Stripe payment integration enabled');
  } else {
    console.warn('⚠️  Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
} catch (err) {
  console.error('❌ Failed to initialize Stripe:', err.message);
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/payment-success.html';
const STRIPE_CANCEL_URL =
  process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/payment-cancel.html';

/**
 * Helper: Check if Stripe is enabled
 */
function ensureStripeEnabled(req, res, next) {
  if (!STRIPE_ENABLED || !stripe) {
    return res.status(503).json({
      error: 'Payment processing is not available',
      message: 'Stripe is not configured. Please contact support.',
    });
  }
  next();
}

/**
 * POST /api/payments/create-checkout-session
 * Create a Stripe checkout session for one-time payment or subscription
 *
 * Body:
 * {
 *   type: 'one_time' | 'subscription',
 *   amount?: number (for one_time, in smallest currency unit),
 *   currency?: string (default: 'gbp'),
 *   priceId?: string (for subscription),
 *   planName?: string (optional, for metadata),
 *   successUrl?: string (optional),
 *   cancelUrl?: string (optional)
 * }
 */
router.post(
  '/create-checkout-session',
  authRequired,
  writeLimiter,
  ensureStripeEnabled,
  async (req, res) => {
    try {
      const { type, amount, currency = 'gbp', priceId, planName, successUrl, cancelUrl } = req.body;
      const user = req.user;

      // Validation
      if (!type || !['one_time', 'subscription'].includes(type)) {
        return res
          .status(400)
          .json({ error: 'Invalid payment type. Must be "one_time" or "subscription".' });
      }

      if (type === 'one_time' && !amount) {
        return res.status(400).json({ error: 'Amount is required for one-time payments.' });
      }

      if (type === 'subscription' && !priceId) {
        return res.status(400).json({ error: 'Price ID is required for subscriptions.' });
      }

      // Get or create Stripe customer
      let customer;
      const existingPayments = await dbUnified.find('payments', { userId: user.id });
      const existingCustomerId = existingPayments.find(p => p.stripeCustomerId)?.stripeCustomerId;

      if (existingCustomerId) {
        try {
          customer = await stripe.customers.retrieve(existingCustomerId);
        } catch (err) {
          console.warn('Failed to retrieve existing customer:', err.message);
          customer = null;
        }
      }

      if (!customer) {
        customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
            name: user.name || '',
          },
        });
      }

      // Create checkout session
      const sessionConfig = {
        customer: customer.id,
        mode: type === 'subscription' ? 'subscription' : 'payment',
        success_url: successUrl || `${STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || STRIPE_CANCEL_URL,
        metadata: {
          userId: user.id,
          type: type,
        },
      };

      if (type === 'one_time') {
        sessionConfig.line_items = [
          {
            price_data: {
              currency: currency,
              product_data: {
                name: 'EventFlow Payment',
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ];
      } else {
        // Subscription
        sessionConfig.line_items = [
          {
            price: priceId,
            quantity: 1,
          },
        ];
        if (planName) {
          sessionConfig.metadata.planName = planName;
        }
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      // Create pending payment record
      const paymentId = uid();
      const paymentRecord = {
        id: paymentId,
        stripePaymentId: session.payment_intent || session.id,
        stripeCustomerId: customer.id,
        userId: user.id,
        amount: type === 'one_time' ? amount / 100 : 0, // Convert to main currency unit
        currency: currency,
        status: 'pending',
        type: type,
        metadata: {
          sessionId: session.id,
          planName: planName || '',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbUnified.create('payments', paymentRecord);

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({
        error: 'Failed to create checkout session',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/payments/create-portal-session
 * Create a Stripe billing portal session for managing subscriptions
 *
 * Body:
 * {
 *   returnUrl?: string (optional, defaults to dashboard)
 * }
 */
router.post(
  '/create-portal-session',
  authRequired,
  writeLimiter,
  ensureStripeEnabled,
  async (req, res) => {
    try {
      const user = req.user;
      const { returnUrl } = req.body;

      // Find user's Stripe customer ID
      const existingPayments = await dbUnified.find('payments', { userId: user.id });
      const stripeCustomerId = existingPayments.find(p => p.stripeCustomerId)?.stripeCustomerId;

      if (!stripeCustomerId) {
        return res.status(404).json({
          error: 'No payment history found',
          message: 'You need to make a payment before accessing the billing portal.',
        });
      }

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl || `${process.env.BASE_URL}/dashboard-supplier.html`,
      });

      res.json({
        success: true,
        url: session.url,
      });
    } catch (error) {
      console.error('Error creating portal session:', error);
      res.status(500).json({
        error: 'Failed to create billing portal session',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/payments/webhook
 * Stripe webhook handler for payment and subscription events
 *
 * Handles:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!STRIPE_ENABLED || !stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('Missing Stripe signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  let event;

  try {
    // Verify webhook signature
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // In development/test, parse without verification
      console.warn('⚠️  Webhook signature verification skipped (STRIPE_WEBHOOK_SECRET not set)');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log(`Received webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Find payment record by session ID
  const payments = await dbUnified.find('payments', {
    'metadata.sessionId': session.id,
  });

  if (payments.length === 0) {
    console.warn('No payment record found for session:', session.id);
    return;
  }

  const payment = payments[0];

  // Update payment record
  const updates = {
    status: 'succeeded',
    stripePaymentId: session.payment_intent || session.id,
    updatedAt: new Date().toISOString(),
  };

  if (session.subscription) {
    updates.stripeSubscriptionId = session.subscription;
  }

  await dbUnified.update('payments', payment.id, updates);

  console.log(`Payment ${payment.id} marked as succeeded`);
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(subscription) {
  const customerId = subscription.customer;

  // Find user by customer ID
  const payments = await dbUnified.find('payments', {
    stripeCustomerId: customerId,
  });

  if (payments.length === 0) {
    console.warn('No payment records found for customer:', customerId);
    return;
  }

  const userId = payments[0].userId;

  // Create subscription payment record
  const paymentId = uid();
  const paymentRecord = {
    id: paymentId,
    stripePaymentId: subscription.latest_invoice || subscription.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    userId: userId,
    amount: subscription.plan.amount / 100,
    currency: subscription.plan.currency,
    status: subscription.status === 'active' ? 'succeeded' : 'pending',
    type: 'subscription',
    subscriptionDetails: {
      planId: subscription.plan.id,
      planName: subscription.plan.nickname || subscription.plan.product,
      interval: subscription.plan.interval,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    metadata: subscription.metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dbUnified.create('payments', paymentRecord);

  // Update user's Pro status if applicable
  if (subscription.status === 'active') {
    const users = await dbUnified.find('users', { id: userId });
    if (users.length > 0) {
      await dbUnified.update('users', userId, {
        isPro: true,
        proExpiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    }
  }

  console.log(`Subscription ${subscription.id} created for user ${userId}`);
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  // Find payment record by subscription ID
  const payments = await dbUnified.find('payments', {
    stripeSubscriptionId: subscription.id,
  });

  if (payments.length === 0) {
    console.warn('No payment records found for subscription:', subscription.id);
    return;
  }

  const payment = payments[payments.length - 1]; // Get most recent
  const userId = payment.userId;

  // Update subscription details
  const updates = {
    status: subscription.status === 'active' ? 'succeeded' : subscription.status,
    subscriptionDetails: {
      planId: subscription.plan.id,
      planName: subscription.plan.nickname || subscription.plan.product,
      interval: subscription.plan.interval,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    },
    updatedAt: new Date().toISOString(),
  };

  await dbUnified.update('payments', payment.id, updates);

  // Update user's Pro status
  const users = await dbUnified.find('users', { id: userId });
  if (users.length > 0) {
    const userUpdates = {
      isPro: subscription.status === 'active',
      proExpiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
    };
    await dbUnified.update('users', userId, userUpdates);
  }

  console.log(`Subscription ${subscription.id} updated`);
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  // Find payment record by subscription ID
  const payments = await dbUnified.find('payments', {
    stripeSubscriptionId: subscription.id,
  });

  if (payments.length === 0) {
    console.warn('No payment records found for subscription:', subscription.id);
    return;
  }

  const payment = payments[payments.length - 1];
  const userId = payment.userId;

  // Mark subscription as cancelled
  await dbUnified.update('payments', payment.id, {
    status: 'cancelled',
    subscriptionDetails: {
      ...payment.subscriptionDetails,
      canceledAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  });

  // Update user's Pro status to expired
  const users = await dbUnified.find('users', { id: userId });
  if (users.length > 0) {
    await dbUnified.update('users', userId, {
      isPro: false,
    });
  }

  console.log(`Subscription ${subscription.id} deleted for user ${userId}`);
}

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentSucceeded(paymentIntent) {
  const payments = await dbUnified.find('payments', {
    stripePaymentId: paymentIntent.id,
  });

  if (payments.length === 0) {
    console.warn('No payment record found for payment intent:', paymentIntent.id);
    return;
  }

  const payment = payments[0];

  await dbUnified.update('payments', payment.id, {
    status: 'succeeded',
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    updatedAt: new Date().toISOString(),
  });

  console.log(`Payment intent ${paymentIntent.id} succeeded`);
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent) {
  const payments = await dbUnified.find('payments', {
    stripePaymentId: paymentIntent.id,
  });

  if (payments.length === 0) {
    console.warn('No payment record found for payment intent:', paymentIntent.id);
    return;
  }

  const payment = payments[0];

  await dbUnified.update('payments', payment.id, {
    status: 'failed',
    metadata: {
      ...payment.metadata,
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
    },
    updatedAt: new Date().toISOString(),
  });

  console.log(`Payment intent ${paymentIntent.id} failed`);
}

/**
 * GET /api/payments
 * Get user's payment history
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const payments = await dbUnified.find('payments', { userId: user.id });

    // Sort by creation date, newest first
    payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      payments: payments,
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      error: 'Failed to fetch payment history',
      message: error.message,
    });
  }
});

/**
 * GET /api/payments/:id
 * Get specific payment details
 */
router.get('/:id', authRequired, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const payments = await dbUnified.find('payments', { id: id, userId: user.id });

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      success: true,
      payment: payments[0],
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      error: 'Failed to fetch payment',
      message: error.message,
    });
  }
});

module.exports = router;
