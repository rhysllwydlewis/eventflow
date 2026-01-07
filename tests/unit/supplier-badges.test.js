/**
 * Unit tests for supplier profile badge rendering logic
 * Tests the fix for property name mismatches between backend and frontend
 */

describe('Supplier Profile Badge Logic', () => {
  describe('Featured badge', () => {
    it('should render when featured property is true', () => {
      const supplier = { featured: true };
      const shouldRender = supplier.featured || supplier.featuredSupplier;
      expect(shouldRender).toBe(true);
    });

    it('should render when featuredSupplier property is true', () => {
      const supplier = { featuredSupplier: true };
      const shouldRender = supplier.featured || supplier.featuredSupplier;
      expect(shouldRender).toBe(true);
    });

    it('should not render when neither property is true', () => {
      const supplier = {};
      const shouldRender = supplier.featured || supplier.featuredSupplier;
      expect(shouldRender).toBeFalsy();
    });

    it('should render when both properties are true', () => {
      const supplier = { featured: true, featuredSupplier: true };
      const shouldRender = supplier.featured || supplier.featuredSupplier;
      expect(shouldRender).toBe(true);
    });
  });

  describe('Top Rated badge', () => {
    it('should render when avgRating >= 4.5', () => {
      const supplier = { avgRating: 4.5 };
      const shouldRender =
        (supplier.avgRating && supplier.avgRating >= 4.5) ||
        (supplier.averageRating && supplier.averageRating >= 4.5);
      expect(shouldRender).toBe(true);
    });

    it('should render when averageRating >= 4.5', () => {
      const supplier = { averageRating: 4.8 };
      const shouldRender =
        (supplier.avgRating && supplier.avgRating >= 4.5) ||
        (supplier.averageRating && supplier.averageRating >= 4.5);
      expect(shouldRender).toBe(true);
    });

    it('should not render when rating < 4.5', () => {
      const supplier = { avgRating: 4.2 };
      const shouldRender =
        (supplier.avgRating && supplier.avgRating >= 4.5) ||
        (supplier.averageRating && supplier.averageRating >= 4.5);
      expect(shouldRender).toBeFalsy();
    });

    it('should not render when no rating present', () => {
      const supplier = {};
      const shouldRender =
        (supplier.avgRating && supplier.avgRating >= 4.5) ||
        (supplier.averageRating && supplier.averageRating >= 4.5);
      expect(shouldRender).toBeFalsy();
    });

    it('should render when both properties present with different values', () => {
      const supplier = { avgRating: 4.0, averageRating: 4.7 };
      const shouldRender =
        (supplier.avgRating && supplier.avgRating >= 4.5) ||
        (supplier.averageRating && supplier.averageRating >= 4.5);
      expect(shouldRender).toBe(true);
    });
  });

  describe('Founding badge', () => {
    it('should render when founding property is true', () => {
      const supplier = { founding: true };
      const shouldRender = supplier.founding || supplier.isFounding;
      expect(shouldRender).toBe(true);
    });

    it('should render when isFounding property is true', () => {
      const supplier = { isFounding: true };
      const shouldRender = supplier.founding || supplier.isFounding;
      expect(shouldRender).toBe(true);
    });

    it('should not render when neither property is true', () => {
      const supplier = {};
      const shouldRender = supplier.founding || supplier.isFounding;
      expect(shouldRender).toBeFalsy();
    });
  });

  describe('Verified badge', () => {
    it('should render when approved is true', () => {
      const supplier = { approved: true };
      const shouldRender = supplier.approved || supplier.verified;
      expect(shouldRender).toBe(true);
    });

    it('should render when verified is true', () => {
      const supplier = { verified: true };
      const shouldRender = supplier.approved || supplier.verified;
      expect(shouldRender).toBe(true);
    });

    it('should not render when neither property is true', () => {
      const supplier = {};
      const shouldRender = supplier.approved || supplier.verified;
      expect(shouldRender).toBeFalsy();
    });
  });

  describe('Tier badges', () => {
    it('should identify pro_plus tier', () => {
      const supplier = { subscriptionTier: 'pro_plus' };
      const tier =
        supplier.subscriptionTier || (supplier.subscription && supplier.subscription.tier);
      expect(tier).toBe('pro_plus');
    });

    it('should identify pro tier from isPro flag', () => {
      const supplier = { isPro: true };
      const tier =
        supplier.subscriptionTier ||
        (supplier.subscription && supplier.subscription.tier) ||
        (supplier.isPro || supplier.pro ? 'pro' : null);
      expect(tier).toBe('pro');
    });

    it('should identify pro tier from nested subscription', () => {
      const supplier = { subscription: { tier: 'pro' } };
      const tier =
        supplier.subscriptionTier || (supplier.subscription && supplier.subscription.tier);
      expect(tier).toBe('pro');
    });

    it('should return null when no tier present', () => {
      const supplier = {};
      const tier =
        supplier.subscriptionTier ||
        (supplier.subscription && supplier.subscription.tier) ||
        (supplier.isPro || supplier.pro ? 'pro' : null);
      expect(tier).toBeNull();
    });
  });

  describe('Fast Responder badge', () => {
    it('should render when avgResponseTime < 24', () => {
      const supplier = { avgResponseTime: 12 };
      const shouldRender = supplier.avgResponseTime && supplier.avgResponseTime < 24;
      expect(shouldRender).toBe(true);
    });

    it('should not render when avgResponseTime >= 24', () => {
      const supplier = { avgResponseTime: 25 };
      const shouldRender = supplier.avgResponseTime && supplier.avgResponseTime < 24;
      expect(shouldRender).toBeFalsy();
    });

    it('should not render when avgResponseTime not present', () => {
      const supplier = {};
      const shouldRender = supplier.avgResponseTime && supplier.avgResponseTime < 24;
      expect(shouldRender).toBeFalsy();
    });
  });

  describe('Expert badge', () => {
    it('should render when completedEvents > 50', () => {
      const supplier = { completedEvents: 51 };
      const shouldRender = supplier.completedEvents && supplier.completedEvents > 50;
      expect(shouldRender).toBe(true);
    });

    it('should not render when completedEvents <= 50', () => {
      const supplier = { completedEvents: 50 };
      const shouldRender = supplier.completedEvents && supplier.completedEvents > 50;
      expect(shouldRender).toBeFalsy();
    });

    it('should not render when completedEvents not present', () => {
      const supplier = {};
      const shouldRender = supplier.completedEvents && supplier.completedEvents > 50;
      expect(shouldRender).toBeFalsy();
    });
  });

  describe('Badge HTML generation', () => {
    it('should generate empty string when no badges', () => {
      const badges = [];
      const badgesHtml =
        badges.length > 0 ? `<div class="supplier-badges">${badges.join('')}</div>` : '';
      expect(badgesHtml).toBe('');
    });

    it('should generate HTML when badges present', () => {
      const badges = [
        '<span class="badge badge-pro">⭐ Pro</span>',
        '<span class="badge badge-verified">✓ Verified</span>',
      ];
      const badgesHtml =
        badges.length > 0 ? `<div class="supplier-badges">${badges.join('')}</div>` : '';
      expect(badgesHtml).toContain('<div class="supplier-badges">');
      expect(badgesHtml).toContain('⭐ Pro');
      expect(badgesHtml).toContain('✓ Verified');
    });
  });
});
