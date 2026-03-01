/**
 * Unit tests for utils/leadScoring.js
 * Covers scoring algorithm, validation, and helper utilities
 */

'use strict';

const {
  calculateLeadScore,
  validateEnquiry,
  isDisposableEmail,
  isBusinessEmail,
  isValidUKPostcode,
  isValidPhone,
  daysBetween,
} = require('../../utils/leadScoring');

// ── Helper to create future dates ──────────────────────────────────────────

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── isDisposableEmail ──────────────────────────────────────────────────────

describe('isDisposableEmail', () => {
  it('returns true for known disposable domains', () => {
    expect(isDisposableEmail('user@tempmail.com')).toBe(true);
    expect(isDisposableEmail('user@mailinator.com')).toBe(true);
    expect(isDisposableEmail('user@10minutemail.com')).toBe(true);
  });

  it('returns false for legitimate email addresses', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
    expect(isDisposableEmail('user@example.co.uk')).toBe(false);
  });

  it('returns false for null / undefined input', () => {
    expect(isDisposableEmail(null)).toBe(false);
    expect(isDisposableEmail(undefined)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isDisposableEmail('user@TEMPMAIL.COM')).toBe(true);
  });
});

// ── isBusinessEmail ────────────────────────────────────────────────────────

describe('isBusinessEmail', () => {
  it('returns true for common business TLDs', () => {
    expect(isBusinessEmail('alice@company.co.uk')).toBe(true);
    expect(isBusinessEmail('alice@company.com')).toBe(true);
    expect(isBusinessEmail('alice@university.ac.uk')).toBe(true);
  });

  it('returns false for free email providers (gmail, yahoo)', () => {
    expect(isBusinessEmail('user@gmail.com')).toBe(false);
    expect(isBusinessEmail('user@yahoo.com')).toBe(false);
  });

  it('returns false for null / undefined input', () => {
    expect(isBusinessEmail(null)).toBe(false);
    expect(isBusinessEmail(undefined)).toBe(false);
  });
});

// ── isValidUKPostcode ──────────────────────────────────────────────────────

describe('isValidUKPostcode', () => {
  it('returns true for valid UK postcodes', () => {
    expect(isValidUKPostcode('SW1A 1AA')).toBe(true);
    expect(isValidUKPostcode('EC1A 1BB')).toBe(true);
    expect(isValidUKPostcode('W1A 0AX')).toBe(true);
  });

  it('accepts postcodes without spaces', () => {
    expect(isValidUKPostcode('SW1A1AA')).toBe(true);
  });

  it('returns false for invalid postcodes', () => {
    expect(isValidUKPostcode('INVALID')).toBe(false);
    expect(isValidUKPostcode('12345')).toBe(false);
    expect(isValidUKPostcode('')).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(isValidUKPostcode(null)).toBe(false);
    expect(isValidUKPostcode(undefined)).toBe(false);
  });
});

// ── isValidPhone ───────────────────────────────────────────────────────────

describe('isValidPhone', () => {
  it('returns true for valid UK phone numbers', () => {
    expect(isValidPhone('07700 900000')).toBe(true);
    expect(isValidPhone('+447700900000')).toBe(true);
    expect(isValidPhone('01234 567890')).toBe(true);
  });

  it('returns false for too-short or invalid numbers', () => {
    expect(isValidPhone('1234')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(isValidPhone(null)).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });
});

// ── daysBetween ────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('calculates positive day difference', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-11');
    expect(daysBetween(d1, d2)).toBe(10);
  });

  it('returns 0 for same day', () => {
    const d = new Date('2024-06-15');
    expect(daysBetween(d, d)).toBe(0);
  });
});

// ── calculateLeadScore ─────────────────────────────────────────────────────

describe('calculateLeadScore', () => {
  it('returns a score between 0 and 100', () => {
    const score = calculateLeadScore({});
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it('gives a high score for a complete, high-quality enquiry', () => {
    const { score } = calculateLeadScore({
      eventDate: futureDate(90),
      email: 'alice@company.co.uk',
      phone: '07700 900000',
      budget: '£2,000–£5,000',
      guestCount: 100,
      postcode: 'SW1A 1AA',
      message:
        'We are looking for a professional caterer for our corporate awards dinner. We need a three-course meal with wine pairing for 100 guests.',
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('penalises a last-minute enquiry (< 30 days)', () => {
    const complete = calculateLeadScore({
      eventDate: futureDate(90),
      email: 'alice@company.co.uk',
    }).score;
    const lastMinute = calculateLeadScore({
      eventDate: futureDate(5),
      email: 'alice@company.co.uk',
    }).score;
    expect(lastMinute).toBeLessThan(complete);
  });

  it('penalises missing event date', () => {
    const withDate = calculateLeadScore({ eventDate: futureDate(60) }).score;
    const withoutDate = calculateLeadScore({}).score;
    expect(withoutDate).toBeLessThan(withDate);
  });

  it('penalises disposable email addresses', () => {
    const business = calculateLeadScore({
      email: 'alice@company.co.uk',
      eventDate: futureDate(60),
    }).score;
    const disposable = calculateLeadScore({
      email: 'user@tempmail.com',
      eventDate: futureDate(60),
    }).score;
    expect(disposable).toBeLessThan(business);
  });

  it('adds score for providing budget and guest count', () => {
    const withDetails = calculateLeadScore({
      eventDate: futureDate(60),
      budget: '£1,000',
      guestCount: 50,
    }).score;
    const withoutDetails = calculateLeadScore({
      eventDate: futureDate(60),
    }).score;
    expect(withDetails).toBeGreaterThan(withoutDetails);
  });

  it('adds score for a detailed message', () => {
    const withLongMessage = calculateLeadScore({
      eventDate: futureDate(60),
      message:
        'We are organising a large corporate gala dinner and need a full catering service with bar staff and event management support for approximately 200 guests.',
    }).score;
    const withShortMessage = calculateLeadScore({
      eventDate: futureDate(60),
      message: 'Hi',
    }).score;
    expect(withLongMessage).toBeGreaterThan(withShortMessage);
  });

  it('includes flags array and breakdown in returned object', () => {
    const result = calculateLeadScore({ eventDate: futureDate(5) });
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('breakdown');
    expect(Array.isArray(result.flags)).toBe(true);
  });

  it('flags last-minute event date', () => {
    const { flags } = calculateLeadScore({ eventDate: futureDate(5) });
    expect(flags).toContain('last-minute');
  });
});

// ── validateEnquiry ────────────────────────────────────────────────────────

describe('validateEnquiry', () => {
  it('returns valid for a complete enquiry', () => {
    const result = validateEnquiry({
      email: 'alice@example.com',
      eventDate: futureDate(60),
      eventType: 'wedding',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.leadScore).toBeDefined();
  });

  it('returns errors for missing required fields', () => {
    const result = validateEnquiry({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for invalid email', () => {
    const result = validateEnquiry({
      email: 'not-an-email',
      eventDate: futureDate(60),
      eventType: 'wedding',
    });
    const emailError = result.errors.find(e => e.field === 'email');
    expect(emailError).toBeDefined();
  });

  it('returns error for invalid phone', () => {
    const result = validateEnquiry({
      email: 'alice@example.com',
      eventDate: futureDate(60),
      eventType: 'corporate',
      phone: 'abc',
    });
    const phoneError = result.errors.find(e => e.field === 'phone');
    expect(phoneError).toBeDefined();
  });

  it('returns error for invalid UK postcode', () => {
    const result = validateEnquiry({
      email: 'alice@example.com',
      eventDate: futureDate(60),
      eventType: 'birthday',
      postcode: 'BADPOSTCODE',
    });
    const postcodeError = result.errors.find(e => e.field === 'postcode');
    expect(postcodeError).toBeDefined();
  });

  it('returns validatedData with sanitised fields', () => {
    const result = validateEnquiry({
      email: 'alice@example.com',
      eventDate: futureDate(60),
      eventType: 'wedding',
      postcode: 'sw1a 1aa',
    });
    expect(result.validatedData.postcode).toBe('SW1A 1AA');
  });
});
