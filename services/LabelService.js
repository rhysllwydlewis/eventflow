/**
 * Label Service
 * Business logic for message labels and tags
 */

'use strict';

const logger = require('../utils/logger');
const { ObjectId } = require('mongodb');
const {
  COLLECTIONS,
  createLabel,
  validateLabel,
  createDefaultLabels,
} = require('../models/MessageLabel');
const { COLLECTIONS: MESSAGE_COLLECTIONS } = require('../models/Message');
const { withTransaction, validateObjectId } = require('../utils/mongoHelpers');
const { isValidFolderLabelName, isValidHexColor } = require('../utils/validators');

class LabelService {
  constructor(db) {
    this.db = db;
    this.labelsCollection = db.collection(COLLECTIONS.MESSAGE_LABELS);
    this.messagesCollection = db.collection(MESSAGE_COLLECTIONS.MESSAGES);
  }

  /**
   * Create a new label
   * @param {string} userId - User ID
   * @param {string} name - Label name
   * @param {string} color - Text color
   * @param {string} backgroundColor - Background color
   * @param {string} icon - Icon/emoji
   * @returns {Promise<Object>} Created label
   */
  async createLabel(userId, name, color = null, backgroundColor = null, icon = null) {
    try {
      // Validate input
      const validation = validateLabel({ userId, name, color, backgroundColor, icon });
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if label name already exists for this user
      const existing = await this.labelsCollection.findOne({
        userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive
      });

      if (existing) {
        throw new Error('Label with this name already exists');
      }

      // Create label
      const label = createLabel({
        userId,
        name,
        color,
        backgroundColor,
        icon,
      });

      await this.labelsCollection.insertOne(label);

      logger.info('Label created', { userId, labelId: label._id.toString(), name });

      return label;
    } catch (error) {
      logger.error('Create label error', { error: error.message, userId, name });
      throw error;
    }
  }

  /**
   * Get label by ID
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Label object
   */
  async getLabel(userId, labelId) {
    try {
      const label = await this.labelsCollection.findOne({
        _id: new ObjectId(labelId),
        userId,
      });

      if (!label) {
        throw new Error('Label not found');
      }

      return label;
    } catch (error) {
      logger.error('Get label error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Get all labels for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of labels
   */
  async getUserLabels(userId) {
    try {
      const labels = await this.labelsCollection
        .find({ userId })
        .sort({ 'metadata.usageCount': -1, name: 1 })
        .toArray();

      return labels;
    } catch (error) {
      logger.error('Get user labels error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update label
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated label
   */
  async updateLabel(userId, labelId, updates) {
    try {
      await this.getLabel(userId, labelId);

      // Validate if name is being updated
      if (updates.name) {
        const validation = validateLabel({ userId, name: updates.name });
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Check for name conflicts
        const existing = await this.labelsCollection.findOne({
          _id: { $ne: new ObjectId(labelId) },
          userId,
          name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
        });

        if (existing) {
          throw new Error('Label with this name already exists');
        }
      }

      // Prepare update
      const update = {
        $set: {
          'metadata.updatedAt': new Date(),
        },
      };

      // Add allowed updates
      const allowedUpdates = ['name', 'color', 'backgroundColor', 'icon', 'category'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          update.$set[field] = updates[field];
        }
      });

      const result = await this.labelsCollection.findOneAndUpdate(
        { _id: new ObjectId(labelId), userId },
        update,
        { returnDocument: 'after' }
      );

      logger.info('Label updated', { userId, labelId });

      return result.value;
    } catch (error) {
      logger.error('Update label error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Delete label
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteLabel(userId, labelId) {
    try {
      await this.getLabel(userId, labelId);

      // Remove label from all messages
      await this.messagesCollection.updateMany(
        {
          labels: labelId,
          $or: [{ senderId: userId }, { recipientIds: userId }],
        },
        {
          $pull: { labels: labelId },
          $push: {
            previousLabels: {
              labelId: labelId,
              action: 'removed',
              actionAt: new Date(),
              actionBy: userId,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      // Delete label
      const result = await this.labelsCollection.deleteOne({
        _id: new ObjectId(labelId),
        userId,
      });

      logger.info('Label deleted', { userId, labelId });

      return { deletedCount: result.deletedCount };
    } catch (error) {
      logger.error('Delete label error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Add label to message
   * @param {string} userId - User ID
   * @param {string} messageId - Message ID
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Update result
   */
  async addLabelToMessage(userId, messageId, labelId) {
    try {
      // Verify label exists
      await this.getLabel(userId, labelId);

      // Verify message exists and user has access
      const message = await this.messagesCollection.findOne({
        _id: new ObjectId(messageId),
        $or: [{ senderId: userId }, { recipientIds: userId }],
      });

      if (!message) {
        throw new Error('Message not found or access denied');
      }

      // Check if label already applied
      if (message.labels && message.labels.includes(labelId)) {
        return { alreadyApplied: true };
      }

      // Add label to message
      const result = await this.messagesCollection.updateOne(
        { _id: new ObjectId(messageId) },
        {
          $addToSet: { labels: labelId },
          $push: {
            previousLabels: {
              labelId: labelId,
              action: 'added',
              actionAt: new Date(),
              actionBy: userId,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      // Update label statistics
      await this.labelsCollection.updateOne(
        { _id: new ObjectId(labelId) },
        {
          $inc: {
            messageCount: 1,
            'metadata.usageCount': 1,
          },
          $set: {
            'metadata.lastUsed': new Date(),
            'metadata.updatedAt': new Date(),
          },
        }
      );

      logger.info('Label added to message', { userId, messageId, labelId });

      return { modified: result.modifiedCount > 0 };
    } catch (error) {
      logger.error('Add label to message error', { error: error.message, userId, messageId });
      throw error;
    }
  }

  /**
   * Remove label from message
   * @param {string} userId - User ID
   * @param {string} messageId - Message ID
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Update result
   */
  async removeLabelFromMessage(userId, messageId, labelId) {
    try {
      // Verify label exists
      await this.getLabel(userId, labelId);

      // Remove label from message
      const result = await this.messagesCollection.updateOne(
        {
          _id: new ObjectId(messageId),
          $or: [{ senderId: userId }, { recipientIds: userId }],
          labels: labelId,
        },
        {
          $pull: { labels: labelId },
          $push: {
            previousLabels: {
              labelId: labelId,
              action: 'removed',
              actionAt: new Date(),
              actionBy: userId,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      if (result.modifiedCount > 0) {
        // Update label statistics
        await this.labelsCollection.updateOne(
          { _id: new ObjectId(labelId) },
          {
            $inc: { messageCount: -1 },
            $set: { 'metadata.updatedAt': new Date() },
          }
        );
      }

      logger.info('Label removed from message', { userId, messageId, labelId });

      return { modified: result.modifiedCount > 0 };
    } catch (error) {
      logger.error('Remove label from message error', { error: error.message, userId, messageId });
      throw error;
    }
  }

  /**
   * Add label to multiple messages
   * @param {string} userId - User ID
   * @param {Array<string>} messageIds - Message IDs
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Update result
   */
  async addLabelToMessages(userId, messageIds, labelId) {
    try {
      // Verify label exists
      await this.getLabel(userId, labelId);

      const result = await this.messagesCollection.updateMany(
        {
          _id: { $in: messageIds.map(id => new ObjectId(id)) },
          $or: [{ senderId: userId }, { recipientIds: userId }],
          labels: { $ne: labelId }, // Only update if label not already present
        },
        {
          $addToSet: { labels: labelId },
          $push: {
            previousLabels: {
              labelId: labelId,
              action: 'added',
              actionAt: new Date(),
              actionBy: userId,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      // Update label statistics
      if (result.modifiedCount > 0) {
        await this.labelsCollection.updateOne(
          { _id: new ObjectId(labelId) },
          {
            $inc: {
              messageCount: result.modifiedCount,
              'metadata.usageCount': result.modifiedCount,
            },
            $set: {
              'metadata.lastUsed': new Date(),
              'metadata.updatedAt': new Date(),
            },
          }
        );
      }

      logger.info('Label added to messages', {
        userId,
        labelId,
        count: result.modifiedCount,
      });

      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      logger.error('Add label to messages error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Remove label from multiple messages
   * @param {string} userId - User ID
   * @param {Array<string>} messageIds - Message IDs
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Update result
   */
  async removeLabelFromMessages(userId, messageIds, labelId) {
    try {
      // Verify label exists
      await this.getLabel(userId, labelId);

      const result = await this.messagesCollection.updateMany(
        {
          _id: { $in: messageIds.map(id => new ObjectId(id)) },
          $or: [{ senderId: userId }, { recipientIds: userId }],
          labels: labelId,
        },
        {
          $pull: { labels: labelId },
          $push: {
            previousLabels: {
              labelId: labelId,
              action: 'removed',
              actionAt: new Date(),
              actionBy: userId,
            },
          },
          $set: { updatedAt: new Date() },
        }
      );

      // Update label statistics
      if (result.modifiedCount > 0) {
        await this.labelsCollection.updateOne(
          { _id: new ObjectId(labelId) },
          {
            $inc: { messageCount: -result.modifiedCount },
            $set: { 'metadata.updatedAt': new Date() },
          }
        );
      }

      logger.info('Label removed from messages', {
        userId,
        labelId,
        count: result.modifiedCount,
      });

      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      logger.error('Remove label from messages error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Merge two labels
   * @param {string} userId - User ID
   * @param {string} sourceId - Source label ID
   * @param {string} targetId - Target label ID
   * @returns {Promise<Object>} Merge result
   */
  async mergeLabels(userId, sourceId, targetId) {
    try {
      // Verify both labels exist
      const sourceLabel = await this.getLabel(userId, sourceId);
      const targetLabel = await this.getLabel(userId, targetId);

      // Find all messages with source label
      const messages = await this.messagesCollection
        .find({
          labels: sourceId,
          $or: [{ senderId: userId }, { recipientIds: userId }],
        })
        .toArray();

      // Replace source label with target label
      for (const message of messages) {
        await this.messagesCollection.updateOne(
          { _id: message._id },
          {
            $pull: { labels: sourceId },
            $addToSet: { labels: targetId },
            $push: {
              previousLabels: {
                $each: [
                  {
                    labelId: sourceId,
                    action: 'removed',
                    actionAt: new Date(),
                    actionBy: userId,
                  },
                  {
                    labelId: targetId,
                    action: 'added',
                    actionAt: new Date(),
                    actionBy: userId,
                  },
                ],
              },
            },
            $set: { updatedAt: new Date() },
          }
        );
      }

      // Update target label count
      await this.labelsCollection.updateOne(
        { _id: new ObjectId(targetId) },
        {
          $inc: {
            messageCount: messages.length,
            'metadata.usageCount': messages.length,
          },
          $set: {
            'metadata.lastUsed': new Date(),
            'metadata.updatedAt': new Date(),
          },
        }
      );

      // Delete source label
      await this.labelsCollection.deleteOne({ _id: new ObjectId(sourceId) });

      logger.info('Labels merged', { userId, sourceId, targetId, messageCount: messages.length });

      return {
        mergedCount: messages.length,
        sourceLabel: sourceLabel.name,
        targetLabel: targetLabel.name,
      };
    } catch (error) {
      logger.error('Merge labels error', { error: error.message, userId, sourceId, targetId });
      throw error;
    }
  }

  /**
   * Get label statistics
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @returns {Promise<Object>} Label statistics
   */
  async labelStatistics(userId, labelId) {
    try {
      const label = await this.getLabel(userId, labelId);

      const stats = {
        labelId: label._id.toString(),
        name: label.name,
        messageCount: label.messageCount,
        usageCount: label.metadata.usageCount,
        lastUsed: label.metadata.lastUsed,
        frequency: label.metadata.frequency,
        createdAt: label.metadata.createdAt,
      };

      return stats;
    } catch (error) {
      logger.error('Get label statistics error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Initialize default labels for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Created default labels
   */
  async initializeDefaultLabels(userId) {
    try {
      // Check if labels already exist
      const existing = await this.labelsCollection.countDocuments({ userId });

      if (existing > 0) {
        logger.info('Labels already exist', { userId });
        return [];
      }

      const defaultLabels = createDefaultLabels(userId);

      await this.labelsCollection.insertMany(defaultLabels);

      logger.info('Default labels initialized', { userId, count: defaultLabels.length });

      return defaultLabels;
    } catch (error) {
      logger.error('Initialize default labels error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create an auto-rule for a label
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @param {Object} rule - Rule definition
   * @returns {Promise<Object>} Created rule
   */
  async createAutoRule(userId, labelId, rule) {
    try {
      const label = await this.getLabel(userId, labelId);

      const newRule = {
        _id: new ObjectId(),
        name: rule.name,
        condition: rule.condition,
        confidence: rule.confidence || 0.8,
        isActive: rule.isActive !== false,
        appliedCount: 0,
      };

      const result = await this.labelsCollection.findOneAndUpdate(
        { _id: new ObjectId(labelId), userId },
        {
          $push: { autoRules: newRule },
          $set: { 'metadata.updatedAt': new Date() },
        },
        { returnDocument: 'after' }
      );

      logger.info('Label auto-rule created', { userId, labelId, ruleId: newRule._id.toString() });

      return newRule;
    } catch (error) {
      logger.error('Create auto-rule error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Update a label auto-rule
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @param {string} ruleId - Rule ID
   * @param {Object} updates - Rule updates
   * @returns {Promise<Object>} Updated label
   */
  async updateAutoRule(userId, labelId, ruleId, updates) {
    try {
      await this.getLabel(userId, labelId);

      const updateFields = {};
      if (updates.name !== undefined) updateFields['autoRules.$.name'] = updates.name;
      if (updates.condition !== undefined)
        updateFields['autoRules.$.condition'] = updates.condition;
      if (updates.confidence !== undefined)
        updateFields['autoRules.$.confidence'] = updates.confidence;
      if (updates.isActive !== undefined) updateFields['autoRules.$.isActive'] = updates.isActive;

      const result = await this.labelsCollection.findOneAndUpdate(
        {
          _id: new ObjectId(labelId),
          userId,
          'autoRules._id': new ObjectId(ruleId),
        },
        {
          $set: {
            ...updateFields,
            'metadata.updatedAt': new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      logger.info('Label auto-rule updated', { userId, labelId, ruleId });

      return result.value;
    } catch (error) {
      logger.error('Update auto-rule error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Delete a label auto-rule
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @param {string} ruleId - Rule ID
   * @returns {Promise<Object>} Updated label
   */
  async deleteAutoRule(userId, labelId, ruleId) {
    try {
      await this.getLabel(userId, labelId);

      const result = await this.labelsCollection.findOneAndUpdate(
        { _id: new ObjectId(labelId), userId },
        {
          $pull: { autoRules: { _id: new ObjectId(ruleId) } },
          $set: { 'metadata.updatedAt': new Date() },
        },
        { returnDocument: 'after' }
      );

      logger.info('Label auto-rule deleted', { userId, labelId, ruleId });

      return result.value;
    } catch (error) {
      logger.error('Delete auto-rule error', { error: error.message, userId, labelId });
      throw error;
    }
  }

  /**
   * Test a label auto-rule
   * @param {string} userId - User ID
   * @param {string} labelId - Label ID
   * @param {string} ruleId - Rule ID
   * @returns {Promise<Object>} Test results
   */
  async testAutoRule(userId, labelId, ruleId) {
    try {
      const label = await this.getLabel(userId, labelId);
      const rule = label.autoRules.find(r => r._id.toString() === ruleId);

      if (!rule) {
        throw new Error('Auto-rule not found');
      }

      // Simple test: count messages that would match
      const matchCount = await this.messagesCollection.countDocuments({
        $or: [{ senderId: userId }, { recipientIds: userId }],
        deletedAt: null,
        labels: { $ne: labelId },
        // Would add parsed condition here
      });

      return {
        ruleId,
        ruleName: rule.name,
        matchCount,
        condition: rule.condition,
        confidence: rule.confidence,
      };
    } catch (error) {
      logger.error('Test auto-rule error', { error: error.message, userId, labelId });
      throw error;
    }
  }
}

module.exports = LabelService;
