/**
 * Integration tests for Lead Scoring System
 * Tests the complete lead scoring and validation flow
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

describe('Lead Scoring System Integration', () => {
  describe('Complete Lead Scoring Flow', () => {
    it('should score a high-quality lead correctly', () => {
      const highQualityLead = {
        email: 'john.smith@eventcompany.co.uk',
        phone: '07700 900123',
        eventDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days out
        eventType: 'wedding',
        budget: '£5,000-£10,000',
        guestCount: 100,
        postcode: 'SW1A 1AA',
        message:
          'We are planning our wedding for next summer and are looking for a beautiful venue in London. We expect around 100 guests and have a budget of £10,000. We would love to schedule a viewing.',
        timeOnPage: 120,
        captchaPassed: true,
      };

      const result = calculateLeadScore(highQualityLead);

      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.rating).toBe('High');
      expect(result.flags).toHaveLength(0);
      expect(result.breakdown.eventDateScore).toBeGreaterThan(0);
      expect(result.breakdown.contactScore).toBeGreaterThan(0);
      expect(result.breakdown.messageScore).toBeGreaterThan(0);
    });

    it('should score a low-quality lead correctly', () => {
      const lowQualityLead = {
        email: 'test@tempmail.com', // Disposable email
        eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days out (last minute)
        eventType: 'birthday',
        message: 'Hi', // Very short message
        timeOnPage: 15, // Very short time on page
        previousEnquiries: 8, // Repeat enquirer
        captchaPassed: true,
      };

      const result = calculateLeadScore(lowQualityLead);

      expect(result.score).toBeLessThan(50);
      expect(result.rating).toBe('Low');
      expect(result.flags).toContain('disposable-email');
      expect(result.flags).toContain('last-minute');
      expect(result.flags).toContain('short-message');
      expect(result.flags).toContain('rushed-enquiry');
      expect(result.flags).toContain('repeat-enquirer');
    });

    it('should score a medium-quality lead correctly', () => {
      const mediumQualityLead = {
        email: 'customer@gmail.com', // Free email but not disposable
        phone: '07700 900456',
        eventDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months out
        eventType: 'corporate',
        guestCount: 50,
        message: 'Looking for corporate event venue for team building event.',
        captchaPassed: true,
      };

      const result = calculateLeadScore(mediumQualityLead);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(75);
      expect(result.rating).toBe('Medium');
    });

    it('should detect and penalize spam leads', () => {
      const spamLead = {
        email: 'spam@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'other',
        message: 'Click here to buy now! Limited time offer! Act now for free money!',
        captchaPassed: true,
      };

      const result = calculateLeadScore(spamLead);

      expect(result.flags).toContain('spam-keywords');
      expect(result.breakdown.spamDetected).toBe(true);
      expect(result.score).toBeLessThan(50);
    });

    it('should handle failed CAPTCHA appropriately', () => {
      const noCaptchaLead = {
        email: 'user@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
        message: 'Interested in your venue',
        captchaPassed: false,
      };

      const result = calculateLeadScore(noCaptchaLead);

      expect(result.flags).toContain('captcha-failed');
      expect(result.score).toBeLessThan(50);
    });
  });

  describe('Enquiry Validation', () => {
    it('should validate a complete and valid enquiry', () => {
      const validEnquiry = {
        email: 'bride@example.com',
        phone: '07700 900123',
        eventDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
        budget: '£5,000-£10,000',
        guestCount: 80,
        postcode: 'M1 1AE',
        message: 'We are planning our dream wedding and would love to visit your venue.',
      };

      const result = validateEnquiry(validEnquiry);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validatedData.email).toBeDefined();
      expect(result.validatedData.eventDate).toBeDefined();
      expect(result.validatedData.eventType).toBe('wedding');
      expect(result.leadScore.score).toBeGreaterThan(0);
    });

    it('should reject enquiry with missing required fields', () => {
      const invalidEnquiry = {
        message: 'I want to book a venue',
      };

      const result = validateEnquiry(invalidEnquiry);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const errorFields = result.errors.map(e => e.field);
      expect(errorFields).toContain('email');
      expect(errorFields).toContain('eventDate');
      expect(errorFields).toContain('eventType');
    });

    it('should reject enquiry with invalid email format', () => {
      const enquiry = {
        email: 'not-an-email',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
      };

      const result = validateEnquiry(enquiry);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject enquiry with past event date', () => {
      const enquiry = {
        email: 'user@example.com',
        eventDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // Past date
        eventType: 'wedding',
      };

      const result = validateEnquiry(enquiry);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'eventDate')).toBe(true);
      expect(result.errors.some(e => e.message.includes('future'))).toBe(true);
    });

    it('should reject enquiry with invalid event type', () => {
      const enquiry = {
        email: 'user@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'invalid-type',
      };

      const result = validateEnquiry(enquiry);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'eventType')).toBe(true);
    });

    it('should validate optional fields when provided', () => {
      const enquiry = {
        email: 'user@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
        phone: '07700 900123',
        postcode: 'SW1A 1AA',
        guestCount: '100',
      };

      const result = validateEnquiry(enquiry);

      expect(result.valid).toBe(true);
      expect(result.validatedData.phone).toBe(enquiry.phone);
      expect(result.validatedData.postcode).toBe('SW1A 1AA');
      expect(result.validatedData.guestCount).toBe(100);
    });

    it('should reject invalid optional fields', () => {
      const enquiry = {
        email: 'user@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
        phone: '123', // Invalid
        postcode: 'INVALID', // Invalid
        guestCount: 'not-a-number', // Invalid
      };

      const result = validateEnquiry(enquiry);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'phone')).toBe(true);
      expect(result.errors.some(e => e.field === 'postcode')).toBe(true);
      expect(result.errors.some(e => e.field === 'guestCount')).toBe(true);
    });

    it('should sanitize message content', () => {
      const enquiry = {
        email: 'user@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
        message: '  Message with   extra   spaces  ',
      };

      const result = validateEnquiry(enquiry);

      expect(result.valid).toBe(true);
      expect(result.validatedData.message).toBe('Message with   extra   spaces');
      expect(result.validatedData.message.startsWith(' ')).toBe(false);
      expect(result.validatedData.message.endsWith(' ')).toBe(false);
    });
  });

  describe('Email Quality Detection', () => {
    it('should identify disposable email providers', () => {
      const disposableEmails = [
        'test@tempmail.com',
        'user@10minutemail.com',
        'spam@guerrillamail.com',
        'fake@mailinator.com',
        'temp@yopmail.com',
      ];

      disposableEmails.forEach(email => {
        expect(isDisposableEmail(email)).toBe(true);
      });
    });

    it('should not flag legitimate email providers as disposable', () => {
      const legitimateEmails = [
        'user@gmail.com',
        'contact@company.co.uk',
        'admin@business.com',
        'info@organization.org',
      ];

      legitimateEmails.forEach(email => {
        expect(isDisposableEmail(email)).toBe(false);
      });
    });

    it('should identify business email addresses', () => {
      const businessEmails = [
        'contact@eventcompany.co.uk',
        'sales@venuehire.com',
        'info@weddingplanners.org',
        'admin@events.net',
      ];

      businessEmails.forEach(email => {
        expect(isBusinessEmail(email)).toBe(true);
      });
    });

    it('should not flag free email providers as business', () => {
      const freeEmails = [
        'user@gmail.com',
        'contact@yahoo.com',
        'admin@hotmail.com',
        'info@outlook.com',
        'test@aol.com',
      ];

      freeEmails.forEach(email => {
        expect(isBusinessEmail(email)).toBe(false);
      });
    });

    it('should handle invalid email gracefully', () => {
      expect(isDisposableEmail(null)).toBe(false);
      expect(isDisposableEmail('')).toBe(false);
      expect(isDisposableEmail('not-an-email')).toBe(false);
      expect(isBusinessEmail(undefined)).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate UK phone numbers', () => {
      const validPhones = [
        '07700 900123',
        '07700900123',
        '+447700900123',
        '020 7946 0958',
        '02079460958',
        '01632 960123',
      ];

      validPhones.forEach(phone => {
        expect(isValidPhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = ['123', '12345', 'not-a-phone', '+1234567890123456', ''];

      invalidPhones.forEach(phone => {
        expect(isValidPhone(phone)).toBe(false);
      });
    });

    it('should handle phone numbers with formatting characters', () => {
      const formattedPhones = ['07700-900-123', '(020) 7946 0958', '+44 (0)7700 900123'];

      formattedPhones.forEach(phone => {
        expect(isValidPhone(phone)).toBe(true);
      });
    });
  });

  describe('UK Postcode Validation', () => {
    it('should validate correct UK postcodes', () => {
      const validPostcodes = [
        'SW1A 1AA',
        'M1 1AE',
        'B33 8TH',
        'CR2 6XH',
        'DN55 1PT',
        'W1A 0AX',
        'EC1A 1BB',
      ];

      validPostcodes.forEach(postcode => {
        expect(isValidUKPostcode(postcode)).toBe(true);
      });
    });

    it('should accept postcodes without space', () => {
      const postcodes = ['SW1A1AA', 'M11AE', 'B338TH'];

      postcodes.forEach(postcode => {
        expect(isValidUKPostcode(postcode)).toBe(true);
      });
    });

    it('should reject invalid postcodes', () => {
      const invalidPostcodes = ['INVALID', '12345', 'XX99 9XX', '', 'A'];

      invalidPostcodes.forEach(postcode => {
        expect(isValidUKPostcode(postcode)).toBe(false);
      });
    });

    it('should be case insensitive', () => {
      expect(isValidUKPostcode('sw1a 1aa')).toBe(true);
      expect(isValidUKPostcode('SW1A 1AA')).toBe(true);
      expect(isValidUKPostcode('Sw1A 1aA')).toBe(true);
    });
  });

  describe('Date Calculations', () => {
    it('should calculate days between dates correctly', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-11');

      expect(daysBetween(date1, date2)).toBe(10);
    });

    it('should handle dates in reverse order', () => {
      const date1 = new Date('2024-01-11');
      const date2 = new Date('2024-01-01');

      expect(daysBetween(date1, date2)).toBe(10);
    });

    it('should return 0 for same date', () => {
      const date = new Date('2024-01-01');

      expect(daysBetween(date, date)).toBe(0);
    });
  });

  describe('Event Date Scoring', () => {
    it('should give high score for 1-12 months out', () => {
      const enquiry = {
        eventDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months
        email: 'test@example.com',
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.eventDateScore).toBeGreaterThan(10);
    });

    it('should penalize last-minute enquiries (< 30 days)', () => {
      const enquiry = {
        eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
        email: 'test@example.com',
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.eventDateScore).toBeLessThan(0);
      expect(result.flags).toContain('last-minute');
    });

    it('should penalize too-far-future enquiries (> 2 years)', () => {
      const enquiry = {
        eventDate: new Date(Date.now() + 800 * 24 * 60 * 60 * 1000).toISOString(), // ~2.2 years
        email: 'test@example.com',
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.eventDateScore).toBeLessThan(0);
      expect(result.flags).toContain('too-far-future');
    });
  });

  describe('Contact Completeness Scoring', () => {
    it('should reward both email and phone contact', () => {
      const enquiry = {
        email: 'test@example.com',
        phone: '07700 900123',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.contactScore).toBeGreaterThan(15);
    });

    it('should give lower score for email only', () => {
      const enquiry = {
        email: 'test@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.contactScore).toBeLessThan(15);
    });

    it('should flag invalid phone numbers', () => {
      const enquiry = {
        email: 'test@example.com',
        phone: '123',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = calculateLeadScore(enquiry);
      expect(result.flags).toContain('invalid-phone');
    });
  });

  describe('Message Quality Scoring', () => {
    it('should reward detailed messages (> 100 chars)', () => {
      const enquiry = {
        email: 'test@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        message:
          'We are planning a beautiful wedding and have been looking at various venues in the area. Your venue caught our eye and we would love to schedule a viewing to discuss our requirements in detail.',
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.messageScore).toBe(10);
    });

    it('should give moderate score for decent messages (50-100 chars)', () => {
      const enquiry = {
        email: 'test@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Interested in booking your venue for our wedding.',
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.messageScore).toBe(5);
    });

    it('should penalize very short messages (< 20 chars)', () => {
      const enquiry = {
        email: 'test@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Hi there',
      };

      const result = calculateLeadScore(enquiry);
      expect(result.breakdown.messageScore).toBeLessThan(0);
      expect(result.flags).toContain('short-message');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing optional fields gracefully', () => {
      const minimalEnquiry = {
        email: 'test@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
      };

      const result = validateEnquiry(minimalEnquiry);
      expect(result.valid).toBe(true);
      expect(result.leadScore).toBeDefined();
    });

    it('should handle malformed data gracefully', () => {
      const enquiry = {
        email: 'test@example.com',
        eventDate: 'invalid-date',
        eventType: 'wedding',
      };

      const result = validateEnquiry(enquiry);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'eventDate')).toBe(true);
    });

    it('should clamp scores to 0-100 range', () => {
      const veryBadEnquiry = {
        email: 'test@tempmail.com',
        eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'buy now click here',
        captchaPassed: false,
        timeOnPage: 5,
        previousEnquiries: 10,
      };

      const result = calculateLeadScore(veryBadEnquiry);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle extremely long messages', () => {
      const longMessage = 'a'.repeat(10000);
      const enquiry = {
        email: 'test@example.com',
        eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'wedding',
        message: longMessage,
      };

      const result = validateEnquiry(enquiry);
      expect(result.valid).toBe(true);
      expect(result.validatedData.message).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should correctly score a typical wedding enquiry', () => {
      const weddingEnquiry = {
        email: 'bride@gmail.com',
        phone: '07700 900123',
        eventDate: new Date(Date.now() + 240 * 24 * 60 * 60 * 1000).toISOString(), // 8 months
        eventType: 'wedding',
        budget: '£8,000-£12,000',
        guestCount: 120,
        postcode: 'OX1 1AA',
        message:
          'My fiancé and I are getting married next August and are looking for the perfect venue. We love the photos of your venue online and would like to arrange a viewing. We expect around 120 guests.',
        timeOnPage: 180,
        captchaPassed: true,
      };

      const result = calculateLeadScore(weddingEnquiry);
      expect(result.rating).toBe('High');
      expect(result.score).toBeGreaterThan(70);
    });

    it('should correctly score a corporate event enquiry', () => {
      const corporateEnquiry = {
        email: 'events@techcompany.com',
        phone: '020 7946 0958',
        eventDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 1.5 months
        eventType: 'corporate',
        guestCount: 50,
        postcode: 'EC1A 1BB',
        message: 'Looking for a venue for our annual company conference.',
        timeOnPage: 90,
        captchaPassed: true,
      };

      const result = calculateLeadScore(corporateEnquiry);
      expect(result.rating).toMatch(/Medium|High/);
      expect(result.breakdown.emailQuality).toBe(5); // Business email bonus
    });

    it('should correctly identify and score a likely spam enquiry', () => {
      const spamEnquiry = {
        email: 'bot@throwaway.email',
        eventDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'other',
        message: 'Check out this amazing offer!',
        timeOnPage: 2,
        previousEnquiries: 15,
        captchaPassed: true,
      };

      const result = calculateLeadScore(spamEnquiry);
      expect(result.rating).toBe('Low');
      expect(result.flags.length).toBeGreaterThan(3);
    });
  });
});
