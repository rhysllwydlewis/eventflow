/**
 * Review Model
 * 
 * Enhanced review schema with comprehensive moderation, sentiment analysis,
 * and verification features.
 * 
 * Schema includes:
 * - Review content (rating, title, text)
 * - Verification data (booking linkage)
 * - Sentiment analysis results
 * - Moderation workflow state
 * - Supplier responses
 * - Voting system (helpful/unhelpful)
 * - Dispute handling
 * - Audit trail
 */

'use strict';

/**
 * Review moderation states
 */
const MODERATION_STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
  DISPUTED: 'disputed',
  DISPUTE_APPROVED: 'dispute_approved',
  DISPUTE_REJECTED: 'dispute_rejected',
};

/**
 * Verification status types
 */
const VERIFICATION_TYPES = {
  VERIFIED_BOOKING: 'verified_booking',
  VERIFIED_PURCHASE: 'verified_purchase',
  UNVERIFIED: 'unverified',
};

/**
 * Review schema definition
 * 
 * @typedef {Object} Review
 * @property {string} _id - Unique review identifier
 * @property {string} supplierId - Supplier being reviewed
 * @property {string} authorId - User who wrote the review
 * @property {string} bookingId - Optional booking reference
 * @property {number} rating - Rating value (1-5)
 * @property {string} title - Review title
 * @property {string} text - Review content
 * @property {Object} verification - Verification details
 * @property {Object} sentiment - Sentiment analysis results
 * @property {Object} moderation - Moderation workflow state
 * @property {Object} response - Supplier response (optional)
 * @property {Object} votes - Helpful/unhelpful votes
 * @property {Object} dispute - Dispute information (optional)
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * Create a new review object
 * @param {Object} data - Review data
 * @returns {Object} Review object
 */
function createReview(data) {
  const now = new Date().toISOString();
  
  return {
    _id: data._id || data.id,
    supplierId: data.supplierId,
    authorId: data.authorId,
    bookingId: data.bookingId || null,
    rating: parseInt(data.rating, 10),
    title: data.title || '',
    text: data.text || '',
    
    // Verification data
    verification: {
      status: data.verification?.status || VERIFICATION_TYPES.UNVERIFIED,
      bookingDate: data.verification?.bookingDate || null,
      eventType: data.verification?.eventType || null,
      verifiedAt: data.verification?.verifiedAt || null,
    },
    
    // Sentiment analysis (populated by sentiment service)
    sentiment: {
      score: data.sentiment?.score || 0,
      label: data.sentiment?.label || 'neutral',
      keywords: data.sentiment?.keywords || [],
      spamScore: data.sentiment?.spamScore || 0,
      analyzedAt: data.sentiment?.analyzedAt || null,
    },
    
    // Moderation workflow
    moderation: {
      state: data.moderation?.state || MODERATION_STATES.PENDING,
      autoApproved: data.moderation?.autoApproved || false,
      moderatorId: data.moderation?.moderatorId || null,
      moderatedAt: data.moderation?.moderatedAt || null,
      reason: data.moderation?.reason || '',
      previousStates: data.moderation?.previousStates || [],
    },
    
    // Supplier response
    response: data.response ? {
      supplierId: data.response.supplierId,
      text: data.response.text,
      respondedAt: data.response.respondedAt,
      updatedAt: data.response.updatedAt || null,
    } : null,
    
    // Voting system
    votes: {
      helpful: data.votes?.helpful || 0,
      unhelpful: data.votes?.unhelpful || 0,
      voters: data.votes?.voters || [], // Array of user IDs who voted
    },
    
    // Dispute system
    dispute: data.dispute ? {
      filed: true,
      filedBy: data.dispute.filedBy,
      reason: data.dispute.reason,
      evidence: data.dispute.evidence || null,
      filedAt: data.dispute.filedAt,
      resolution: data.dispute.resolution || null,
      resolvedAt: data.dispute.resolvedAt || null,
      resolvedBy: data.dispute.resolvedBy || null,
    } : null,
    
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

/**
 * Validate review data
 * @param {Object} data - Review data to validate
 * @returns {Object} Validation result
 */
function validateReview(data) {
  const errors = [];
  
  // Required fields
  if (!data.supplierId) {
    errors.push('supplierId is required');
  }
  if (!data.authorId) {
    errors.push('authorId is required');
  }
  if (!data.rating) {
    errors.push('rating is required');
  }
  
  // Rating validation
  const rating = parseInt(data.rating, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    errors.push('rating must be between 1 and 5');
  }
  
  // Text validation
  if (data.text) {
    if (data.text.length < 10) {
      errors.push('review text must be at least 10 characters');
    }
    if (data.text.length > 5000) {
      errors.push('review text cannot exceed 5000 characters');
    }
  }
  
  // Title validation
  if (data.title && data.title.length > 200) {
    errors.push('review title cannot exceed 200 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Update moderation state with audit trail
 * @param {Object} review - Review object
 * @param {string} newState - New moderation state
 * @param {string} moderatorId - Moderator user ID
 * @param {string} reason - Reason for state change
 * @returns {Object} Updated review
 */
function updateModerationState(review, newState, moderatorId, reason) {
  const now = new Date().toISOString();
  
  // Add current state to history
  review.moderation.previousStates.push({
    state: review.moderation.state,
    changedAt: now,
    changedBy: moderatorId,
  });
  
  // Update to new state
  review.moderation.state = newState;
  review.moderation.moderatorId = moderatorId;
  review.moderation.moderatedAt = now;
  review.moderation.reason = reason;
  review.updatedAt = now;
  
  return review;
}

/**
 * Add supplier response to review
 * @param {Object} review - Review object
 * @param {string} supplierId - Supplier ID
 * @param {string} text - Response text
 * @returns {Object} Updated review
 */
function addResponse(review, supplierId, text) {
  const now = new Date().toISOString();
  
  review.response = {
    supplierId,
    text,
    respondedAt: review.response?.respondedAt || now,
    updatedAt: now,
  };
  review.updatedAt = now;
  
  return review;
}

/**
 * Add vote to review
 * @param {Object} review - Review object
 * @param {string} userId - User ID
 * @param {boolean} helpful - True for helpful, false for unhelpful
 * @returns {Object} Updated review
 */
function addVote(review, userId, helpful) {
  // Check if user already voted
  if (review.votes.voters.includes(userId)) {
    throw new Error('User has already voted on this review');
  }
  
  // Add vote
  if (helpful) {
    review.votes.helpful++;
  } else {
    review.votes.unhelpful++;
  }
  
  review.votes.voters.push(userId);
  review.updatedAt = new Date().toISOString();
  
  return review;
}

/**
 * File dispute on review
 * @param {Object} review - Review object
 * @param {string} filedBy - User ID filing dispute
 * @param {string} reason - Dispute reason
 * @param {string} evidence - Evidence/details
 * @returns {Object} Updated review
 */
function fileDispute(review, filedBy, reason, evidence) {
  const now = new Date().toISOString();
  
  review.dispute = {
    filed: true,
    filedBy,
    reason,
    evidence,
    filedAt: now,
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
  };
  
  // Update moderation state to disputed
  review.moderation.state = MODERATION_STATES.DISPUTED;
  review.updatedAt = now;
  
  return review;
}

/**
 * Resolve dispute
 * @param {Object} review - Review object
 * @param {string} resolution - Resolution ('approve', 'reject', 'remove')
 * @param {string} resolvedBy - Admin user ID
 * @param {string} reason - Resolution reason
 * @returns {Object} Updated review
 */
function resolveDispute(review, resolution, resolvedBy, reason) {
  const now = new Date().toISOString();
  
  if (!review.dispute) {
    throw new Error('No dispute exists on this review');
  }
  
  review.dispute.resolution = resolution;
  review.dispute.resolvedAt = now;
  review.dispute.resolvedBy = resolvedBy;
  
  // Update moderation state based on resolution
  if (resolution === 'approve') {
    review.moderation.state = MODERATION_STATES.DISPUTE_APPROVED;
  } else {
    review.moderation.state = MODERATION_STATES.DISPUTE_REJECTED;
  }
  
  review.moderation.moderatorId = resolvedBy;
  review.moderation.moderatedAt = now;
  review.moderation.reason = reason;
  review.updatedAt = now;
  
  return review;
}

module.exports = {
  MODERATION_STATES,
  VERIFICATION_TYPES,
  createReview,
  validateReview,
  updateModerationState,
  addResponse,
  addVote,
  fileDispute,
  resolveDispute,
};
