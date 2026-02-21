/**
 * Unit tests for pricing page customer/supplier access logic
 * Mirrors the business rules in public/assets/js/pricing.js
 */

'use strict';

// --------------------------------------------------------------------------
// Pure helper functions extracted from pricing.js for testability
// --------------------------------------------------------------------------

function isProActive(user) {
  if (!user || !user.isPro) {
    return false;
  }
  if (!user.proExpiresAt) {
    return !!user.isPro;
  }
  const expiryTime = Date.parse(user.proExpiresAt);
  if (isNaN(expiryTime)) {
    return !!user.isPro;
  }
  return expiryTime > Date.now();
}

/**
 * Determine what CTA state a user should see on the pricing page.
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
  if (plan === 'starter' || plan === 'free') {
    return isProActive(user) ? 'upgrade' : 'your_current_plan';
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

  describe('Supplier users on Starter plan', () => {
    const starterSupplier = { role: 'supplier', isPro: false };

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
    const proSupplier = { role: 'supplier', isPro: true, proExpiresAt: futureDate };

    it('shows upgrade state for starter plan when already on Pro', () => {
      expect(getPricingCtaState(proSupplier, 'starter')).toBe('upgrade');
    });

    it('shows upgrade state for pro plan', () => {
      expect(getPricingCtaState(proSupplier, 'pro')).toBe('upgrade');
    });
  });

  describe('Supplier with expired Pro plan', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const expiredProSupplier = { role: 'supplier', isPro: true, proExpiresAt: pastDate };

    it('shows "Your Current Plan" on starter (Pro has expired)', () => {
      expect(getPricingCtaState(expiredProSupplier, 'starter')).toBe('your_current_plan');
    });
  });
});

describe('isProActive helper', () => {
  it('returns false for null user', () => {
    expect(isProActive(null)).toBe(false);
  });

  it('returns false when isPro is false', () => {
    expect(isProActive({ isPro: false })).toBe(false);
  });

  it('returns true when isPro is true and no expiry', () => {
    expect(isProActive({ isPro: true })).toBe(true);
  });

  it('returns true when expiry is in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(isProActive({ isPro: true, proExpiresAt: future })).toBe(true);
  });

  it('returns false when expiry is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isProActive({ isPro: true, proExpiresAt: past })).toBe(false);
  });

  it('returns true when expiry is unparseable (non-date string)', () => {
    expect(isProActive({ isPro: true, proExpiresAt: 'invalid' })).toBe(true);
  });
});
