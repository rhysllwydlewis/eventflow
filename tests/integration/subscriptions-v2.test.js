/**
 * Integration tests for subscription service
 */

'use strict';

const subscriptionService = require('../../services/subscriptionService');
const dbUnified = require('../../db-unified');
const { uid } = require('../../store');

// Mock database
jest.mock('../../db-unified');

describe('Subscription Service Integration Tests', () => {
  let mockSubscriptions;
  let mockUsers;
  let uidMock;

  beforeEach(() => {
    mockSubscriptions = [];
    mockUsers = [
      {
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'customer',
        isPro: false,
      },
    ];

    dbUnified.read.mockImplementation(async collection => {
      switch (collection) {
        case 'subscriptions':
          return [...mockSubscriptions];
        case 'users':
          return [...mockUsers];
        default:
          return [];
      }
    });

    dbUnified.write.mockImplementation(async (collection, data) => {
      switch (collection) {
        case 'subscriptions':
          mockSubscriptions = [...data];
          break;
        case 'users':
          mockUsers = [...data];
          break;
      }
    });

    dbUnified.insertOne.mockImplementation(async (collection, data) => {
      switch (collection) {
        case 'subscriptions':
          mockSubscriptions.push(data);
          break;
      }
    });

    // Clear any existing mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      const subscription = await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });

      expect(subscription.id).toBeTruthy();
      expect(subscription.id).toMatch(/^sub_/);
      expect(subscription.userId).toBe('usr-1');
      expect(subscription.plan).toBe('pro');
      expect(subscription.status).toBe('active');
      expect(mockSubscriptions).toHaveLength(1);
    });

    it('should create subscription with trial period', async () => {
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const subscription = await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
        trialEnd,
      });

      expect(subscription.status).toBe('trialing');
      expect(subscription.trialEnd).toBeTruthy();
    });

    it('should update user isPro status', async () => {
      const subscription = await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });

      expect(mockUsers[0].isPro).toBe(true);
      expect(mockUsers[0].subscriptionId).toBe(subscription.id);
    });
  });

  describe('upgradeSubscription', () => {
    let subscriptionId;

    beforeEach(async () => {
      const sub = await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'basic',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });
      subscriptionId = sub.id;
    });

    it('should upgrade subscription to higher tier', async () => {
      const updated = await subscriptionService.upgradeSubscription(subscriptionId, 'pro');

      expect(updated.plan).toBe('pro');
      expect(updated.status).toBe('active');
    });

    it('should reject downgrade attempt', async () => {
      await expect(subscriptionService.upgradeSubscription(subscriptionId, 'free')).rejects.toThrow(
        'must be higher tier'
      );
    });

    it('should reject same tier upgrade', async () => {
      await expect(
        subscriptionService.upgradeSubscription(subscriptionId, 'basic')
      ).rejects.toThrow('must be higher tier');
    });
  });

  describe('downgradeSubscription', () => {
    let subscriptionId;

    beforeEach(async () => {
      const sub = await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });
      subscriptionId = sub.id;
    });

    it('should schedule downgrade to lower tier', async () => {
      const updated = await subscriptionService.downgradeSubscription(subscriptionId, 'basic');

      expect(updated.plan).toBe('basic');
      expect(updated.cancelAtPeriodEnd).toBe(true);
    });

    it('should reject upgrade attempt', async () => {
      await expect(
        subscriptionService.downgradeSubscription(subscriptionId, 'enterprise')
      ).rejects.toThrow('must be lower tier');
    });
  });

  describe('cancelSubscription', () => {
    let subscriptionId;

    beforeEach(async () => {
      const sub = await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });
      subscriptionId = sub.id;
    });

    it('should cancel subscription at period end', async () => {
      const updated = await subscriptionService.cancelSubscription(
        subscriptionId,
        'Too expensive',
        false
      );

      expect(updated.cancelAtPeriodEnd).toBe(true);
      expect(updated.cancelReason).toBe('Too expensive');
      expect(updated.status).not.toBe('canceled');
    });

    it('should cancel subscription immediately', async () => {
      const updated = await subscriptionService.cancelSubscription(
        subscriptionId,
        'Not using service',
        true
      );

      expect(updated.status).toBe('canceled');
      expect(updated.plan).toBe('free');
    });
  });

  describe('checkFeatureAccess', () => {
    it('should grant free plan features by default', async () => {
      const hasAnalytics = await subscriptionService.checkFeatureAccess('usr-1', 'analytics');
      const hasMessaging = await subscriptionService.checkFeatureAccess('usr-1', 'messaging');

      expect(hasAnalytics).toBe(false);
      expect(hasMessaging).toBe(true);
    });

    it('should grant pro plan features', async () => {
      await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });

      const hasAnalytics = await subscriptionService.checkFeatureAccess('usr-1', 'analytics');
      const hasPrioritySupport = await subscriptionService.checkFeatureAccess(
        'usr-1',
        'prioritySupport'
      );

      expect(hasAnalytics).toBe(true);
      expect(hasPrioritySupport).toBe(true);
    });
  });

  describe('getUserFeatures', () => {
    it('should return free plan features by default', async () => {
      const features = await subscriptionService.getUserFeatures('usr-1');

      expect(features.name).toBe('Free');
      expect(features.price).toBe(0);
      expect(features.features.maxSuppliers).toBe(1);
    });

    it('should return pro plan features', async () => {
      await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      });

      const features = await subscriptionService.getUserFeatures('usr-1');

      expect(features.name).toBe('Professional');
      expect(features.price).toBe(29.99);
      expect(features.features.maxSuppliers).toBe(10);
      expect(features.features.apiAccess).toBe(true);
    });
  });

  describe('getSubscriptionStats', () => {
    beforeEach(async () => {
      // Create multiple subscriptions
      await subscriptionService.createSubscription({
        userId: 'usr-1',
        plan: 'pro',
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_1',
      });

      await subscriptionService.createSubscription({
        userId: 'usr-2',
        plan: 'basic',
        stripeSubscriptionId: 'sub_2',
        stripeCustomerId: 'cus_2',
      });

      await subscriptionService.createSubscription({
        userId: 'usr-3',
        plan: 'pro',
        stripeSubscriptionId: 'sub_3',
        stripeCustomerId: 'cus_3',
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
    });

    it('should calculate subscription statistics', async () => {
      const stats = await subscriptionService.getSubscriptionStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.trialing).toBe(1);
      expect(stats.byPlan.pro).toBe(2);
      expect(stats.byPlan.basic).toBe(1);
    });
  });

  describe('isInTrial', () => {
    it('should return true for subscription in trial period', () => {
      const subscription = {
        status: 'trialing',
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(subscriptionService.isInTrial(subscription)).toBe(true);
    });

    it('should return false for expired trial', () => {
      const subscription = {
        status: 'trialing',
        trialEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(subscriptionService.isInTrial(subscription)).toBe(false);
    });

    it('should return false for active subscription without trial', () => {
      const subscription = {
        status: 'active',
        trialEnd: null,
      };

      expect(subscriptionService.isInTrial(subscription)).toBe(false);
    });
  });

  describe('getAllPlans', () => {
    it('should return all available plans', () => {
      const plans = subscriptionService.getAllPlans();

      expect(plans).toHaveLength(4);
      expect(plans.map(p => p.id)).toEqual(['free', 'basic', 'pro', 'enterprise']);
      expect(plans[0].price).toBe(0);
      expect(plans[2].features.apiAccess).toBe(true);
    });
  });
});
