/**
 * Unit tests for badge management and automated issuance
 */

const badgeManagement = require('../../utils/badgeManagement');

describe('Badge Management', () => {
  describe('Badge Definitions', () => {
    it('should have predefined badge definitions', () => {
      expect(badgeManagement.BADGE_DEFINITIONS).toBeDefined();
      expect(typeof badgeManagement.BADGE_DEFINITIONS).toBe('object');
      expect(Object.keys(badgeManagement.BADGE_DEFINITIONS).length).toBeGreaterThan(0);
    });

    it('should have Fast Responder badge with correct criteria', () => {
      const badge = badgeManagement.BADGE_DEFINITIONS.FAST_RESPONDER;
      expect(badge).toBeDefined();
      expect(badge.autoAssign).toBe(true);
      expect(badge.autoAssignCriteria.avgResponseTime.lt).toBe(24);
      expect(badge.autoAssignCriteria.minMessages).toBe(5);
    });

    it('should have Top Rated badge with correct criteria', () => {
      const badge = badgeManagement.BADGE_DEFINITIONS.TOP_RATED;
      expect(badge).toBeDefined();
      expect(badge.autoAssign).toBe(true);
      expect(badge.autoAssignCriteria.avgRating.gte).toBe(4.5);
      expect(badge.autoAssignCriteria.minReviews).toBe(3);
    });

    it('should have Expert badge with correct criteria', () => {
      const badge = badgeManagement.BADGE_DEFINITIONS.EXPERT;
      expect(badge).toBeDefined();
      expect(badge.autoAssign).toBe(true);
      expect(badge.autoAssignCriteria.completedEvents.gt).toBe(50);
    });

    it('should have Verified badge that is not auto-assigned', () => {
      const badge = badgeManagement.BADGE_DEFINITIONS.VERIFIED;
      expect(badge).toBeDefined();
      expect(badge.autoAssign).toBe(false);
    });

    it('should have Featured badge that is not auto-assigned', () => {
      const badge = badgeManagement.BADGE_DEFINITIONS.FEATURED;
      expect(badge).toBeDefined();
      expect(badge.autoAssign).toBe(false);
    });

    it('should have Founding badge that is not auto-assigned', () => {
      const badge = badgeManagement.BADGE_DEFINITIONS.FOUNDING;
      expect(badge).toBeDefined();
      expect(badge.autoAssign).toBe(false);
    });
  });

  describe('Badge Icon Mapping', () => {
    it('should have emoji icons for all badges', () => {
      const badges = badgeManagement.BADGE_DEFINITIONS;

      for (const [key, badge] of Object.entries(badges)) {
        expect(badge.icon).toBeDefined();
        expect(typeof badge.icon).toBe('string');
        expect(badge.icon.length).toBeGreaterThan(0);
      }
    });

    it('should have color codes for all badges', () => {
      const badges = badgeManagement.BADGE_DEFINITIONS;

      for (const [key, badge] of Object.entries(badges)) {
        expect(badge.color).toBeDefined();
        expect(typeof badge.color).toBe('string');
        expect(badge.color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  describe('Calculate Supplier Stats', () => {
    it('should return stats object with required properties', async () => {
      const supplierId = 'test-supplier-123';
      const stats = await badgeManagement.calculateSupplierStats(supplierId);

      expect(stats).toHaveProperty('messages');
      expect(stats).toHaveProperty('reviews');
      expect(stats).toHaveProperty('avgResponseTime');
      expect(stats).toHaveProperty('avgRating');
      expect(typeof stats.messages).toBe('number');
      expect(typeof stats.reviews).toBe('number');
      expect(typeof stats.avgResponseTime).toBe('number');
      expect(typeof stats.avgRating).toBe('number');
    });

    it('should return zero stats for non-existent supplier', async () => {
      const supplierId = 'non-existent-supplier';
      const stats = await badgeManagement.calculateSupplierStats(supplierId);

      expect(stats.messages).toBe(0);
      expect(stats.reviews).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
      expect(stats.avgRating).toBe(0);
    });
  });

  describe('Initialize Default Badges', () => {
    it('should not throw error when initializing badges', async () => {
      await expect(badgeManagement.initializeDefaultBadges()).resolves.not.toThrow();
    });
  });
});
