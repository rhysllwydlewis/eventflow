/**
 * Analytics Service
 * Tracks supplier profile views and enquiries
 */

'use strict';

const logger = require('../utils/logger');

class AnalyticsService {
  constructor(db) {
    this.db = db;
    this.analyticsCollection = db.collection('analytics');
  }

  /**
   * Track a profile view
   */
  async trackProfileView(supplierId, viewerUserId = null, metadata = {}) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateKey = today.toISOString().split('T')[0];

      // Upsert daily analytics record
      await this.analyticsCollection.updateOne(
        { supplierId, date: dateKey },
        {
          $inc: { views: 1 },
          $setOnInsert: {
            supplierId,
            date: dateKey,
            enquiries: 0,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
          $push: {
            viewDetails: {
              $each: [{
                viewerUserId,
                timestamp: new Date(),
                ...metadata,
              }],
              $slice: -100, // Keep last 100 view details
            },
          },
        },
        { upsert: true }
      );

      logger.debug('Profile view tracked', { supplierId, viewerUserId });
    } catch (error) {
      logger.error('Failed to track profile view', { error: error.message, supplierId });
    }
  }

  /**
   * Track an enquiry
   */
  async trackEnquiry(supplierId, userId, enquiryType = 'message') {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateKey = today.toISOString().split('T')[0];

      await this.analyticsCollection.updateOne(
        { supplierId, date: dateKey },
        {
          $inc: { enquiries: 1 },
          $setOnInsert: {
            supplierId,
            date: dateKey,
            views: 0,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
          $push: {
            enquiryDetails: {
              $each: [{
                userId,
                enquiryType,
                timestamp: new Date(),
              }],
              $slice: -100,
            },
          },
        },
        { upsert: true }
      );

      logger.debug('Enquiry tracked', { supplierId, userId, enquiryType });
    } catch (error) {
      logger.error('Failed to track enquiry', { error: error.message, supplierId });
    }
  }

  /**
   * Get analytics for a supplier
   */
  async getSupplierAnalytics(supplierId, period = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      startDate.setHours(0, 0, 0, 0);

      const analytics = await this.analyticsCollection
        .find({
          supplierId,
          date: { $gte: startDate.toISOString().split('T')[0] },
        })
        .sort({ date: 1 })
        .toArray();

      // Calculate totals
      const totals = analytics.reduce(
        (acc, day) => ({
          views: acc.views + (day.views || 0),
          enquiries: acc.enquiries + (day.enquiries || 0),
        }),
        { views: 0, enquiries: 0 }
      );

      return {
        period,
        totals,
        daily: analytics.map(a => ({
          date: a.date,
          views: a.views || 0,
          enquiries: a.enquiries || 0,
        })),
      };
    } catch (error) {
      logger.error('Failed to get supplier analytics', { error: error.message, supplierId });
      throw error;
    }
  }
}

module.exports = { AnalyticsService };
