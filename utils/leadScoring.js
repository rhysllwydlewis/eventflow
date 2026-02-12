/**
 * Lead Scoring and Validation System
 * Core differentiator: High-quality leads vs competitors
 *
 * Scores enquiries from 0-100 based on multiple factors:
 * - Event date (reasonable timeline)
 * - Contact completeness (phone, email, budget, guests)
 * - Message quality (length, detail)
 * - Email quality (disposable vs business)
 * - Behavior signals (time on page, repeat spammer)
 */

'use strict';

const validator = require('validator');

// Constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Spam keywords that indicate low-quality leads
 */
const SPAM_KEYWORDS = ['click here', 'buy now', 'limited time', 'act now', 'free money'];

/**
 * List of common disposable email providers
 * These are frequently used by bots or low-quality leads
 */
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'trashmail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'getnada.com',
  'temp-mail.org',
  'yopmail.com',
  'sharklasers.com',
  'spam4.me',
];

/**
 * Common business email domains that indicate legitimate enquiries
 */
const BUSINESS_EMAIL_INDICATORS = ['.co.uk', '.com', '.org', '.net', '.gov.uk', '.ac.uk', '.edu'];

/**
 * Check if an email is from a disposable email provider
 * @param {string} email - Email address to check
 * @returns {boolean} True if disposable, false otherwise
 */
function isDisposableEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const domain = email.toLowerCase().split('@')[1];
  if (!domain) {
    return false;
  }

  return DISPOSABLE_EMAIL_DOMAINS.some(disposable => domain.includes(disposable));
}

/**
 * Check if an email looks like a business email (not free provider)
 * @param {string} email - Email address to check
 * @returns {boolean} True if likely a business email
 */
function isBusinessEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const domain = email.toLowerCase().split('@')[1];
  if (!domain) {
    return false;
  }

  // Not a business email if it's a common free provider
  const freeProviders = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
  ];
  if (freeProviders.includes(domain)) {
    return false;
  }

  // Check if it has business indicators
  return BUSINESS_EMAIL_INDICATORS.some(indicator => domain.includes(indicator));
}

/**
 * Calculate days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Days between dates
 */
function daysBetween(date1, date2) {
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / ONE_DAY_MS));
}

/**
 * Validate UK postcode format
 * @param {string} postcode - Postcode to validate
 * @returns {boolean} True if valid UK postcode format
 */
function isValidUKPostcode(postcode) {
  if (!postcode || typeof postcode !== 'string') {
    return false;
  }

  // UK postcode regex pattern
  const postcodeRegex =
    /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?[0-9][0-9ABEHMNPRV-Y]? ?[0-9][ABD-HJLNP-UW-Z]{2})$/i;
  return postcodeRegex.test(postcode.trim());
}

/**
 * Validate phone number (basic UK format check)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove spaces, hyphens, brackets
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // UK phone numbers: 10-11 digits, optionally starting with +44
  const phoneRegex = /^(\+44|0)?[0-9]{10,11}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Calculate comprehensive lead score for an enquiry
 * @param {Object} enquiry - Enquiry object with various fields
 * @returns {Object} { score: number, rating: string, flags: Array, breakdown: Object }
 */
function calculateLeadScore(enquiry) {
  let score = 32; // Base score
  const flags = [];
  const breakdown = {};

  // EVENT DATE CHECKS (Max +20, Min -10)
  if (enquiry.eventDate) {
    try {
      const eventDate = new Date(enquiry.eventDate);
      const today = new Date();
      const daysUntilEvent = daysBetween(today, eventDate);

      breakdown.daysUntilEvent = daysUntilEvent;

      if (daysUntilEvent > 30 && daysUntilEvent < 365) {
        // Sweet spot: 1-12 months out
        score += 15;
        breakdown.eventDateScore = 15;
      } else if (daysUntilEvent >= 365 && daysUntilEvent < 730) {
        // 1-2 years out: still good
        score += 10;
        breakdown.eventDateScore = 10;
      } else if (daysUntilEvent < 30) {
        // Last-minute (< 1 month): risky
        score -= 10;
        flags.push('last-minute');
        breakdown.eventDateScore = -10;
      } else if (daysUntilEvent > 730) {
        // Too far out (> 2 years): may ghost
        score -= 5;
        flags.push('too-far-future');
        breakdown.eventDateScore = -5;
      }
    } catch (error) {
      // Invalid date format
      score -= 5;
      flags.push('invalid-date');
      breakdown.eventDateScore = -5;
    }
  } else {
    // No event date provided
    score -= 10;
    flags.push('no-event-date');
    breakdown.eventDateScore = -10;
  }

  // CONTACT COMPLETENESS (Max +20)
  let contactScore = 0;

  if (enquiry.phone && isValidPhone(enquiry.phone)) {
    contactScore += 7;
  } else if (enquiry.phone) {
    flags.push('invalid-phone');
  }

  if (enquiry.email && validator.isEmail(enquiry.email)) {
    contactScore += 8;
  } else if (enquiry.email) {
    flags.push('invalid-email');
  }

  if (enquiry.phone && enquiry.email) {
    // Bonus for both contact methods
    contactScore += 2;
  }

  score += contactScore;
  breakdown.contactScore = contactScore;

  // OPTIONAL BUT VALUABLE FIELDS (Max +15)
  let detailScore = 0;

  if (enquiry.budget) {
    detailScore += 10;
  }

  if (enquiry.guestCount && enquiry.guestCount > 0) {
    detailScore += 5;
  }

  if (enquiry.postcode && isValidUKPostcode(enquiry.postcode)) {
    detailScore += 5;
  } else if (enquiry.postcode) {
    flags.push('invalid-postcode');
  }

  score += detailScore;
  breakdown.detailScore = detailScore;

  // MESSAGE QUALITY (Max +10, Min -5)
  if (enquiry.message) {
    const messageLength = enquiry.message.length;

    if (messageLength > 100) {
      // Detailed message
      score += 10;
      breakdown.messageScore = 10;
    } else if (messageLength >= 40) {
      // Decent message
      score += 5;
      breakdown.messageScore = 5;
    } else if (messageLength < 20) {
      // Very short message (likely spam)
      score -= 5;
      flags.push('short-message');
      breakdown.messageScore = -5;
    }

    // Check for spam indicators
    const hasSpamKeywords = SPAM_KEYWORDS.some(keyword =>
      enquiry.message.toLowerCase().includes(keyword)
    );

    if (hasSpamKeywords) {
      score -= 35;
      flags.push('spam-keywords');
      breakdown.spamDetected = true;
    }
  } else {
    score -= 5;
    flags.push('no-message');
    breakdown.messageScore = -5;
  }

  // EMAIL QUALITY (Max +5, Min -30)
  if (enquiry.email) {
    if (isDisposableEmail(enquiry.email)) {
      score -= 30;
      flags.push('disposable-email');
      breakdown.emailQuality = -30;
    } else if (isBusinessEmail(enquiry.email)) {
      score += 5;
      breakdown.emailQuality = 5;
    }
  }

  // BEHAVIOR SIGNALS (Max 0, Min -30)
  if (enquiry.timeOnPage && enquiry.timeOnPage < 30) {
    // Spent less than 30 seconds: rushed or bot
    score -= 10;
    flags.push('rushed-enquiry');
    breakdown.behaviorScore = -10;
  }

  if (enquiry.previousEnquiries && enquiry.previousEnquiries > 5) {
    // Sent many enquiries (possible spammer)
    score -= 20;
    flags.push('repeat-enquirer');
    breakdown.behaviorScore = (breakdown.behaviorScore || 0) - 20;
  }

  // CAPTCHA CHECK
  if (enquiry.captchaPassed === false) {
    score -= 50;
    flags.push('captcha-failed');
  }

  // Ensure score stays within 0-100 range
  score = Math.max(0, Math.min(100, score));

  // Determine rating
  let rating;
  if (score >= 75) {
    rating = 'High';
  } else if (score >= 50) {
    rating = 'Medium';
  } else {
    rating = 'Low';
  }

  return {
    score: Math.round(score),
    rating,
    flags,
    breakdown,
  };
}

/**
 * Validate an enquiry and prepare it for storage
 * @param {Object} enquiry - Raw enquiry data
 * @returns {Object} { valid: boolean, errors: Array, validatedData: Object, leadScore: Object }
 */
function validateEnquiry(enquiry) {
  const errors = [];
  const validatedData = {};

  // Required: Email
  if (!enquiry.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!validator.isEmail(enquiry.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  } else {
    validatedData.email = validator.normalizeEmail(enquiry.email);
  }

  // Required: Event date (must be future date)
  if (!enquiry.eventDate) {
    errors.push({ field: 'eventDate', message: 'Event date is required' });
  } else {
    try {
      const eventDate = new Date(enquiry.eventDate);
      const today = new Date();

      if (isNaN(eventDate.getTime())) {
        errors.push({ field: 'eventDate', message: 'Invalid date format' });
      } else if (eventDate < today) {
        errors.push({ field: 'eventDate', message: 'Event date must be in the future' });
      } else {
        validatedData.eventDate = eventDate.toISOString();
      }
    } catch (error) {
      errors.push({ field: 'eventDate', message: 'Invalid date' });
    }
  }

  // Required: Event type
  const validEventTypes = ['wedding', 'corporate', 'birthday', 'anniversary', 'other'];
  if (!enquiry.eventType) {
    errors.push({ field: 'eventType', message: 'Event type is required' });
  } else if (!validEventTypes.includes(enquiry.eventType)) {
    errors.push({ field: 'eventType', message: 'Invalid event type' });
  } else {
    validatedData.eventType = enquiry.eventType;
  }

  // Optional: Phone (validate if provided)
  if (enquiry.phone) {
    if (isValidPhone(enquiry.phone)) {
      validatedData.phone = enquiry.phone;
    } else {
      errors.push({ field: 'phone', message: 'Invalid phone number format' });
    }
  }

  // Optional: Postcode (validate if provided)
  if (enquiry.postcode) {
    if (isValidUKPostcode(enquiry.postcode)) {
      validatedData.postcode = enquiry.postcode.toUpperCase();
    } else {
      errors.push({ field: 'postcode', message: 'Invalid UK postcode format' });
    }
  }

  // Optional: Budget range
  if (enquiry.budget) {
    validatedData.budget = validator.escape(enquiry.budget);
  }

  // Optional: Guest count
  if (enquiry.guestCount) {
    const guests = parseInt(enquiry.guestCount, 10);
    if (isNaN(guests) || guests < 1 || guests > 10000) {
      errors.push({ field: 'guestCount', message: 'Invalid guest count' });
    } else {
      validatedData.guestCount = guests;
    }
  }

  // Optional: Message
  if (enquiry.message) {
    // Sanitize but don't escape (we want to preserve some formatting)
    validatedData.message = enquiry.message.trim();
  }

  // Calculate lead score
  const leadScore = calculateLeadScore({
    ...enquiry,
    ...validatedData,
  });

  return {
    valid: errors.length === 0,
    errors,
    validatedData,
    leadScore,
  };
}

module.exports = {
  calculateLeadScore,
  validateEnquiry,
  isDisposableEmail,
  isBusinessEmail,
  isValidUKPostcode,
  isValidPhone,
  daysBetween,
};
