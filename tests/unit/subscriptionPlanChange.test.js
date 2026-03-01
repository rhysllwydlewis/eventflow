/**
 * Unit tests for subscriptionService.processSubscriptionPlanChange
 * Covers Stripe proration logic, graceful fallbacks, and the new
 * PLAN_PRICE_ENV_MAP convention (aligned with routes/subscriptions-v2.js).
 */

'use strict';

jest.mock('../../db-unified');
jest.mock('../../services/paymentService');
jest.mock('../../config/stripe');

const dbUnified = require('../../db-unified');
const paymentService = require('../../services/paymentService');
const stripeConfig = require('../../config/stripe');

const { processSubscriptionPlanChange } = require('../../services/subscriptionService');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSub(overrides = {}) {
  return {
    id: 'sub-1',
    userId: 'usr-1',
    plan: 'pro',
    status: 'active',
    stripeSubscriptionId: 'sub_stripe_123',
    stripeCustomerId: 'cus_123',
    ...overrides,
  };
}

// A minimal Stripe mock that succeeds by default
function makeStripeMock({ retrieveResult, updateResult, retrieveError } = {}) {
  return {
    subscriptions: {
      retrieve: jest.fn(async () => {
        if (retrieveError) {
          throw retrieveError;
        }
        return (
          retrieveResult || {
            id: 'sub_stripe_123',
            items: { data: [{ id: 'si_item_1', price: { id: 'price_pro' } }] },
          }
        );
      }),
      update: jest.fn(async () => updateResult || { id: 'sub_stripe_123', status: 'active' }),
    },
  };
}

// ── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // db-unified read/write stubs (subscriptionService reads subscriptions)
  dbUnified.read.mockImplementation(async () => []);
  dbUnified.updateOne.mockResolvedValue({});

  // By default, paymentService reports Stripe is enabled
  paymentService.STRIPE_ENABLED = true;
});

// ── No Stripe subscription ID ─────────────────────────────────────────────

describe('processSubscriptionPlanChange — no Stripe subscription ID', () => {
  it('skips Stripe processing and resolves without error when stripeSubscriptionId is null', async () => {
    const sub = makeSub({ stripeSubscriptionId: null });
    await expect(processSubscriptionPlanChange(sub, 'pro_plus')).resolves.toBeUndefined();
  });

  it('skips silently when plans have the same price (free → free)', async () => {
    const sub = makeSub({ plan: 'free', stripeSubscriptionId: null });
    await expect(processSubscriptionPlanChange(sub, 'free')).resolves.toBeUndefined();
  });
});

// ── Stripe not configured ──────────────────────────────────────────────────

describe('processSubscriptionPlanChange — Stripe not configured', () => {
  it('skips payment processing gracefully when Stripe is disabled', async () => {
    paymentService.STRIPE_ENABLED = false;
    const sub = makeSub();
    await expect(processSubscriptionPlanChange(sub, 'pro_plus')).resolves.toBeUndefined();
  });

  it('skips when Stripe client is null', async () => {
    paymentService.STRIPE_ENABLED = true;
    stripeConfig.getStripeClient.mockReturnValue(null);
    const sub = makeSub();
    await expect(processSubscriptionPlanChange(sub, 'pro_plus')).resolves.toBeUndefined();
  });
});

// ── Missing price ID env var ───────────────────────────────────────────────

describe('processSubscriptionPlanChange — missing price ID env var', () => {
  beforeEach(() => {
    stripeConfig.getStripeClient.mockReturnValue(makeStripeMock());
    delete process.env.STRIPE_PRO_PLUS_PRICE_ID;
  });

  it('resolves without error when STRIPE_PRO_PLUS_PRICE_ID is not set', async () => {
    const sub = makeSub();
    await expect(processSubscriptionPlanChange(sub, 'pro_plus')).resolves.toBeUndefined();
  });

  it('resolves without error when targeting the free plan (no price needed)', async () => {
    // Targeting free plan should skip Stripe update (cancelSubscription handles this separately)
    const sub = makeSub({ plan: 'pro', stripeSubscriptionId: 'sub_stripe_free_test' });
    stripeConfig.getStripeClient.mockReturnValue(makeStripeMock());
    await expect(processSubscriptionPlanChange(sub, 'free')).resolves.toBeUndefined();
  });
});

// ── Successful upgrade (pro → pro_plus) ──────────────────────────────────

describe('processSubscriptionPlanChange — successful upgrade', () => {
  let stripeMock;

  beforeEach(() => {
    process.env.STRIPE_PRO_PLUS_PRICE_ID = 'price_pro_plus_monthly';
    stripeMock = makeStripeMock();
    stripeConfig.getStripeClient.mockReturnValue(stripeMock);
  });

  afterEach(() => {
    delete process.env.STRIPE_PRO_PLUS_PRICE_ID;
  });

  it('calls stripe.subscriptions.update with create_prorations for an upgrade', async () => {
    const sub = makeSub({ plan: 'pro' }); // pro (£29.99) → pro_plus (£59.00) — upgrade
    await processSubscriptionPlanChange(sub, 'pro_plus');

    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith('sub_stripe_123');
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_123',
      expect.objectContaining({
        items: [{ id: 'si_item_1', price: 'price_pro_plus_monthly' }],
        proration_behavior: 'create_prorations',
      })
    );
  });
});

// ── Successful downgrade (pro_plus → pro) ────────────────────────────────

describe('processSubscriptionPlanChange — successful downgrade', () => {
  let stripeMock;

  beforeEach(() => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_monthly';
    stripeMock = makeStripeMock();
    stripeConfig.getStripeClient.mockReturnValue(stripeMock);
  });

  afterEach(() => {
    delete process.env.STRIPE_PRO_PRICE_ID;
  });

  it('calls stripe.subscriptions.update with proration_behavior none for a downgrade', async () => {
    const sub = makeSub({ plan: 'pro_plus' }); // pro_plus (£59) → pro (£29.99) — downgrade
    await processSubscriptionPlanChange(sub, 'pro');

    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_123',
      expect.objectContaining({
        items: [{ id: 'si_item_1', price: 'price_pro_monthly' }],
        proration_behavior: 'none',
      })
    );
  });
});

// ── No items on Stripe subscription ──────────────────────────────────────

describe('processSubscriptionPlanChange — empty Stripe subscription items', () => {
  beforeEach(() => {
    process.env.STRIPE_PRO_PLUS_PRICE_ID = 'price_pro_plus';
    stripeConfig.getStripeClient.mockReturnValue(
      makeStripeMock({ retrieveResult: { id: 'sub_stripe_123', items: { data: [] } } })
    );
  });

  afterEach(() => {
    delete process.env.STRIPE_PRO_PLUS_PRICE_ID;
  });

  it('skips Stripe update when no items are found on the Stripe subscription', async () => {
    const sub = makeSub();
    await expect(processSubscriptionPlanChange(sub, 'pro_plus')).resolves.toBeUndefined();
  });
});

// ── Stripe API error ──────────────────────────────────────────────────────

describe('processSubscriptionPlanChange — Stripe API error', () => {
  beforeEach(() => {
    process.env.STRIPE_PRO_PLUS_PRICE_ID = 'price_pro_plus';
    stripeConfig.getStripeClient.mockReturnValue(
      makeStripeMock({ retrieveError: new Error('Stripe network error') })
    );
  });

  afterEach(() => {
    delete process.env.STRIPE_PRO_PLUS_PRICE_ID;
  });

  it('re-throws Stripe errors so the caller can handle them', async () => {
    const sub = makeSub();
    await expect(processSubscriptionPlanChange(sub, 'pro_plus')).rejects.toThrow(
      'Stripe network error'
    );
  });
});
