/**
 * Unit tests for sentiment analysis utility
 */

'use strict';

const sentimentAnalysis = require('../../utils/sentimentAnalysis');

describe('Sentiment Analysis', () => {
  describe('analyzeSentiment', () => {
    it('should detect positive sentiment', () => {
      const text = 'This is an amazing and wonderful experience! The service was excellent.';
      const result = sentimentAnalysis.analyzeSentiment(text);
      
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.2);
      expect(result.details.positiveCount).toBeGreaterThan(0);
    });
    
    it('should detect negative sentiment', () => {
      const text = 'Terrible service, awful experience, horrible quality. Very disappointing and poor work. Would not recommend at all. Complete disaster and waste of money.';
      const result = sentimentAnalysis.analyzeSentiment(text);
      
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(-0.2);
      expect(result.details.negativeCount).toBeGreaterThan(0);
    });
    
    it('should detect neutral sentiment', () => {
      const text = 'The event happened as planned. Everything was as expected.';
      const result = sentimentAnalysis.analyzeSentiment(text);
      
      expect(result.label).toBe('neutral');
      expect(Math.abs(result.score)).toBeLessThan(0.25);
    });
    
    it('should handle empty text', () => {
      const result = sentimentAnalysis.analyzeSentiment('');
      
      expect(result.score).toBe(0);
      expect(result.label).toBe('neutral');
      expect(result.confidence).toBe(0);
    });
    
    it('should handle text with mixed sentiment', () => {
      const text = 'Great photographer but terrible communication. Beautiful photos but poor service.';
      const result = sentimentAnalysis.analyzeSentiment(text);
      
      // Should be somewhat neutral due to mixed sentiment
      expect(Math.abs(result.score)).toBeLessThan(0.5);
    });
  });
  
  describe('extractKeywords', () => {
    it('should extract positive keywords', () => {
      const text = 'Amazing service, excellent quality, professional staff. Very happy!';
      const keywords = sentimentAnalysis.extractKeywords(text);
      
      expect(keywords.length).toBeGreaterThan(0);
      
      const positiveKeywords = keywords.filter(k => k.type === 'positive');
      expect(positiveKeywords.length).toBeGreaterThan(0);
      
      // Check for specific keywords
      const hasAmazing = keywords.some(k => k.word === 'amazing');
      expect(hasAmazing).toBe(true);
    });
    
    it('should extract negative keywords', () => {
      const text = 'Bad experience, terrible service, awful quality, disappointing results.';
      const keywords = sentimentAnalysis.extractKeywords(text);
      
      expect(keywords.length).toBeGreaterThan(0);
      
      const negativeKeywords = keywords.filter(k => k.type === 'negative');
      expect(negativeKeywords.length).toBeGreaterThan(0);
    });
    
    it('should track keyword frequency', () => {
      const text = 'Great service, great quality, great experience. Everything was great!';
      const keywords = sentimentAnalysis.extractKeywords(text);
      
      const greatKeyword = keywords.find(k => k.word === 'great');
      expect(greatKeyword).toBeDefined();
      expect(greatKeyword.frequency).toBe(4);
    });
    
    it('should sort keywords by frequency', () => {
      const text = 'Good good good excellent excellent amazing';
      const keywords = sentimentAnalysis.extractKeywords(text);
      
      // Most frequent should be first
      if (keywords.length > 1) {
        expect(keywords[0].frequency).toBeGreaterThanOrEqual(keywords[1].frequency);
      }
    });
  });
  
  describe('detectSpam', () => {
    it('should detect URLs as spam', () => {
      const text = 'Check out our website at https://example.com for more info';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.isSpam).toBe(true);
      expect(result.indicators).toContain('Contains URLs');
      expect(result.spamScore).toBeGreaterThan(0);
    });
    
    it('should detect email addresses as spam', () => {
      const text = 'Contact us at spam@example.com for details';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.spamScore).toBeGreaterThan(0);
      expect(result.indicators).toContain('Contains email addresses');
    });
    
    it('should detect phone numbers as spam', () => {
      const text = 'Call us at 555-123-4567 for more information';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.spamScore).toBeGreaterThan(0);
      expect(result.indicators).toContain('Contains phone numbers');
    });
    
    it('should detect repeated characters as spam', () => {
      const text = 'Amazingggggg service!!!!!';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.spamScore).toBeGreaterThan(0);
      expect(result.indicators).toContain('Excessive repeated characters');
    });
    
    it('should detect excessive caps as spam', () => {
      const text = 'BEST SERVICE EVER AMAZING QUALITY';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.spamScore).toBeGreaterThan(0);
      expect(result.indicators).toContain('Excessive use of capital letters');
    });
    
    it('should detect short text as potential spam', () => {
      const text = 'Good';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.indicators).toContain('Text too short');
    });
    
    it('should not flag legitimate reviews as spam', () => {
      const text = 'We hired this photographer for our wedding and were extremely happy with the results. The photos captured every special moment beautifully.';
      const result = sentimentAnalysis.detectSpam(text);
      
      expect(result.isSpam).toBe(false);
      expect(result.spamScore).toBeLessThan(0.5);
    });
  });
  
  describe('checkProfanity', () => {
    it('should detect profanity', () => {
      const text = 'This is a damn bad service';
      const result = sentimentAnalysis.checkProfanity(text);
      
      expect(result.hasProfanity).toBe(true);
      expect(result.words.length).toBeGreaterThan(0);
    });
    
    it('should not flag clean text', () => {
      const text = 'Excellent service, highly recommended';
      const result = sentimentAnalysis.checkProfanity(text);
      
      expect(result.hasProfanity).toBe(false);
      expect(result.words).toEqual([]);
    });
    
    it('should handle empty text', () => {
      const result = sentimentAnalysis.checkProfanity('');
      
      expect(result.hasProfanity).toBe(false);
      expect(result.words).toEqual([]);
    });
  });
  
  describe('analyzeReview', () => {
    it('should provide comprehensive analysis', () => {
      const title = 'Amazing photographer!';
      const text = 'We had an excellent experience. The photographer was professional and creative. Highly recommended!';
      
      const result = sentimentAnalysis.analyzeReview(title, text);
      
      expect(result.sentiment).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.spam).toBeDefined();
      expect(result.profanity).toBeDefined();
      expect(result.analyzedAt).toBeDefined();
      
      // Should be positive
      expect(result.sentiment.label).toBe('positive');
      expect(result.spam.isSpam).toBe(false);
    });
    
    it('should detect problematic reviews', () => {
      const title = 'CHECK OUT OUR WEBSITE';
      const text = 'Visit https://example.com for amazing deals!!! Call now at 555-1234!!!';
      
      const result = sentimentAnalysis.analyzeReview(title, text);
      
      expect(result.spam.isSpam).toBe(true);
      expect(result.spam.indicators.length).toBeGreaterThan(0);
    });
  });
  
  describe('calculateSentimentTrend', () => {
    it('should calculate trend for reviews', () => {
      const now = new Date();
      const reviews = [
        {
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          sentiment: { score: 0.5 },
        },
        {
          createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          sentiment: { score: 0.6 },
        },
        {
          createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          sentiment: { score: 0.7 },
        },
      ];
      
      const trend = sentimentAnalysis.calculateSentimentTrend(reviews, '1m');
      
      expect(trend.totalReviews).toBe(3);
      expect(trend.averageSentiment).toBeGreaterThan(0);
      expect(trend.distribution).toBeDefined();
      expect(trend.trend).toMatch(/improving|stable|declining/);
    });
    
    it('should handle empty review array', () => {
      const trend = sentimentAnalysis.calculateSentimentTrend([], '1m');
      
      expect(trend.totalReviews).toBe(0);
      expect(trend.averageSentiment).toBe(0);
    });
    
    it('should filter by time range', () => {
      const now = new Date();
      const reviews = [
        {
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          sentiment: { score: 0.5 },
        },
        {
          createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
          sentiment: { score: 0.6 },
        },
      ];
      
      const weekTrend = sentimentAnalysis.calculateSentimentTrend(reviews, '1w');
      const monthTrend = sentimentAnalysis.calculateSentimentTrend(reviews, '1m');
      
      expect(weekTrend.totalReviews).toBe(1); // Only recent review
      expect(monthTrend.totalReviews).toBe(1); // Only review within 30 days
    });
  });
  
  describe('tokenize', () => {
    it('should tokenize text correctly', () => {
      const text = 'This is a test! With punctuation...';
      const tokens = sentimentAnalysis.tokenize(text);
      
      expect(tokens).toContain('this');
      expect(tokens).toContain('test');
      expect(tokens).toContain('with');
      expect(tokens).toContain('punctuation');
    });
    
    it('should filter short words', () => {
      const text = 'I am at the end';
      const tokens = sentimentAnalysis.tokenize(text);
      
      // Short words (< 3 chars) should be filtered
      expect(tokens).not.toContain('i');
      expect(tokens).not.toContain('am');
      expect(tokens).not.toContain('at');
      
      // Longer words should remain
      expect(tokens).toContain('the');
      expect(tokens).toContain('end');
    });
    
    it('should handle empty string', () => {
      const tokens = sentimentAnalysis.tokenize('');
      
      expect(tokens).toEqual([]);
    });
  });
});
