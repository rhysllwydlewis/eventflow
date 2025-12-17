/**
 * Firebase Cloud Functions Entry Point
 * Exports all functions for EventFlow
 */

const subscriptions = require('./subscriptions');

// Export subscription management functions
exports.onPaymentSuccess = subscriptions.onPaymentSuccess;
exports.checkSubscriptionStatus = subscriptions.checkSubscriptionStatus;
exports.cancelSubscription = subscriptions.cancelSubscription;
exports.updateSubscription = subscriptions.updateSubscription;
exports.initializeSubscriptionPlans = subscriptions.initializeSubscriptionPlans;
