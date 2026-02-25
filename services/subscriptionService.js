/**
 * Subscription Service
 * Handles subscription lifecycle, upgrades, downgrades, cancellations, and feature gating
 */

'use strict';

const dbUnified = require('../db-unified');
const store = require('../store');
const { getPlanFeatures, hasFeature, getAllPlans } = require('../models/Subscription');

async function persistUserSubscriptionState(userId, updates) {
  const nowIso = new Date().toISOString();
  const normalizedUpdates = {
    ...updates,
    updatedAt: nowIso,
  };

  await dbUnified.updateOne('users', { id: userId }, { $set: normalizedUpdates });
}

/**
 * Create a new subscription
 * @param {Object} params - Subscription parameters
 * @param {string} params.userId - User ID
 * @param {string} params.plan - Plan tier (free, pro, pro_plus, enterprise)
 * @param {string} params.stripeSubscriptionId - Stripe subscription ID
 * @param {string} params.stripeCustomerId - Stripe customer ID
 * @param {Date} params.trialEnd - Trial end date (optional)
 * @returns {Promise<Object>} Created subscription
 */
async function createSubscription({
  userId,
  plan,
  stripeSubscriptionId,
  stripeCustomerId,
  trialEnd = null,
}) {
  const now = new Date().toISOString();
  const subscription = {
    id: store.uid('sub'),
    userId,
    plan,
    status: trialEnd ? 'trialing' : 'active',
    stripeSubscriptionId: stripeSubscriptionId || null,
    stripeCustomerId: stripeCustomerId || null,
    trialStart: trialEnd ? now : null,
    trialEnd: trialEnd ? trialEnd.toISOString() : null,
    currentPeriodStart: now,
    currentPeriodEnd: null,
    nextBillingDate: trialEnd ? trialEnd.toISOString() : null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    cancelReason: null,
    billingHistory: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  await dbUnified.insertOne('subscriptions', subscription);

  // Update user record with subscription reference and tier.
  await persistUserSubscriptionState(userId, {
    subscriptionId: subscription.id,
    subscriptionTier: plan,
    isPro: !['free', 'basic'].includes(plan),
  });

  return subscription;
}

/**
 * Get subscription by ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object|null>} Subscription object or null
 */
async function getSubscription(subscriptionId) {
  const subscriptions = await dbUnified.read('subscriptions');
  return subscriptions.find(s => s.id === subscriptionId) || null;
}

/**
 * Get subscription by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Subscription object or null
 */
async function getSubscriptionByUserId(userId) {
  const subscriptions = await dbUnified.read('subscriptions');
  return subscriptions.find(s => s.userId === userId && s.status !== 'canceled') || null;
}

/**
 * Get subscription by Stripe subscription ID
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @returns {Promise<Object|null>} Subscription object or null
 */
async function getSubscriptionByStripeId(stripeSubscriptionId) {
  const subscriptions = await dbUnified.read('subscriptions');
  return subscriptions.find(s => s.stripeSubscriptionId === stripeSubscriptionId) || null;
}

/**
 * Update subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated subscription
 */
async function updateSubscription(subscriptionId, updates) {
  const subscriptions = await dbUnified.read('subscriptions');
  const subscription = subscriptions.find(s => s.id === subscriptionId);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  Object.assign(subscription, updates, {
    updatedAt: new Date().toISOString(),
  });

  await dbUnified.updateOne(
    'subscriptions',
    { id: subscriptionId },
    {
      $set: { ...updates, updatedAt: new Date().toISOString() },
    }
  );

  // Update user isPro status and subscriptionTier if plan changed
  if (updates.plan) {
    await persistUserSubscriptionState(subscription.userId, {
      subscriptionTier: updates.plan,
      isPro: !['free', 'basic'].includes(updates.plan),
    });
  }

  return subscription;
}

/**
 * Upgrade subscription to a higher tier
 * @param {string} subscriptionId - Subscription ID
 * @param {string} newPlan - New plan tier
 * @returns {Promise<Object>} Updated subscription
 */
async function upgradeSubscription(subscriptionId, newPlan) {
  const subscription = await getSubscription(subscriptionId);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const planHierarchy = ['free', 'basic', 'pro', 'pro_plus', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(subscription.plan);
  const newIndex = planHierarchy.indexOf(newPlan);

  if (newIndex <= currentIndex) {
    throw new Error('New plan must be higher tier than current plan');
  }

  return updateSubscription(subscriptionId, {
    plan: newPlan,
    status: 'active',
  });
}

/**
 * Downgrade subscription to a lower tier
 * @param {string} subscriptionId - Subscription ID
 * @param {string} newPlan - New plan tier
 * @returns {Promise<Object>} Updated subscription
 */
async function downgradeSubscription(subscriptionId, newPlan) {
  const subscription = await getSubscription(subscriptionId);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const planHierarchy = ['free', 'basic', 'pro', 'pro_plus', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(subscription.plan);
  const newIndex = planHierarchy.indexOf(newPlan);

  if (newIndex >= currentIndex) {
    throw new Error('New plan must be lower tier than current plan');
  }

  return updateSubscription(subscriptionId, {
    plan: newPlan,
    cancelAtPeriodEnd: true, // Downgrade at period end
  });
}

/**
 * Cancel subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} reason - Cancellation reason (optional)
 * @param {boolean} immediately - Cancel immediately vs at period end
 * @returns {Promise<Object>} Updated subscription
 */
async function cancelSubscription(subscriptionId, reason = null, immediately = false) {
  const subscription = await getSubscription(subscriptionId);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const updates = {
    canceledAt: new Date().toISOString(),
    cancelReason: reason,
  };

  if (immediately) {
    updates.status = 'canceled';
    updates.plan = 'free';
  } else {
    updates.cancelAtPeriodEnd = true;
  }

  return updateSubscription(subscriptionId, updates);
}

/**
 * Check if user has access to a feature
 * @param {string} userId - User ID
 * @param {string} feature - Feature name
 * @returns {Promise<boolean>} Whether user has feature access
 */
async function checkFeatureAccess(userId, feature) {
  const subscription = await getSubscriptionByUserId(userId);

  if (subscription) {
    const { plan, status, currentPeriodEnd } = subscription;
    const periodValid = !currentPeriodEnd || new Date(currentPeriodEnd) > new Date();
    if ((status === 'active' || status === 'trialing') && periodValid) {
      return hasFeature(plan, feature);
    }
  }

  // Fallback: check subscriptionTier on user record (set by Stripe webhook)
  const users = await dbUnified.read('users');
  const user = users.find(u => u.id === userId);
  if (user?.subscriptionTier && user.subscriptionTier !== 'free') {
    if (!user.proExpiresAt || new Date(user.proExpiresAt) > new Date()) {
      return hasFeature(user.subscriptionTier, feature);
    }
  }

  // No subscription, check free plan
  return hasFeature('free', feature);
}

/**
 * Get features for user's subscription
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Feature configuration
 */
async function getUserFeatures(userId) {
  const subscription = await getSubscriptionByUserId(userId);

  if (!subscription) {
    return getPlanFeatures('free');
  }

  return getPlanFeatures(subscription.plan);
}

/**
 * Add billing record to subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} billingRecord - Billing record details
 * @returns {Promise<Object>} Updated subscription
 */
async function addBillingRecord(subscriptionId, billingRecord) {
  const subscription = await getSubscription(subscriptionId);

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const billingHistory = subscription.billingHistory || [];
  billingHistory.push({
    invoiceId: billingRecord.invoiceId,
    amount: billingRecord.amount,
    currency: billingRecord.currency,
    paid: billingRecord.paid,
    date: billingRecord.date || new Date().toISOString(),
  });

  return updateSubscription(subscriptionId, {
    billingHistory,
  });
}

/**
 * Update subscription billing dates
 * @param {string} subscriptionId - Subscription ID
 * @param {Date} periodStart - Period start date
 * @param {Date} periodEnd - Period end date
 * @returns {Promise<Object>} Updated subscription
 */
async function updateBillingDates(subscriptionId, periodStart, periodEnd) {
  return updateSubscription(subscriptionId, {
    currentPeriodStart: periodStart.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    nextBillingDate: periodEnd.toISOString(),
  });
}

/**
 * Check if subscription is in trial period
 * @param {Object} subscription - Subscription object
 * @returns {boolean} Whether subscription is in trial
 */
function isInTrial(subscription) {
  if (!subscription.trialEnd) {
    return false;
  }

  const now = new Date();
  const trialEnd = new Date(subscription.trialEnd);
  return now < trialEnd && subscription.status === 'trialing';
}

/**
 * Get all subscriptions with filters
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of subscriptions
 */
async function listSubscriptions(filters = {}) {
  const subscriptions = await dbUnified.read('subscriptions');
  let result = subscriptions;

  if (filters.status) {
    result = result.filter(s => s.status === filters.status);
  }

  if (filters.plan) {
    result = result.filter(s => s.plan === filters.plan);
  }

  if (filters.userId) {
    result = result.filter(s => s.userId === filters.userId);
  }

  return result;
}

/**
 * Get subscription statistics
 * @returns {Promise<Object>} Subscription statistics
 */
async function getSubscriptionStats() {
  const subscriptions = await dbUnified.read('subscriptions');

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    trialing: subscriptions.filter(s => s.status === 'trialing').length,
    canceled: subscriptions.filter(s => s.status === 'canceled').length,
    pastDue: subscriptions.filter(s => s.status === 'past_due').length,
    byPlan: {
      free: subscriptions.filter(s => s.plan === 'free').length,
      basic: subscriptions.filter(s => s.plan === 'basic').length,
      pro: subscriptions.filter(s => s.plan === 'pro').length,
      pro_plus: subscriptions.filter(s => s.plan === 'pro_plus').length,
      enterprise: subscriptions.filter(s => s.plan === 'enterprise').length,
    },
  };

  return stats;
}

module.exports = {
  createSubscription,
  getSubscription,
  getSubscriptionByUserId,
  getSubscriptionByStripeId,
  updateSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  checkFeatureAccess,
  getUserFeatures,
  addBillingRecord,
  updateBillingDates,
  isInTrial,
  listSubscriptions,
  getSubscriptionStats,
  getAllPlans,
};
