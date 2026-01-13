/**
 * Stripe Webhook Handler
 * Processes webhook events from Stripe for subscriptions, invoices, and payments
 */

'use strict';

const subscriptionService = require('../services/subscriptionService');
const paymentService = require('../services/paymentService');
const dbUnified = require('../db-unified');
const { uid } = require('../store');

/**
 * Handle invoice.created event
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoiceCreated(invoice) {
  console.log('Processing invoice.created:', invoice.id);

  const subscription = await subscriptionService.getSubscriptionByStripeId(invoice.subscription);

  if (!subscription) {
    console.warn('Subscription not found for invoice:', invoice.id);
    return;
  }

  // Create invoice record in database
  const lineItems = invoice.lines.data.map(line => ({
    name: line.description || 'Subscription',
    description: line.description || '',
    quantity: line.quantity || 1,
    unitPrice: line.amount / 100, // Convert from cents
    amount: line.amount / 100,
  }));

  const invoiceRecord = {
    id: uid('inv'),
    subscriptionId: subscription.id,
    userId: subscription.userId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    amount: invoice.total / 100,
    currency: invoice.currency,
    status: invoice.status === 'paid' ? 'paid' : 'open',
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    lineItems,
    subtotal: invoice.subtotal / 100,
    tax: invoice.tax / 100 || 0,
    discount: invoice.discount / 100 || 0,
    attemptCount: 0,
    metadata: {
      stripeInvoiceNumber: invoice.number || '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dbUnified.insertOne('invoices', invoiceRecord);
}

/**
 * Handle invoice.payment_succeeded event
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

  const subscription = await subscriptionService.getSubscriptionByStripeId(invoice.subscription);

  if (!subscription) {
    console.warn('Subscription not found for invoice:', invoice.id);
    return;
  }

  // Update invoice status
  const invoices = await dbUnified.read('invoices');
  const invoiceRecord = invoices.find(inv => inv.stripeInvoiceId === invoice.id);

  if (invoiceRecord) {
    invoiceRecord.status = 'paid';
    invoiceRecord.paidAt = new Date().toISOString();
    invoiceRecord.updatedAt = new Date().toISOString();
    await dbUnified.write('invoices', invoices);

    // Add billing record to subscription
    await subscriptionService.addBillingRecord(subscription.id, {
      invoiceId: invoiceRecord.id,
      amount: invoice.total / 100,
      currency: invoice.currency,
      paid: true,
      date: new Date().toISOString(),
    });
  }

  // Update subscription status to active if it was past_due
  if (subscription.status === 'past_due' || subscription.status === 'trialing') {
    await subscriptionService.updateSubscription(subscription.id, {
      status: 'active',
    });
  }

  // Update billing dates
  if (invoice.lines.data.length > 0) {
    const line = invoice.lines.data[0];
    if (line.period) {
      await subscriptionService.updateBillingDates(
        subscription.id,
        new Date(line.period.start * 1000),
        new Date(line.period.end * 1000)
      );
    }
  }
}

/**
 * Handle invoice.payment_failed event
 * @param {Object} invoice - Stripe invoice object
 */
async function handleInvoicePaymentFailed(invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  const subscription = await subscriptionService.getSubscriptionByStripeId(invoice.subscription);

  if (!subscription) {
    console.warn('Subscription not found for invoice:', invoice.id);
    return;
  }

  // Update invoice status and attempt count
  const invoices = await dbUnified.read('invoices');
  const invoiceRecord = invoices.find(inv => inv.stripeInvoiceId === invoice.id);

  if (invoiceRecord) {
    invoiceRecord.status = 'open';
    invoiceRecord.attemptCount = (invoiceRecord.attemptCount || 0) + 1;
    invoiceRecord.nextPaymentAttempt = invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null;
    invoiceRecord.updatedAt = new Date().toISOString();
    await dbUnified.write('invoices', invoices);
  }

  // Handle dunning
  await paymentService.handleFailedPayment(subscription.id, invoice);
}

/**
 * Handle customer.subscription.created event
 * @param {Object} stripeSubscription - Stripe subscription object
 */
async function handleSubscriptionCreated(stripeSubscription) {
  console.log('Processing customer.subscription.created:', stripeSubscription.id);

  // Check if subscription already exists
  const existing = await subscriptionService.getSubscriptionByStripeId(stripeSubscription.id);
  if (existing) {
    console.log('Subscription already exists:', existing.id);
    return;
  }

  // Find user by Stripe customer ID
  const payments = await dbUnified.read('payments');
  const payment = payments.find(p => p.stripeCustomerId === stripeSubscription.customer);

  if (!payment) {
    console.warn('User not found for Stripe customer:', stripeSubscription.customer);
    return;
  }

  // Determine plan from metadata or price
  const planName =
    stripeSubscription.metadata?.planName ||
    stripeSubscription.items.data[0]?.price?.nickname ||
    'pro';
  const plan = planName.toLowerCase().includes('enterprise')
    ? 'enterprise'
    : planName.toLowerCase().includes('pro')
      ? 'pro'
      : planName.toLowerCase().includes('basic')
        ? 'basic'
        : 'free';

  // Create subscription record
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : null;

  await subscriptionService.createSubscription({
    userId: payment.userId,
    plan,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: stripeSubscription.customer,
    trialEnd,
  });
}

/**
 * Handle customer.subscription.updated event
 * @param {Object} stripeSubscription - Stripe subscription object
 */
async function handleSubscriptionUpdated(stripeSubscription) {
  console.log('Processing customer.subscription.updated:', stripeSubscription.id);

  const subscription = await subscriptionService.getSubscriptionByStripeId(stripeSubscription.id);

  if (!subscription) {
    console.warn('Subscription not found:', stripeSubscription.id);
    return;
  }

  // Update subscription status and dates
  const updates = {
    status: stripeSubscription.status,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    nextBillingDate: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  };

  if (stripeSubscription.canceled_at) {
    updates.canceledAt = new Date(stripeSubscription.canceled_at * 1000).toISOString();
  }

  await subscriptionService.updateSubscription(subscription.id, updates);
}

/**
 * Handle customer.subscription.deleted event
 * @param {Object} stripeSubscription - Stripe subscription object
 */
async function handleSubscriptionDeleted(stripeSubscription) {
  console.log('Processing customer.subscription.deleted:', stripeSubscription.id);

  const subscription = await subscriptionService.getSubscriptionByStripeId(stripeSubscription.id);

  if (!subscription) {
    console.warn('Subscription not found:', stripeSubscription.id);
    return;
  }

  // Cancel subscription and downgrade to free
  await subscriptionService.updateSubscription(subscription.id, {
    status: 'canceled',
    plan: 'free',
    canceledAt: new Date().toISOString(),
  });
}

/**
 * Handle payment_intent.succeeded event
 * @param {Object} paymentIntent - Stripe payment intent object
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  const payment = await paymentService.getPaymentByStripeId(paymentIntent.id);

  if (payment) {
    await paymentService.updatePaymentRecord(payment.id, {
      status: 'succeeded',
    });
  }
}

/**
 * Handle payment_intent.payment_failed event
 * @param {Object} paymentIntent - Stripe payment intent object
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.log('Processing payment_intent.payment_failed:', paymentIntent.id);

  const payment = await paymentService.getPaymentByStripeId(paymentIntent.id);

  if (payment) {
    await paymentService.updatePaymentRecord(payment.id, {
      status: 'failed',
      metadata: {
        ...payment.metadata,
        failureMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
      },
    });
  }
}

/**
 * Handle charge.refunded event
 * @param {Object} charge - Stripe charge object
 */
async function handleChargeRefunded(charge) {
  console.log('Processing charge.refunded:', charge.id);

  const payment = await paymentService.getPaymentByStripeId(charge.payment_intent);

  if (payment) {
    await paymentService.updatePaymentRecord(payment.id, {
      status: 'refunded',
      metadata: {
        ...payment.metadata,
        refundAmount: charge.amount_refunded / 100,
      },
    });
  }
}

/**
 * Process Stripe webhook event
 * @param {Object} event - Stripe event object
 */
async function processWebhookEvent(event) {
  try {
    switch (event.type) {
      // Invoice events
      case 'invoice.created':
        await handleInvoiceCreated(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      // Subscription events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      // Payment events
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      default:
        console.log('Unhandled webhook event type:', event.type);
    }
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);
    throw error;
  }
}

module.exports = {
  processWebhookEvent,
  handleInvoiceCreated,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleChargeRefunded,
};
