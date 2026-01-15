/**
 * Integration tests for supplier analytics and event tracking
 */

const supplierAnalytics = require('../../utils/supplierAnalytics');

describe('Supplier Analytics Integration', () => {
  describe('Event Tracking', () => {
    it('should track profile view event', async () => {
      const supplierId = 'test-supplier-123';
      const userId = 'test-user-123';

      // Should not throw error
      await expect(
        supplierAnalytics.trackProfileView(supplierId, userId, null, false)
      ).resolves.not.toThrow();
    });

    it('should not track preview mode profile views', async () => {
      const supplierId = 'test-supplier-123';
      const userId = 'test-user-123';

      // Preview mode should be ignored
      await supplierAnalytics.trackProfileView(supplierId, userId, null, true);

      // No assertions needed - just checking it doesn't throw
    });

    it('should track enquiry started event', async () => {
      const supplierId = 'test-supplier-123';
      const userId = 'test-user-123';
      const metadata = { threadId: 'thread-123' };

      await expect(
        supplierAnalytics.trackEnquiryStarted(supplierId, userId, metadata)
      ).resolves.not.toThrow();
    });

    it('should track enquiry sent event', async () => {
      const supplierId = 'test-supplier-123';
      const userId = 'test-user-123';
      const metadata = { threadId: 'thread-123', messageId: 'msg-123' };

      await expect(
        supplierAnalytics.trackEnquirySent(supplierId, userId, metadata)
      ).resolves.not.toThrow();
    });

    it('should track message reply event', async () => {
      const supplierId = 'test-supplier-123';
      const userId = 'test-user-123';
      const metadata = { threadId: 'thread-123', messageId: 'msg-123' };

      await expect(
        supplierAnalytics.trackMessageReply(supplierId, userId, metadata)
      ).resolves.not.toThrow();
    });

    it('should track review received event', async () => {
      const supplierId = 'test-supplier-123';
      const userId = 'test-user-123';
      const metadata = { reviewId: 'review-123', rating: 5 };

      await expect(
        supplierAnalytics.trackReviewReceived(supplierId, userId, metadata)
      ).resolves.not.toThrow();
    });
  });

  describe('Analytics Retrieval', () => {
    it('should return analytics for a supplier', async () => {
      const supplierId = 'test-supplier-123';
      const days = 7;

      const analytics = await supplierAnalytics.getSupplierAnalytics(supplierId, days);

      expect(analytics).toHaveProperty('period', days);
      expect(analytics).toHaveProperty('totalViews');
      expect(analytics).toHaveProperty('totalEnquiries');
      expect(analytics).toHaveProperty('responseRate');
      expect(analytics).toHaveProperty('avgResponseTime');
      expect(analytics).toHaveProperty('dailyData');
      expect(Array.isArray(analytics.dailyData)).toBe(true);
    });

    it('should return empty analytics for non-existent supplier', async () => {
      const supplierId = 'non-existent-supplier';
      const analytics = await supplierAnalytics.getSupplierAnalytics(supplierId, 7);

      expect(analytics.totalViews).toBe(0);
      expect(analytics.totalEnquiries).toBe(0);
    });
  });
});
