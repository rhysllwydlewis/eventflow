/**
 * User Service
 * Handles user management operations
 */

'use strict';

const bcrypt = require('bcryptjs');
const validator = require('validator');
const { NotFoundError, ValidationError, AuthorizationError, ConflictError } = require('../errors');
const { passwordOk } = require('../middleware/validation');
const logger = require('../utils/logger');
const { paginationHelper } = require('../utils/database');

class UserService {
  constructor(dbUnified, uid) {
    this.db = dbUnified;
    this.uid = uid;
  }

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} - User data (sanitized)
   */
  async getUserById(id) {
    const users = await this.db.read('users');
    const user = users.find(u => u.id === id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this._sanitizeUser(user);
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} - User data (sanitized)
   */
  async getUserByEmail(email) {
    const users = await this.db.read('users');
    const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase());

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this._sanitizeUser(user);
  }

  /**
   * Update user profile
   * @param {string} id - User ID
   * @param {Object} updates - Profile updates
   * @param {string} requestUserId - ID of user making the request
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(id, updates, requestUserId, requestUserRole) {
    const users = await this.db.read('users');
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      throw new NotFoundError('User not found');
    }

    const user = users[userIndex];

    // Authorization check
    if (requestUserRole !== 'admin' && requestUserId !== id) {
      throw new AuthorizationError('You do not have permission to update this user');
    }

    // Allowed fields for regular users
    const allowedFields = [
      'firstName',
      'lastName',
      'name',
      'location',
      'postcode',
      'company',
      'jobTitle',
      'website',
      'socials',
      'avatarUrl',
      'notify_account',
      'notify_marketing',
    ];

    // Admins can update role
    if (requestUserRole === 'admin') {
      allowedFields.push('role', 'verified', 'isPro');
    }

    // Apply updates
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    });

    // Update full name if firstName/lastName changed
    if (updates.firstName || updates.lastName) {
      user.name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }

    users[userIndex] = user;
    await this.db.write('users', users);

    logger.info(`User updated: ${id} by ${requestUserId}`);

    return this._sanitizeUser(user);
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current and new passwords are required');
    }

    if (!passwordOk(newPassword)) {
      throw new ValidationError('Weak password');
    }

    const users = await this.db.read('users');
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new NotFoundError('User not found');
    }

    const user = users[userIndex];

    // Verify current password
    const isValid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Update password
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    users[userIndex] = user;
    await this.db.write('users', users);

    logger.info(`Password changed for user ${userId}`);
  }

  /**
   * Delete user account
   * @param {string} id - User ID
   * @param {string} requestUserId - ID of user making the request
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<void>}
   */
  async deleteUser(id, requestUserId, requestUserRole) {
    // Only admins or the user themselves can delete
    if (requestUserRole !== 'admin' && requestUserId !== id) {
      throw new AuthorizationError('You do not have permission to delete this user');
    }

    const users = await this.db.read('users');
    const user = users.find(u => u.id === id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Remove user
    const filtered = users.filter(u => u.id !== id);
    await this.db.write('users', filtered);

    logger.info(`User deleted: ${id} by ${requestUserId}`);
  }

  /**
   * List users with filters and pagination
   * @param {Object} filters - Search filters
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<Object>} - User list and pagination
   */
  async listUsers(filters = {}, requestUserRole) {
    // Only admins can list all users
    if (requestUserRole !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }

    let users = await this.db.read('users');

    // Apply filters
    if (filters.role) {
      users = users.filter(u => u.role === filters.role);
    }

    if (filters.verified !== undefined) {
      users = users.filter(u => u.verified === filters.verified);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      users = users.filter(
        u =>
          u.email.toLowerCase().includes(searchTerm) ||
          (u.name && u.name.toLowerCase().includes(searchTerm)) ||
          (u.company && u.company.toLowerCase().includes(searchTerm))
      );
    }

    // Sort
    users.sort((a, b) => {
      const aDate = new Date(a.createdAt);
      const bDate = new Date(b.createdAt);
      return bDate - aDate;
    });

    // Pagination
    const { skip, limit, page } = paginationHelper(filters.page, filters.limit);
    const total = users.length;
    const paginatedUsers = users.slice(skip, skip + limit).map(u => this._sanitizeUser(u));

    return {
      users: paginatedUsers,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    };
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<Object>} - Updated user
   */
  async updatePreferences(userId, preferences) {
    const users = await this.db.read('users');
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      throw new NotFoundError('User not found');
    }

    const user = users[userIndex];

    // Update notification preferences
    if (preferences.notify_account !== undefined) {
      user.notify_account = !!preferences.notify_account;
    }
    if (preferences.notify_marketing !== undefined) {
      user.notify_marketing = !!preferences.notify_marketing;
      user.marketingOptIn = !!preferences.notify_marketing; // Keep legacy field in sync
    }

    users[userIndex] = user;
    await this.db.write('users', users);

    logger.info(`Preferences updated for user ${userId}`);

    return this._sanitizeUser(user);
  }

  /**
   * Remove sensitive fields from user object
   * @private
   */
  _sanitizeUser(user) {
    const {
      passwordHash,
      resetToken,
      resetTokenExpiresAt,
      verificationToken,
      verificationTokenExpiresAt,
      ...sanitized
    } = user;
    return sanitized;
  }
}

module.exports = UserService;
