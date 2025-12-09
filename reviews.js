/**
 * Reviews and Ratings System
 * Handles supplier reviews, ratings, and testimonials
 */

'use strict';

const { read, write, uid } = require('./store');

/**
 * Create a review for a supplier
 * @param {Object} reviewData - Review data
 * @returns {Promise<Object>} Created review
 */
async function createReview(reviewData) {
  const reviews = await read('reviews');
  
  const review = {
    id: uid('rev'),
    supplierId: reviewData.supplierId,
    userId: reviewData.userId,
    userName: reviewData.userName,
    rating: reviewData.rating, // 1-5 stars
    comment: reviewData.comment,
    eventType: reviewData.eventType,
    eventDate: reviewData.eventDate,
    approved: false, // Requires admin approval
    verified: reviewData.verified || false, // Verified purchase/booking
    helpful: 0, // Helpful count
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  reviews.push(review);
  await write('reviews', reviews);

  // Update supplier's average rating
  await updateSupplierRating(reviewData.supplierId);

  return review;
}

/**
 * Update supplier's average rating
 * @param {string} supplierId - Supplier ID
 * @returns {Promise<void>}
 */
async function updateSupplierRating(supplierId) {
  const reviews = await read('reviews');
  const suppliers = await read('suppliers');

  const supplierReviews = reviews.filter(
    r => r.supplierId === supplierId && r.approved
  );

  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return;

  if (supplierReviews.length > 0) {
    const totalRating = supplierReviews.reduce((sum, r) => sum + r.rating, 0);
    supplier.averageRating = totalRating / supplierReviews.length;
    supplier.reviewCount = supplierReviews.length;
  } else {
    supplier.averageRating = 0;
    supplier.reviewCount = 0;
  }

  await write('suppliers', suppliers);
}

/**
 * Get reviews for a supplier
 * @param {string} supplierId - Supplier ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} List of reviews
 */
async function getSupplierReviews(supplierId, options = {}) {
  const reviews = await read('reviews');
  
  let filtered = reviews.filter(r => r.supplierId === supplierId);

  // Filter by approval status
  if (options.approvedOnly !== false) {
    filtered = filtered.filter(r => r.approved);
  }

  // Filter by minimum rating
  if (options.minRating) {
    filtered = filtered.filter(r => r.rating >= options.minRating);
  }

  // Sort by date or helpfulness
  if (options.sortBy === 'helpful') {
    filtered.sort((a, b) => b.helpful - a.helpful);
  } else {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return filtered;
}

/**
 * Approve or reject a review (admin only)
 * @param {string} reviewId - Review ID
 * @param {boolean} approved - Approval status
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Updated review
 */
async function approveReview(reviewId, approved, adminId) {
  const reviews = await read('reviews');
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    throw new Error('Review not found');
  }

  review.approved = approved;
  review.approvedAt = new Date().toISOString();
  review.approvedBy = adminId;

  await write('reviews', reviews);

  // Update supplier rating
  await updateSupplierRating(review.supplierId);

  return review;
}

/**
 * Mark review as helpful
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} Updated review
 */
async function markHelpful(reviewId) {
  const reviews = await read('reviews');
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    throw new Error('Review not found');
  }

  review.helpful = (review.helpful || 0) + 1;
  await write('reviews', reviews);

  return review;
}

/**
 * Get pending reviews for moderation
 * @returns {Promise<Array>} List of pending reviews
 */
async function getPendingReviews() {
  const reviews = await read('reviews');
  const suppliers = await read('suppliers');

  const pending = reviews
    .filter(r => !r.approved)
    .map(review => {
      const supplier = suppliers.find(s => s.id === review.supplierId);
      return {
        ...review,
        supplierName: supplier ? supplier.name : 'Unknown',
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return pending;
}

/**
 * Get rating distribution for a supplier
 * @param {string} supplierId - Supplier ID
 * @returns {Promise<Object>} Rating distribution
 */
async function getRatingDistribution(supplierId) {
  const reviews = await read('reviews');
  const supplierReviews = reviews.filter(
    r => r.supplierId === supplierId && r.approved
  );

  const distribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  supplierReviews.forEach(review => {
    distribution[review.rating] = (distribution[review.rating] || 0) + 1;
  });

  return {
    distribution,
    total: supplierReviews.length,
    average: supplierReviews.length > 0
      ? supplierReviews.reduce((sum, r) => sum + r.rating, 0) / supplierReviews.length
      : 0,
  };
}

/**
 * Delete a review
 * @param {string} reviewId - Review ID
 * @param {string} userId - User ID (must be review owner or admin)
 * @param {boolean} isAdmin - Is user an admin
 * @returns {Promise<void>}
 */
async function deleteReview(reviewId, userId, isAdmin = false) {
  const reviews = await read('reviews');
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    throw new Error('Review not found');
  }

  // Check permissions
  if (!isAdmin && review.userId !== userId) {
    throw new Error('Not authorized to delete this review');
  }

  const supplierId = review.supplierId;
  const filtered = reviews.filter(r => r.id !== reviewId);
  
  await write('reviews', filtered);

  // Update supplier rating
  await updateSupplierRating(supplierId);
}

module.exports = {
  createReview,
  getSupplierReviews,
  approveReview,
  markHelpful,
  getPendingReviews,
  getRatingDistribution,
  updateSupplierRating,
  deleteReview,
};
