/**
 * Subscription-based feature gating middleware
 * Replaces legacy isPro checks with proper subscription service
 */

'use strict';

const subscriptionService = require('../services/subscriptionService');

/**
 * Require a minimum subscription tier
 * @param {string} minTier - Minimum tier required (free, basic, pro, pro_plus, enterprise)
 * @returns {Function} Express middleware
 */
function requireSubscription(minTier = 'free') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const subscription = await subscriptionService.getSubscriptionByUserId(req.user.id);
      const currentTier = subscription?.plan || 'free';

      const tierLevels = { free: 0, basic: 1, pro: 2, pro_plus: 3, enterprise: 4 };

      if (tierLevels[currentTier] >= tierLevels[minTier]) {
        req.subscription = subscription; // Attach to request
        return next();
      }

      return res.status(403).json({
        error: 'Subscription upgrade required',
        currentTier,
        requiredTier: minTier,
        upgradeUrl: '/supplier/subscription.html',
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json({ error: 'Failed to check subscription status' });
    }
  };
}

/**
 * Check if user has access to a specific feature
 * @param {string} feature - Feature name to check
 * @returns {Function} Express middleware
 */
function checkFeatureLimit(feature) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const hasAccess = await subscriptionService.checkFeatureAccess(req.user.id, feature);

      if (hasAccess) {
        return next();
      }

      return res.status(403).json({
        error: `Feature '${feature}' requires subscription upgrade`,
        upgradeUrl: '/supplier/subscription.html',
      });
    } catch (error) {
      console.error('Error checking feature access:', error);
      return res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
}

module.exports = { requireSubscription, checkFeatureLimit };
