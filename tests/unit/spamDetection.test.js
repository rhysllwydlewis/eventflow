/**
 * Unit tests for services/spamDetection.js
 * Covers rate limiting, duplicate detection, URL counting, keyword matching, and checkSpam.
 */

'use strict';

const {
  checkRateLimit,
  checkDuplicate,
  countUrls,
  detectSpamKeywords,
  checkSpam,
  cleanupCache,
} = require('../../services/spamDetection');

// ── countUrls ──────────────────────────────────────────────────────────────

describe('countUrls', () => {
  it('returns 0 for messages with no URLs', () => {
    expect(countUrls('Hello, how are you?')).toBe(0);
  });

  it('counts a single URL', () => {
    expect(countUrls('Check this out https://example.com please')).toBe(1);
  });

  it('counts multiple URLs', () => {
    expect(countUrls('Visit https://example.com and https://other.com for more info')).toBe(2);
  });

  it('returns 0 for null / undefined', () => {
    expect(countUrls(null)).toBe(0);
    expect(countUrls(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(countUrls('')).toBe(0);
  });
});

// ── detectSpamKeywords ─────────────────────────────────────────────────────

describe('detectSpamKeywords', () => {
  beforeEach(() => {
    process.env.SPAM_KEYWORDS = 'buy now,click here,free money';
  });

  afterEach(() => {
    delete process.env.SPAM_KEYWORDS;
  });

  it('returns empty array when no spam keywords are present', () => {
    expect(detectSpamKeywords('Hello, I am interested in your services')).toEqual([]);
  });

  it('detects a single spam keyword', () => {
    const detected = detectSpamKeywords('Click here to win a prize!');
    expect(detected).toContain('click here');
  });

  it('detects multiple spam keywords', () => {
    const detected = detectSpamKeywords('Buy now and get free money!');
    expect(detected).toContain('buy now');
    expect(detected).toContain('free money');
  });

  it('is case-insensitive', () => {
    const detected = detectSpamKeywords('BUY NOW for a limited time!');
    expect(detected).toContain('buy now');
  });

  it('returns empty array for null / undefined', () => {
    expect(detectSpamKeywords(null)).toEqual([]);
    expect(detectSpamKeywords(undefined)).toEqual([]);
  });

  it('returns empty array when SPAM_KEYWORDS env is not set', () => {
    delete process.env.SPAM_KEYWORDS;
    expect(detectSpamKeywords('buy now')).toEqual([]);
  });
});

// ── checkRateLimit ─────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('returns not limited for first message', async () => {
    const userId = `user-rate-${Date.now()}`;
    const result = await checkRateLimit(userId, 5);
    expect(result.limited).toBe(false);
  });

  it('rate-limits after exceeding max messages per minute', async () => {
    const userId = `user-rate-limit-${Date.now()}`;
    const maxPerMinute = 3;

    // Send maxPerMinute messages — none should be limited
    for (let i = 0; i < maxPerMinute; i++) {
      const result = await checkRateLimit(userId, maxPerMinute);
      expect(result.limited).toBe(false);
    }

    // Next message should be rate-limited
    const limited = await checkRateLimit(userId, maxPerMinute);
    expect(limited.limited).toBe(true);
    expect(limited.retryAfter).toBeGreaterThan(0);
  });
});

// ── checkDuplicate ─────────────────────────────────────────────────────────

describe('checkDuplicate', () => {
  it('returns false for a new, unique message', async () => {
    const userId = `user-dup-${Date.now()}`;
    const isDuplicate = await checkDuplicate(userId, 'Hello, this is a unique message', 5);
    expect(isDuplicate).toBe(false);
  });

  it('detects a duplicate message sent within the window', async () => {
    const userId = `user-dup-detect-${Date.now()}`;
    const message = 'Duplicate test message';

    // First send — not a duplicate
    await checkDuplicate(userId, message, 60);

    // Second send within same window — should be duplicate
    const isDuplicate = await checkDuplicate(userId, message, 60);
    expect(isDuplicate).toBe(true);
  });

  it('is case-insensitive and trims whitespace', async () => {
    const userId = `user-dup-case-${Date.now()}`;
    await checkDuplicate(userId, '  Hello World  ', 60);
    const isDuplicate = await checkDuplicate(userId, 'hello world', 60);
    expect(isDuplicate).toBe(true);
  });
});

// ── checkSpam ──────────────────────────────────────────────────────────────

describe('checkSpam', () => {
  beforeEach(() => {
    process.env.SPAM_KEYWORDS = 'buy now,click here';
  });

  afterEach(() => {
    delete process.env.SPAM_KEYWORDS;
  });

  it('returns isSpam=false for a clean message', async () => {
    const userId = `user-spam-clean-${Date.now()}`;
    const result = await checkSpam(userId, 'I am interested in your wedding catering service.', {
      maxPerMinute: 30,
      checkDuplicates: false,
    });
    expect(result.isSpam).toBe(false);
    expect(result.score).toBe(0);
  });

  it('detects spam from excessive URLs', async () => {
    const userId = `user-spam-url-${Date.now()}`;
    const urls = Array.from({ length: 6 }, (_, i) => `https://spam-site-${i}.com`).join(' ');

    const result = await checkSpam(userId, `Check out ${urls}`, {
      maxUrlCount: 2,
      maxPerMinute: 30,
      checkDuplicates: false,
    });
    expect(result.isSpam).toBe(true);
    expect(result.reason).toMatch(/excessive urls/i);
  });

  it('detects spam from spam keywords', async () => {
    // Use enough keywords to push score over the 50-point spam threshold (20 pts each)
    process.env.SPAM_KEYWORDS = 'buy now,click here,free money';
    const userId = `user-spam-kw-${Date.now()}`;
    const result = await checkSpam(userId, 'Buy now! Click here for free money!', {
      maxPerMinute: 30,
      checkDuplicates: false,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.reason).toMatch(/spam keywords/i);
  });

  it('includes details object in result', async () => {
    const userId = `user-spam-details-${Date.now()}`;
    const result = await checkSpam(userId, 'Normal message', {
      checkDuplicates: false,
    });
    expect(result).toHaveProperty('details');
    expect(result.details).toHaveProperty('urlCount');
  });

  it('skips keyword check when checkKeywords=false', async () => {
    const userId = `user-spam-nokw-${Date.now()}`;
    const result = await checkSpam(userId, 'Buy now! Click here!', {
      maxPerMinute: 30,
      checkDuplicates: false,
      checkKeywords: false,
    });
    expect(result.score).toBe(0);
    expect(result.isSpam).toBe(false);
  });
});

// ── cleanupCache ───────────────────────────────────────────────────────────

describe('cleanupCache', () => {
  it('runs without throwing', () => {
    expect(() => cleanupCache()).not.toThrow();
  });
});
