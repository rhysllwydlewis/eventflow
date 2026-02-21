/**
 * Unit tests for pricing page customer/supplier access logic
 * Mirrors the business rules in public/assets/js/pricing.js
 */

'use strict';

// --------------------------------------------------------------------------
// Pure helper functions extracted from pricing.js for testability
// --------------------------------------------------------------------------

function getActiveTier(user) {
  if (!user) {
    return 'free';
  }
  const tier = user.subscriptionTier || 'free';
  if (tier !== 'free') {
    if (user.proExpiresAt) {
      const expiryTime = Date.parse(user.proExpiresAt);
      if (!isNaN(expiryTime) && expiryTime <= Date.now()) {
        return 'free';
      }
    }
    return tier;
  }
  if (user.isPro) {
    if (user.proExpiresAt) {
      const expiryTime = Date.parse(user.proExpiresAt);
      if (!isNaN(expiryTime) && expiryTime <= Date.now()) {
        return 'free';
      }
    }
    return 'pro';
  }
  return 'free';
}

// Map pricing page plan query-string keys to subscription tier strings
const PLAN_TIERS = { starter: 'free', free: 'free', pro: 'pro', pro_plus: 'pro_plus' };

/**
 * Determine what CTA state a user should see on the pricing page for a given plan.
 * Returns one of: 'get_started_for_free', 'your_current_plan',
 *                 'upgrade', 'for_suppliers_only'
 */
function getPricingCtaState(user, plan) {
  if (!user) {
    return 'get_started_for_free';
  }

  if (user.role === 'customer') {
    return 'for_suppliers_only';
  }

  // Supplier/admin
  const tier = getActiveTier(user);
  const planTier = PLAN_TIERS[plan] || plan;

  if (planTier === tier) {
    return 'your_current_plan';
  }

  return 'upgrade';
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('Pricing page CTA logic', () => {
  describe('Unauthenticated users', () => {
    it('shows "Get Started for Free" on the starter plan when not logged in', () => {
      expect(getPricingCtaState(null, 'starter')).toBe('get_started_for_free');
    });

    it('shows "Get Started for Free" on the free plan when not logged in', () => {
      expect(getPricingCtaState(null, 'free')).toBe('get_started_for_free');
    });

    it('redirects to auth for pro plan when not logged in', () => {
      expect(getPricingCtaState(null, 'pro')).toBe('get_started_for_free');
    });
  });

  describe('Customer users', () => {
    const customer = { role: 'customer', isPro: false };

    it('shows "For Suppliers Only" on the starter plan', () => {
      expect(getPricingCtaState(customer, 'starter')).toBe('for_suppliers_only');
    });

    it('shows "For Suppliers Only" on the pro plan', () => {
      expect(getPricingCtaState(customer, 'pro')).toBe('for_suppliers_only');
    });

    it('shows "For Suppliers Only" on the pro_plus plan', () => {
      expect(getPricingCtaState(customer, 'pro_plus')).toBe('for_suppliers_only');
    });

    it('shows "For Suppliers Only" even if customer somehow has isPro set', () => {
      const proCustomer = { role: 'customer', isPro: true };
      expect(getPricingCtaState(proCustomer, 'pro')).toBe('for_suppliers_only');
    });
  });

  describe('Supplier users on Starter plan (no subscription)', () => {
    const starterSupplier = { role: 'supplier', isPro: false, subscriptionTier: 'free' };

    it('shows "Your Current Plan" on the starter plan', () => {
      expect(getPricingCtaState(starterSupplier, 'starter')).toBe('your_current_plan');
    });

    it('shows "Your Current Plan" on the free plan alias', () => {
      expect(getPricingCtaState(starterSupplier, 'free')).toBe('your_current_plan');
    });

    it('shows upgrade state for pro plan', () => {
      expect(getPricingCtaState(starterSupplier, 'pro')).toBe('upgrade');
    });

    it('shows upgrade state for pro_plus plan', () => {
      expect(getPricingCtaState(starterSupplier, 'pro_plus')).toBe('upgrade');
    });
  });

  describe('Supplier users on active Pro plan', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const proSupplier = {
      role: 'supplier',
      isPro: true,
      proExpiresAt: futureDate,
      subscriptionTier: 'pro',
    };

    it('shows upgrade state for starter plan when already on Pro', () => {
      expect(getPricingCtaState(proSupplier, 'starter')).toBe('upgrade');
    });

    it('shows "Your Current Plan" for the pro plan', () => {
      expect(getPricingCtaState(proSupplier, 'pro')).toBe('your_current_plan');
    });

    it('shows upgrade state for pro_plus plan', () => {
      expect(getPricingCtaState(proSupplier, 'pro_plus')).toBe('upgrade');
    });
  });

  describe('Supplier users on active Pro Plus plan', () => {
    const proPlus = { role: 'supplier', isPro: true, subscriptionTier: 'pro_plus' };

    it('shows upgrade state for starter plan when on Pro Plus', () => {
      expect(getPricingCtaState(proPlus, 'starter')).toBe('upgrade');
    });

    it('shows upgrade state for pro plan when on Pro Plus', () => {
      expect(getPricingCtaState(proPlus, 'pro')).toBe('upgrade');
    });

    it('shows "Your Current Plan" for the pro_plus plan', () => {
      expect(getPricingCtaState(proPlus, 'pro_plus')).toBe('your_current_plan');
    });
  });

  describe('Supplier with expired Pro plan', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const expiredProSupplier = {
      role: 'supplier',
      isPro: true,
      proExpiresAt: pastDate,
      subscriptionTier: 'pro',
    };

    it('shows "Your Current Plan" on starter (Pro has expired, falls back to free)', () => {
      expect(getPricingCtaState(expiredProSupplier, 'starter')).toBe('your_current_plan');
    });

    it('shows upgrade state for pro (subscription expired)', () => {
      expect(getPricingCtaState(expiredProSupplier, 'pro')).toBe('upgrade');
    });
  });
});

describe('getActiveTier helper', () => {
  it('returns "free" for null user', () => {
    expect(getActiveTier(null)).toBe('free');
  });

  it('returns "free" when subscriptionTier is free and isPro is false', () => {
    expect(getActiveTier({ subscriptionTier: 'free', isPro: false })).toBe('free');
  });

  it('returns "pro" when subscriptionTier is pro', () => {
    expect(getActiveTier({ subscriptionTier: 'pro' })).toBe('pro');
  });

  it('returns "pro_plus" when subscriptionTier is pro_plus', () => {
    expect(getActiveTier({ subscriptionTier: 'pro_plus' })).toBe('pro_plus');
  });

  it('returns "free" when subscriptionTier is pro but proExpiresAt is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(getActiveTier({ subscriptionTier: 'pro', proExpiresAt: past })).toBe('free');
  });

  it('returns "pro" when subscriptionTier is pro and proExpiresAt is in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(getActiveTier({ subscriptionTier: 'pro', proExpiresAt: future })).toBe('pro');
  });

  it('falls back to "pro" from isPro when subscriptionTier is absent', () => {
    expect(getActiveTier({ isPro: true })).toBe('pro');
  });

  it('returns "free" via isPro fallback when proExpiresAt is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(getActiveTier({ isPro: true, proExpiresAt: past })).toBe('free');
  });

  it('returns "pro" via isPro fallback when expiry is invalid', () => {
    expect(getActiveTier({ isPro: true, proExpiresAt: 'invalid' })).toBe('pro');
  });
});
