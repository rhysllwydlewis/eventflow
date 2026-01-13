/**
 * Sentiment Analysis Utility
 * 
 * Provides sentiment detection, keyword extraction, and spam detection
 * for review content analysis.
 * 
 * Features:
 * - Sentiment scoring (-1.0 to +1.0 scale)
 * - Keyword extraction with frequency tracking
 * - Spam and abuse detection
 * - Profanity filtering
 * - Sentiment trend analysis
 */

'use strict';

// Sentiment keyword dictionaries with weighted scores
const POSITIVE_KEYWORDS = {
  // Excellent (0.9-1.0)
  amazing: 0.95,
  excellent: 0.95,
  outstanding: 0.95,
  exceptional: 0.95,
  incredible: 0.9,
  perfect: 0.9,
  wonderful: 0.9,
  fantastic: 0.9,
  brilliant: 0.9,
  superb: 0.9,
  
  // Very Good (0.7-0.89)
  great: 0.8,
  awesome: 0.8,
  beautiful: 0.85,
  lovely: 0.8,
  impressive: 0.8,
  professional: 0.85,
  talented: 0.8,
  helpful: 0.75,
  friendly: 0.75,
  recommended: 0.8,
  
  // Good (0.5-0.69)
  good: 0.6,
  nice: 0.6,
  pleasant: 0.65,
  satisfied: 0.65,
  happy: 0.7,
  pleased: 0.65,
  quality: 0.65,
  reliable: 0.7,
  efficient: 0.65,
  punctual: 0.7,
};

const NEGATIVE_KEYWORDS = {
  // Very Negative (-0.9 to -1.0)
  terrible: -0.95,
  horrible: -0.95,
  awful: -0.95,
  worst: -0.95,
  disgusting: -0.95,
  scam: -1.0,
  fraud: -1.0,
  
  // Negative (-0.7 to -0.89)
  bad: -0.8,
  poor: -0.8,
  disappointing: -0.85,
  unprofessional: -0.85,
  rude: -0.85,
  late: -0.7,
  overpriced: -0.75,
  
  // Moderately Negative (-0.5 to -0.69)
  mediocre: -0.6,
  average: -0.5,
  okay: -0.5,
  lacking: -0.65,
  slow: -0.6,
  expensive: -0.55,
};

// Spam indicators and patterns
const SPAM_PATTERNS = [
  /https?:\/\//gi, // URLs
  /www\./gi, // Web addresses
  /@[\w-]+\.[\w-]+/gi, // Email addresses
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone numbers
  /click\s+here/gi,
  /buy\s+now/gi,
  /limited\s+time/gi,
  /visit\s+our/gi,
  /call\s+now/gi,
  /check\s+out/gi,
];

const SUSPICIOUS_PATTERNS = {
  repeatedChars: /(.)\1{4,}/g, // 5+ repeated characters (e.g., "amazingggg")
  allCaps: /^[A-Z\s!?.,]+$/,
  excessivePunctuation: /[!?]{3,}/g,
};

// Profanity list (basic - should be expanded)
const PROFANITY_LIST = [
  'fuck',
  'shit',
  'damn',
  'hell',
  'bitch',
  'ass',
  'bastard',
  'crap',
];

/**
 * Tokenize text into words
 * @param {string} text - Input text
 * @returns {Array<string>} Array of tokens
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(token => token.length > 2); // Filter out very short words
}

/**
 * Calculate sentiment score for text
 * @param {string} text - Input text
 * @returns {Object} Sentiment analysis result
 */
function analyzeSentiment(text) {
  const tokens = tokenize(text);
  
  if (tokens.length === 0) {
    return {
      score: 0,
      label: 'neutral',
      confidence: 0,
      details: {
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        totalWords: 0,
      },
    };
  }
  
  let positiveScore = 0;
  let negativeScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  
  // Analyze each token
  tokens.forEach(token => {
    if (POSITIVE_KEYWORDS[token]) {
      positiveScore += POSITIVE_KEYWORDS[token];
      positiveCount++;
    } else if (NEGATIVE_KEYWORDS[token]) {
      negativeScore += Math.abs(NEGATIVE_KEYWORDS[token]);
      negativeCount++;
    }
  });
  
  // Calculate average scores
  const avgPositive = positiveCount > 0 ? positiveScore / positiveCount : 0;
  const avgNegative = negativeCount > 0 ? negativeScore / negativeCount : 0;
  
  // Calculate final sentiment score (-1.0 to +1.0)
  // Weight by the proportion of sentiment words found
  const sentimentWordCount = positiveCount + negativeCount;
  const sentimentRatio = sentimentWordCount / tokens.length;
  
  let finalScore = 0;
  if (sentimentWordCount > 0) {
    const rawScore = (avgPositive - avgNegative);
    // Apply confidence weighting based on sentiment word density
    finalScore = rawScore * Math.min(sentimentRatio * 3, 1);
  }
  
  // Determine label
  let label = 'neutral';
  let confidence = Math.abs(finalScore);
  
  if (finalScore > 0.3) {
    label = 'positive';
  } else if (finalScore < -0.3) {
    label = 'negative';
  }
  
  return {
    score: Number(finalScore.toFixed(2)),
    label,
    confidence: Number(confidence.toFixed(2)),
    details: {
      positiveCount,
      negativeCount,
      neutralCount: tokens.length - sentimentWordCount,
      totalWords: tokens.length,
    },
  };
}

/**
 * Extract keywords with sentiment and frequency
 * @param {string} text - Input text
 * @returns {Array<Object>} Keywords with metadata
 */
function extractKeywords(text) {
  const tokens = tokenize(text);
  const keywords = [];
  const frequency = {};
  
  // Count frequency of sentiment keywords
  tokens.forEach(token => {
    if (POSITIVE_KEYWORDS[token] || NEGATIVE_KEYWORDS[token]) {
      frequency[token] = (frequency[token] || 0) + 1;
    }
  });
  
  // Build keyword objects
  Object.entries(frequency).forEach(([word, count]) => {
    const sentiment = POSITIVE_KEYWORDS[word] || NEGATIVE_KEYWORDS[word];
    keywords.push({
      word,
      sentiment: Number(sentiment.toFixed(2)),
      frequency: count,
      type: sentiment > 0 ? 'positive' : 'negative',
    });
  });
  
  // Sort by frequency (descending)
  keywords.sort((a, b) => b.frequency - a.frequency);
  
  return keywords;
}

/**
 * Detect spam indicators in text
 * @param {string} text - Input text
 * @returns {Object} Spam detection result
 */
function detectSpam(text) {
  if (!text || typeof text !== 'string') {
    return {
      isSpam: false,
      spamScore: 0,
      indicators: [],
    };
  }
  
  const indicators = [];
  let spamScore = 0;
  
  // Check for URLs
  if (SPAM_PATTERNS[0].test(text)) {
    indicators.push('Contains URLs');
    spamScore += 0.4;
  }
  
  // Check for web addresses
  if (SPAM_PATTERNS[1].test(text)) {
    indicators.push('Contains web addresses');
    spamScore += 0.3;
  }
  
  // Check for email addresses
  if (SPAM_PATTERNS[2].test(text)) {
    indicators.push('Contains email addresses');
    spamScore += 0.3;
  }
  
  // Check for phone numbers
  if (SPAM_PATTERNS[3].test(text)) {
    indicators.push('Contains phone numbers');
    spamScore += 0.25;
  }
  
  // Check for spam keywords
  for (let i = 4; i < SPAM_PATTERNS.length; i++) {
    if (SPAM_PATTERNS[i].test(text)) {
      indicators.push('Contains spam keywords');
      spamScore += 0.15;
      break; // Only count once
    }
  }
  
  // Check for repeated characters
  if (SUSPICIOUS_PATTERNS.repeatedChars.test(text)) {
    indicators.push('Excessive repeated characters');
    spamScore += 0.2;
  }
  
  // Check for all caps (if > 50% of text)
  const words = text.split(/\s+/);
  const capsWords = words.filter(w => SUSPICIOUS_PATTERNS.allCaps.test(w));
  if (capsWords.length / words.length > 0.5) {
    indicators.push('Excessive use of capital letters');
    spamScore += 0.15;
  }
  
  // Check for excessive punctuation
  if (SUSPICIOUS_PATTERNS.excessivePunctuation.test(text)) {
    indicators.push('Excessive punctuation');
    spamScore += 0.1;
  }
  
  // Check minimum length
  if (text.length < 20) {
    indicators.push('Text too short');
    spamScore += 0.15;
  }
  
  return {
    isSpam: spamScore >= 0.5, // Threshold for spam detection
    spamScore: Number(Math.min(spamScore, 1).toFixed(2)),
    indicators,
  };
}

/**
 * Check for profanity in text
 * @param {string} text - Input text
 * @returns {Object} Profanity check result
 */
function checkProfanity(text) {
  if (!text || typeof text !== 'string') {
    return {
      hasProfanity: false,
      words: [],
    };
  }
  
  const lowerText = text.toLowerCase();
  const foundWords = [];
  
  PROFANITY_LIST.forEach(word => {
    if (lowerText.includes(word)) {
      foundWords.push(word);
    }
  });
  
  return {
    hasProfanity: foundWords.length > 0,
    words: foundWords,
  };
}

/**
 * Comprehensive review analysis
 * @param {string} title - Review title
 * @param {string} text - Review text
 * @returns {Object} Complete analysis result
 */
function analyzeReview(title, text) {
  const fullText = `${title} ${text}`;
  
  const sentiment = analyzeSentiment(fullText);
  const keywords = extractKeywords(fullText);
  const spam = detectSpam(fullText);
  const profanity = checkProfanity(fullText);
  
  return {
    sentiment,
    keywords,
    spam,
    profanity,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Calculate sentiment trend for a collection of reviews
 * @param {Array<Object>} reviews - Array of review objects with sentiment data
 * @param {string} timeRange - Time range for trend ('1w', '1m', '3m', '1y')
 * @returns {Object} Sentiment trend data
 */
function calculateSentimentTrend(reviews, timeRange = '1m') {
  const now = Date.now();
  const ranges = {
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1m': 30 * 24 * 60 * 60 * 1000,
    '3m': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  };
  
  const rangeMs = ranges[timeRange] || ranges['1m'];
  const cutoffDate = now - rangeMs;
  
  // Filter reviews within time range
  const filteredReviews = reviews.filter(r => {
    const reviewDate = new Date(r.createdAt).getTime();
    return reviewDate >= cutoffDate;
  });
  
  if (filteredReviews.length === 0) {
    return {
      averageSentiment: 0,
      trend: 'stable',
      distribution: { positive: 0, neutral: 0, negative: 0 },
      totalReviews: 0,
    };
  }
  
  // Calculate distribution
  const distribution = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  
  let totalSentiment = 0;
  
  filteredReviews.forEach(review => {
    const score = review.sentiment?.score || 0;
    totalSentiment += score;
    
    if (score > 0.3) {
      distribution.positive++;
    } else if (score < -0.3) {
      distribution.negative++;
    } else {
      distribution.neutral++;
    }
  });
  
  const averageSentiment = totalSentiment / filteredReviews.length;
  
  // Determine trend (compare first half vs second half)
  const midpoint = Math.floor(filteredReviews.length / 2);
  const firstHalf = filteredReviews.slice(0, midpoint);
  const secondHalf = filteredReviews.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((sum, r) => sum + (r.sentiment?.score || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, r) => sum + (r.sentiment?.score || 0), 0) / secondHalf.length;
  
  let trend = 'stable';
  if (secondAvg - firstAvg > 0.1) {
    trend = 'improving';
  } else if (secondAvg - firstAvg < -0.1) {
    trend = 'declining';
  }
  
  return {
    averageSentiment: Number(averageSentiment.toFixed(2)),
    trend,
    distribution,
    totalReviews: filteredReviews.length,
  };
}

module.exports = {
  analyzeSentiment,
  extractKeywords,
  detectSpam,
  checkProfanity,
  analyzeReview,
  calculateSentimentTrend,
  
  // Export for testing
  tokenize,
  POSITIVE_KEYWORDS,
  NEGATIVE_KEYWORDS,
};
