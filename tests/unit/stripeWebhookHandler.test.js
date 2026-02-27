/**
 * Unit tests for Stripe webhook handler utilities
 * Covers formatPlanName and resolvePlanTier helpers
 */

'use strict';

// Silence postmark warning during tests
const originalPostmarkApiKey = process.env.POSTMARK_API_KEY;
beforeAll(() => {
  process.env.POSTMARK_API_KEY = 'test';
});
afterAll(() => {
  if (originalPostmarkApiKey !== undefined) {
    process.env.POSTMARK_API_KEY = originalPostmarkApiKey;
  } else {
    delete process.env.POSTMARK_API_KEY;
  }
});

const { formatPlanName } = require('../../webhooks/stripeWebhookHandler');

describe('Stripe Webhook Handler — formatPlanName', () => {
  it('formats free tier', () => {
    expect(formatPlanName('free')).toBe('Free');
  });

  it('formats basic tier', () => {
    expect(formatPlanName('basic')).toBe('Basic');
  });

  it('formats pro tier', () => {
    expect(formatPlanName('pro')).toBe('Pro');
  });

  it('formats pro_plus tier', () => {
    expect(formatPlanName('pro_plus')).toBe('Pro Plus');
  });

  it('formats enterprise tier', () => {
    expect(formatPlanName('enterprise')).toBe('Enterprise');
  });

  it('falls back to the raw tier string for unknown values', () => {
    expect(formatPlanName('custom_tier')).toBe('custom_tier');
  });

  it('returns Unknown for null/undefined', () => {
    expect(formatPlanName(null)).toBe('Unknown');
    expect(formatPlanName(undefined)).toBe('Unknown');
    expect(formatPlanName('')).toBe('Unknown');
  });
});
