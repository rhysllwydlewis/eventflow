/**
 * Settings Service
 * Handles user settings and preferences
 */

'use strict';

const { NotFoundError } = require('../errors');
const logger = require('../utils/logger');

class SettingsService {
  constructor(dbUnified) {
    this.db = dbUnified;
  }

  /**
   * Get user settings
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User settings
   */
  async getSettings(userId) {
    const users = await this.db.read('users');
    const user = users.find(u => u.id === userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      notifications: {
        notify_account: user.notify_account !== false,
        notify_marketing: user.notify_marketing || false,
      },
      profile: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: user.name || '',
        email: user.email || '',
        location: user.location || '',
        postcode: user.postcode || '',
        company: user.company || '',
        jobTitle: user.jobTitle || '',
        website: user.website || '',
        socials: user.socials || {},
        avatarUrl: user.avatarUrl || '',
      },
      preferences: {
        // Add any user preferences here
      },
    };
  }

  /**
   * Update notification settings
   * @param {string} userId - User ID
   * @param {Object} settings - Notification settings
   * @returns {Promise<Object>} - Updated settings
   */
  async updateNotificationSettings(userId, settings) {
    const users = await this.db.read('users');
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new NotFoundError('User not found');
    }

    const user = users[userIndex];

    if (settings.notify_account !== undefined) {
      user.notify_account = !!settings.notify_account;
      user.notify = !!settings.notify_account; // Keep legacy field in sync
    }

    if (settings.notify_marketing !== undefined) {
      user.notify_marketing = !!settings.notify_marketing;
      user.marketingOptIn = !!settings.notify_marketing; // Keep legacy field in sync
    }

    users[userIndex] = user;
    await this.db.write('users', users);

    logger.info(`Notification settings updated for user ${userId}`);

    return this.getSettings(userId);
  }

  /**
   * Update profile settings
   * @param {string} userId - User ID
   * @param {Object} profile - Profile data
   * @returns {Promise<Object>} - Updated settings
   */
  async updateProfileSettings(userId, profile) {
    const users = await this.db.read('users');
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new NotFoundError('User not found');
    }

    const user = users[userIndex];

    // Update allowed profile fields
    const allowedFields = [
      'firstName',
      'lastName',
      'location',
      'postcode',
      'company',
      'jobTitle',
      'website',
      'socials',
      'avatarUrl',
    ];

    allowedFields.forEach(field => {
      if (profile[field] !== undefined) {
        user[field] = profile[field];
      }
    });

    // Update full name if firstName/lastName changed
    if (profile.firstName || profile.lastName) {
      user.name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }

    users[userIndex] = user;
    await this.db.write('users', users);

    logger.info(`Profile settings updated for user ${userId}`);

    return this.getSettings(userId);
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - User preferences
   * @returns {Promise<Object>} - Updated settings
   */
  async updatePreferences(userId, preferences) {
    // For now, preferences are stored in user object
    // In the future, could have a separate preferences collection
    logger.debug(`Updating preferences for user ${userId}`, preferences);

    return this.getSettings(userId);
  }

  /**
   * Export user data (GDPR compliance)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - All user data
   */
  async exportUserData(userId) {
    const users = await this.db.read('users');
    const user = users.find(u => u.id === userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get all related data
    const packages = await this.db.read('packages');
    const reviews = await this.db.read('reviews');
    const messages = await this.db.read('messages');
    const suppliers = await this.db.read('suppliers');

    const userPackages = packages.filter(p => p.createdBy === userId);
    const userReviews = reviews.filter(r => r.userId === userId);
    const userMessages = messages.filter(m => m.senderId === userId || m.recipientId === userId);
    const userSuppliers = suppliers.filter(s => s.ownerUserId === userId);

    // Remove sensitive data
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, resetToken, verificationToken, ...userData } = user;

    return {
      user: userData,
      packages: userPackages,
      reviews: userReviews,
      messages: userMessages,
      suppliers: userSuppliers,
      exportDate: new Date().toISOString(),
    };
  }
}

module.exports = SettingsService;
