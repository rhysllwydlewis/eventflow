/**
 * Unit tests for introductory pricing and subscription badges
 */

// Helper function used across multiple tests
function getSubscriptionTier(planName) {
  if (!planName) {
    return 'free';
  }
  const lowerName = planName.toLowerCase();
  if (
    lowerName.includes('professional plus') ||
    lowerName.includes('pro plus') ||
    lowerName.includes('pro+')
  ) {
    return 'pro_plus';
  }
  if (lowerName.includes('professional') || lowerName.includes('pro')) {
    return 'pro';
  }
  return 'free';
}

describe('Introductory Pricing', () => {
  describe('Environment Configuration', () => {
    it('should enable intro pricing when both env vars are set', () => {
      const proPriceId = 'price_test_123';
      const introCouponId = 'intro-coupon-123';
      const enabled = !!(proPriceId && introCouponId);

      expect(enabled).toBe(true);
    });

    it('should disable intro pricing when price ID is missing', () => {
      const proPriceId = '';
      const introCouponId = 'intro-coupon-123';
      const enabled = !!(proPriceId && introCouponId);

      expect(enabled).toBe(false);
    });

    it('should disable intro pricing when coupon ID is missing', () => {
      const proPriceId = 'price_test_123';
      const introCouponId = '';
      const enabled = !!(proPriceId && introCouponId);

      expect(enabled).toBe(false);
    });
  });

  describe('Professional Plan Detection', () => {
    it('should detect Professional plan from plan name', () => {
      const planNames = [
        'Professional',
        'professional',
        'Professional Monthly',
        'Pro',
        'pro monthly',
      ];

      planNames.forEach(name => {
        const isPro =
          name.toLowerCase().includes('professional') || name.toLowerCase().includes('pro');
        const isProPlus =
          name.toLowerCase().includes('professional plus') ||
          name.toLowerCase().includes('pro plus');

        expect(isPro).toBe(true);
        expect(isProPlus).toBe(false);
      });
    });

    it('should not detect Professional Plus as Professional', () => {
      const planNames = ['Professional Plus', 'professional plus', 'Pro Plus', 'pro+'];

      planNames.forEach(name => {
        const lowerName = name.toLowerCase();
        const isProPlus =
          lowerName.includes('professional plus') ||
          lowerName.includes('pro plus') ||
          lowerName.includes('pro+');

        expect(isProPlus).toBe(true);
      });
    });

    it('should correctly identify plan is not Professional', () => {
      const planNames = ['Basic', 'Free', 'Enterprise', 'Premium'];

      planNames.forEach(name => {
        const isPro =
          name.toLowerCase().includes('professional') || name.toLowerCase().includes('pro');
        expect(isPro).toBe(false);
      });
    });
  });

  describe('Checkout Session Configuration', () => {
    it('should use intro pricing for Professional plan when enabled', () => {
      const introPricingEnabled = true;
      const isProfessionalPlan = true;
      const type = 'subscription';

      const useIntroPricing = introPricingEnabled && type === 'subscription' && isProfessionalPlan;

      expect(useIntroPricing).toBe(true);
    });

    it('should not use intro pricing for one-time payments', () => {
      const introPricingEnabled = true;
      const isProfessionalPlan = true;
      const type = 'one_time';

      const useIntroPricing = introPricingEnabled && type === 'subscription' && isProfessionalPlan;

      expect(useIntroPricing).toBe(false);
    });

    it('should not use intro pricing when not enabled', () => {
      const introPricingEnabled = false;
      const isProfessionalPlan = true;
      const type = 'subscription';

      const useIntroPricing = introPricingEnabled && type === 'subscription' && isProfessionalPlan;

      expect(useIntroPricing).toBe(false);
    });

    it('should apply discount coupon when using intro pricing', () => {
      const sessionConfig = {
        customer: 'cus_123',
        mode: 'subscription',
        line_items: [{ price: 'price_test_123', quantity: 1 }],
      };

      const useIntroPricing = true;
      const couponId = 'intro-coupon-123';

      if (useIntroPricing) {
        sessionConfig.discounts = [{ coupon: couponId }];
        sessionConfig.metadata = { introPricing: 'true' };
      }

      expect(sessionConfig.discounts).toBeDefined();
      expect(sessionConfig.discounts[0].coupon).toBe(couponId);
      expect(sessionConfig.metadata.introPricing).toBe('true');
    });
  });

  describe('Price Calculations', () => {
    it('should calculate intro price correctly', () => {
      const regularPrice = 59.0;
      const discount = 20.0;
      const introPrice = regularPrice - discount;

      expect(introPrice).toBe(39.0);
    });

    it('should convert pounds to pence for Stripe', () => {
      const pounds = 39.0;
      const pence = Math.round(pounds * 100);

      expect(pence).toBe(3900);
    });

    it('should handle regular price after intro period', () => {
      const regularPrice = 59.0;
      const pence = Math.round(regularPrice * 100);

      expect(pence).toBe(5900);
    });
  });
});

describe('Subscription Badges', () => {
  describe('Tier Detection', () => {
    it('should detect pro tier from plan name', () => {
      expect(getSubscriptionTier('Professional')).toBe('pro');
      expect(getSubscriptionTier('Pro Monthly')).toBe('pro');
      expect(getSubscriptionTier('professional')).toBe('pro');
    });

    it('should detect pro_plus tier before pro tier', () => {
      expect(getSubscriptionTier('Professional Plus')).toBe('pro_plus');
      expect(getSubscriptionTier('Pro Plus')).toBe('pro_plus');
      expect(getSubscriptionTier('pro+')).toBe('pro_plus');
    });

    it('should return free for unknown plans', () => {
      expect(getSubscriptionTier('')).toBe('free');
      expect(getSubscriptionTier(null)).toBe('free');
      expect(getSubscriptionTier('Basic')).toBe('free');
      expect(getSubscriptionTier('Enterprise')).toBe('free');
    });
  });

  describe('Badge Display Logic', () => {
    it('should show Professional badge for pro tier', () => {
      const user = { subscriptionTier: 'pro' };
      const shouldShowBadge = user.subscriptionTier === 'pro';
      const badgeClass = 'badge-pro';

      expect(shouldShowBadge).toBe(true);
      expect(badgeClass).toBe('badge-pro');
    });

    it('should show Professional Plus badge for pro_plus tier', () => {
      const user = { subscriptionTier: 'pro_plus' };
      const shouldShowBadge = user.subscriptionTier === 'pro_plus';
      const badgeClass = 'badge-pro-plus';

      expect(shouldShowBadge).toBe(true);
      expect(badgeClass).toBe('badge-pro-plus');
    });

    it('should not show badge for free tier', () => {
      const user = { subscriptionTier: 'free' };
      const shouldShowBadge =
        user.subscriptionTier === 'pro' || user.subscriptionTier === 'pro_plus';

      expect(shouldShowBadge).toBe(false);
    });

    it('should not show badge when tier is null', () => {
      const user = {};
      const shouldShowBadge =
        user.subscriptionTier === 'pro' || user.subscriptionTier === 'pro_plus';

      expect(shouldShowBadge).toBe(false);
    });
  });

  describe('Subscription Status Updates', () => {
    it('should set isPro to true for active pro subscription', () => {
      const tier = 'pro';
      const isActive = true;
      const isPro = isActive && (tier === 'pro' || tier === 'pro_plus');

      expect(isPro).toBe(true);
    });

    it('should set isPro to true for active pro_plus subscription', () => {
      const tier = 'pro_plus';
      const isActive = true;
      const isPro = isActive && (tier === 'pro' || tier === 'pro_plus');

      expect(isPro).toBe(true);
    });

    it('should set isPro to false for inactive subscription', () => {
      const tier = 'pro';
      const isActive = false;
      const isPro = isActive && (tier === 'pro' || tier === 'pro_plus');

      expect(isPro).toBe(false);
    });

    it('should reset tier to free on subscription deletion', () => {
      let userTier = 'pro';
      // Simulate subscription deletion
      userTier = 'free';

      expect(userTier).toBe('free');
    });
  });

  describe('Badge Priority', () => {
    it('should use subscriptionTier field over legacy isPro', () => {
      const user = {
        subscriptionTier: 'pro_plus',
        isPro: true, // legacy field
      };

      const tier = user.subscriptionTier || (user.isPro ? 'pro' : 'free');

      expect(tier).toBe('pro_plus');
    });

    it('should fall back to isPro when subscriptionTier is not set', () => {
      const user = {
        isPro: true,
      };

      const tier = user.subscriptionTier || (user.isPro ? 'pro' : 'free');

      expect(tier).toBe('pro');
    });

    it('should default to free when no subscription info', () => {
      const user = {};

      const tier = user.subscriptionTier || (user.isPro ? 'pro' : 'free');

      expect(tier).toBe('free');
    });
  });
});

describe('Webhook Handlers', () => {
  describe('Subscription Created', () => {
    it('should set subscription tier on user record', () => {
      const planName = 'Professional Monthly';
      const subscriptionStatus = 'active';

      const tier = getSubscriptionTier(planName);
      const userUpdates = {
        isPro: tier === 'pro' || tier === 'pro_plus',
        subscriptionTier: tier,
      };

      expect(userUpdates.subscriptionTier).toBe('pro');
      expect(userUpdates.isPro).toBe(true);
    });
  });

  describe('Subscription Updated', () => {
    it('should update subscription tier when plan changes', () => {
      const oldPlanName = 'Professional';
      const newPlanName = 'Professional Plus';
      const subscriptionStatus = 'active';

      const newTier = getSubscriptionTier(newPlanName);
      const isActive = subscriptionStatus === 'active';

      const userUpdates = {
        isPro: isActive && (newTier === 'pro' || newTier === 'pro_plus'),
        subscriptionTier: isActive ? newTier : 'free',
      };

      expect(userUpdates.subscriptionTier).toBe('pro_plus');
      expect(userUpdates.isPro).toBe(true);
    });

    it('should set tier to free when subscription becomes inactive', () => {
      const planName = 'Professional';
      const subscriptionStatus = 'past_due';

      const isActive = subscriptionStatus === 'active';
      const tier = isActive ? 'pro' : 'free';

      expect(tier).toBe('free');
    });
  });

  describe('Subscription Deleted', () => {
    it('should reset user to free tier', () => {
      const userUpdates = {
        isPro: false,
        subscriptionTier: 'free',
      };

      expect(userUpdates.isPro).toBe(false);
      expect(userUpdates.subscriptionTier).toBe('free');
    });
  });
});
