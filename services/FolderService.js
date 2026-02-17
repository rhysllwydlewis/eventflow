/**
 * Folder Service
 * Business logic for custom message folders
 */

'use strict';

const logger = require('../utils/logger');
const { ObjectId } = require('mongodb');
const {
  COLLECTIONS,
  createFolder,
  validateFolder,
  createSystemFolders,
} = require('../models/MessageFolder');
const { COLLECTIONS: MESSAGE_COLLECTIONS } = require('../models/Message');

class FolderService {
  constructor(db) {
    this.db = db;
    this.foldersCollection = db.collection(COLLECTIONS.MESSAGE_FOLDERS);
    this.messagesCollection = db.collection(MESSAGE_COLLECTIONS.MESSAGES);
  }

  /**
   * Create a new folder
   * @param {string} userId - User ID
   * @param {string} name - Folder name
   * @param {string} parentId - Parent folder ID (optional)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created folder
   */
  async createFolder(userId, name, parentId = null, options = {}) {
    try {
      // Validate input
      const validation = validateFolder({ userId, name, ...options });
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if folder name already exists for this user
      const existing = await this.foldersCollection.findOne({
        userId,
        name,
        'metadata.deletedAt': null,
      });

      if (existing) {
        throw new Error('Folder with this name already exists');
      }

      // If parentId is provided, verify it exists and belongs to user
      if (parentId) {
        const parent = await this.foldersCollection.findOne({
          _id: new ObjectId(parentId),
          userId,
          'metadata.deletedAt': null,
        });

        if (!parent) {
          throw new Error('Parent folder not found');
        }
      }

      // Create folder
      const folder = createFolder({
        userId,
        name,
        parentId,
        ...options,
      });

      await this.foldersCollection.insertOne(folder);

      logger.info('Folder created', { userId, folderId: folder._id.toString(), name });

      return folder;
    } catch (error) {
      logger.error('Create folder error', { error: error.message, userId, name });
      throw error;
    }
  }

  /**
   * Get folder by ID
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @returns {Promise<Object>} Folder object
   */
  async getFolder(userId, folderId) {
    try {
      const folder = await this.foldersCollection.findOne({
        _id: new ObjectId(folderId),
        userId,
        'metadata.deletedAt': null,
      });

      if (!folder) {
        throw new Error('Folder not found');
      }

      return folder;
    } catch (error) {
      logger.error('Get folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Get all folders for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of folders
   */
  async getUserFolders(userId) {
    try {
      const folders = await this.foldersCollection
        .find({
          userId,
          'metadata.deletedAt': null,
        })
        .sort({ order: 1, 'metadata.createdAt': 1 })
        .toArray();

      return folders;
    } catch (error) {
      logger.error('Get user folders error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get folder tree (hierarchical structure)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Folder tree
   */
  async getFolderTree(userId) {
    try {
      const folders = await this.getUserFolders(userId);

      // Build tree structure
      const folderMap = new Map();
      const rootFolders = [];

      // First pass: create map
      folders.forEach(folder => {
        folderMap.set(folder._id.toString(), { ...folder, children: [] });
      });

      // Second pass: build hierarchy
      folders.forEach(folder => {
        const folderId = folder._id.toString();
        const folderNode = folderMap.get(folderId);

        if (folder.parentId) {
          const parent = folderMap.get(folder.parentId);
          if (parent) {
            parent.children.push(folderNode);
          } else {
            rootFolders.push(folderNode);
          }
        } else {
          rootFolders.push(folderNode);
        }
      });

      return rootFolders;
    } catch (error) {
      logger.error('Get folder tree error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update folder
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated folder
   */
  async updateFolder(userId, folderId, updates) {
    try {
      const folder = await this.getFolder(userId, folderId);

      // Don't allow renaming system folders
      if (folder.isSystemFolder && updates.name) {
        throw new Error('Cannot rename system folders');
      }

      // Validate if name is being updated
      if (updates.name) {
        const validation = validateFolder({ userId, name: updates.name });
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Check for name conflicts
        const existing = await this.foldersCollection.findOne({
          _id: { $ne: new ObjectId(folderId) },
          userId,
          name: updates.name,
          'metadata.deletedAt': null,
        });

        if (existing) {
          throw new Error('Folder with this name already exists');
        }
      }

      // Prepare update
      const update = {
        $set: {
          'metadata.updatedAt': new Date(),
        },
      };

      // Add allowed updates
      const allowedUpdates = ['name', 'color', 'icon', 'parentId', 'order', 'settings'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          if (field === 'settings') {
            // Merge settings
            Object.keys(updates.settings).forEach(key => {
              update.$set[`settings.${key}`] = updates.settings[key];
            });
          } else {
            update.$set[field] = updates[field];
          }
        }
      });

      const result = await this.foldersCollection.findOneAndUpdate(
        { _id: new ObjectId(folderId), userId },
        update,
        { returnDocument: 'after' }
      );

      logger.info('Folder updated', { userId, folderId });

      return result.value;
    } catch (error) {
      logger.error('Update folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Delete folder (soft delete)
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @returns {Promise<Object>} Deleted folder
   */
  async deleteFolder(userId, folderId) {
    try {
      const folder = await this.getFolder(userId, folderId);

      // Don't allow deleting system folders
      if (folder.isSystemFolder) {
        throw new Error('Cannot delete system folders');
      }

      // Check if folder has subfolders
      const subfolders = await this.foldersCollection.countDocuments({
        userId,
        parentId: folderId,
        'metadata.deletedAt': null,
      });

      if (subfolders > 0) {
        throw new Error('Cannot delete folder with subfolders. Delete subfolders first.');
      }

      // Move messages to inbox
      const inboxFolder = await this.foldersCollection.findOne({
        userId,
        name: 'Inbox',
        isSystemFolder: true,
      });

      if (inboxFolder && folder.messageCount > 0) {
        await this.messagesCollection.updateMany(
          { folderId: folderId },
          {
            $set: { folderId: inboxFolder._id.toString() },
            $push: {
              previousFolders: {
                folderId: folderId,
                movedAt: new Date(),
                movedBy: userId,
              },
            },
          }
        );
      }

      // Soft delete folder
      const result = await this.foldersCollection.findOneAndUpdate(
        { _id: new ObjectId(folderId), userId },
        {
          $set: {
            'metadata.deletedAt': new Date(),
            'metadata.updatedAt': new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      logger.info('Folder deleted', { userId, folderId });

      return result.value;
    } catch (error) {
      logger.error('Delete folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Restore deleted folder
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @returns {Promise<Object>} Restored folder
   */
  async restoreFolder(userId, folderId) {
    try {
      const folder = await this.foldersCollection.findOne({
        _id: new ObjectId(folderId),
        userId,
      });

      if (!folder) {
        throw new Error('Folder not found');
      }

      if (!folder.metadata.deletedAt) {
        throw new Error('Folder is not deleted');
      }

      const result = await this.foldersCollection.findOneAndUpdate(
        { _id: new ObjectId(folderId), userId },
        {
          $set: {
            'metadata.deletedAt': null,
            'metadata.updatedAt': new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      logger.info('Folder restored', { userId, folderId });

      return result.value;
    } catch (error) {
      logger.error('Restore folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Move folder to new parent
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {string} newParentId - New parent ID (null for root)
   * @returns {Promise<Object>} Updated folder
   */
  async moveFolder(userId, folderId, newParentId) {
    try {
      const folder = await this.getFolder(userId, folderId);

      // Don't allow moving system folders
      if (folder.isSystemFolder) {
        throw new Error('Cannot move system folders');
      }

      // Verify new parent exists
      if (newParentId) {
        await this.getFolder(userId, newParentId);

        // Prevent circular references
        if (newParentId === folderId) {
          throw new Error('Cannot move folder into itself');
        }

        // Check if newParent is a child of folder (would create cycle)
        const isDescendant = await this.isDescendant(userId, folderId, newParentId);
        if (isDescendant) {
          throw new Error('Cannot move folder into its own subfolder');
        }
      }

      const result = await this.foldersCollection.findOneAndUpdate(
        { _id: new ObjectId(folderId), userId },
        {
          $set: {
            parentId: newParentId,
            'metadata.updatedAt': new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      logger.info('Folder moved', { userId, folderId, newParentId });

      return result.value;
    } catch (error) {
      logger.error('Move folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Reorder folders
   * @param {string} userId - User ID
   * @param {Array<Object>} folderOrders - Array of {folderId, order} objects
   * @returns {Promise<Object>} Update result
   */
  async reorderFolders(userId, folderOrders) {
    try {
      const bulkOps = [];

      for (const { folderId, order } of folderOrders) {
        bulkOps.push({
          updateOne: {
            filter: {
              _id: new ObjectId(folderId),
              userId,
              'metadata.deletedAt': null,
            },
            update: {
              $set: {
                order,
                'metadata.updatedAt': new Date(),
              },
            },
          },
        });
      }

      const result = await this.foldersCollection.bulkWrite(bulkOps);

      logger.info('Folders reordered', {
        userId,
        count: result.modifiedCount,
      });

      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      logger.error('Reorder folders error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if targetId is a descendant of folderId
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {string} targetId - Target folder ID to check
   * @returns {Promise<boolean>} True if targetId is descendant
   */
  async isDescendant(userId, folderId, targetId) {
    let currentId = targetId;

    while (currentId) {
      if (currentId === folderId) {
        return true;
      }

      const folder = await this.foldersCollection.findOne({
        _id: new ObjectId(currentId),
        userId,
      });

      if (!folder || !folder.parentId) {
        break;
      }

      currentId = folder.parentId;
    }

    return false;
  }

  /**
   * Move messages to folder
   * @param {string} userId - User ID
   * @param {Array<string>} messageIds - Message IDs
   * @param {string} folderId - Target folder ID
   * @returns {Promise<Object>} Update result
   */
  async moveMessagesToFolder(userId, messageIds, folderId) {
    try {
      // Verify folder exists and belongs to user
      await this.getFolder(userId, folderId);

      const result = await this.messagesCollection.updateMany(
        {
          _id: { $in: messageIds.map(id => new ObjectId(id)) },
          $or: [{ senderId: userId }, { recipientIds: userId }],
        },
        {
          $set: {
            folderId: folderId,
            updatedAt: new Date(),
          },
          $push: {
            previousFolders: {
              folderId: folderId,
              movedAt: new Date(),
              movedBy: userId,
            },
          },
        }
      );

      // Update message counts
      await this.updateFolderCounts(userId);

      logger.info('Messages moved to folder', {
        userId,
        folderId,
        count: result.modifiedCount,
      });

      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      logger.error('Move messages to folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Update folder message counts
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async updateFolderCounts(userId) {
    try {
      const folders = await this.getUserFolders(userId);

      for (const folder of folders) {
        const folderId = folder._id.toString();

        // Count total messages
        const messageCount = await this.messagesCollection.countDocuments({
          folderId: folderId,
          deletedAt: null,
        });

        // Count unread messages
        const unreadCount = await this.messagesCollection.countDocuments({
          folderId: folderId,
          deletedAt: null,
          readBy: { $not: { $elemMatch: { userId: userId } } },
        });

        await this.foldersCollection.updateOne(
          { _id: folder._id },
          {
            $set: {
              messageCount,
              unreadCount,
              'metadata.updatedAt': new Date(),
            },
          }
        );
      }
    } catch (error) {
      logger.error('Update folder counts error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Empty folder (delete all messages)
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @returns {Promise<Object>} Delete result
   */
  async emptyFolder(userId, folderId) {
    try {
      await this.getFolder(userId, folderId);

      const result = await this.messagesCollection.updateMany(
        {
          folderId: folderId,
          $or: [{ senderId: userId }, { recipientIds: userId }],
          deletedAt: null,
        },
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      // Update folder counts
      await this.updateFolderCounts(userId);

      logger.info('Folder emptied', { userId, folderId, count: result.modifiedCount });

      return { deletedCount: result.modifiedCount };
    } catch (error) {
      logger.error('Empty folder error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Get folder statistics
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @returns {Promise<Object>} Folder statistics
   */
  async getFolderStats(userId, folderId) {
    try {
      const folder = await this.getFolder(userId, folderId);

      const stats = {
        folderId: folder._id.toString(),
        name: folder.name,
        messageCount: folder.messageCount,
        unreadCount: folder.unreadCount,
        totalSize: folder.metadata.messageSize || 0,
        lastMessageAt: folder.metadata.lastMessageAt,
        createdAt: folder.metadata.createdAt,
      };

      return stats;
    } catch (error) {
      logger.error('Get folder stats error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Initialize system folders for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Created system folders
   */
  async initializeSystemFolders(userId) {
    try {
      // Check if system folders already exist
      const existing = await this.foldersCollection.countDocuments({
        userId,
        isSystemFolder: true,
      });

      if (existing > 0) {
        logger.info('System folders already exist', { userId });
        return [];
      }

      const systemFolders = createSystemFolders(userId);

      await this.foldersCollection.insertMany(systemFolders);

      logger.info('System folders initialized', { userId, count: systemFolders.length });

      return systemFolders;
    } catch (error) {
      logger.error('Initialize system folders error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create a folder rule
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {Object} rule - Rule definition
   * @returns {Promise<Object>} Created rule
   */
  async createRule(userId, folderId, rule) {
    try {
      const folder = await this.getFolder(userId, folderId);

      const newRule = {
        _id: new ObjectId(),
        name: rule.name,
        condition: rule.condition,
        action: rule.action || 'move',
        isActive: rule.isActive !== false,
        appliedCount: 0,
      };

      const result = await this.foldersCollection.findOneAndUpdate(
        { _id: new ObjectId(folderId), userId },
        {
          $push: { rules: newRule },
          $set: { 'metadata.updatedAt': new Date() },
        },
        { returnDocument: 'after' }
      );

      logger.info('Folder rule created', { userId, folderId, ruleId: newRule._id.toString() });

      return newRule;
    } catch (error) {
      logger.error('Create rule error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Update a folder rule
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {string} ruleId - Rule ID
   * @param {Object} updates - Rule updates
   * @returns {Promise<Object>} Updated folder
   */
  async updateRule(userId, folderId, ruleId, updates) {
    try {
      await this.getFolder(userId, folderId);

      const updateFields = {};
      if (updates.name !== undefined) updateFields['rules.$.name'] = updates.name;
      if (updates.condition !== undefined) updateFields['rules.$.condition'] = updates.condition;
      if (updates.action !== undefined) updateFields['rules.$.action'] = updates.action;
      if (updates.isActive !== undefined) updateFields['rules.$.isActive'] = updates.isActive;

      const result = await this.foldersCollection.findOneAndUpdate(
        {
          _id: new ObjectId(folderId),
          userId,
          'rules._id': new ObjectId(ruleId),
        },
        {
          $set: {
            ...updateFields,
            'metadata.updatedAt': new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      logger.info('Folder rule updated', { userId, folderId, ruleId });

      return result.value;
    } catch (error) {
      logger.error('Update rule error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Delete a folder rule
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {string} ruleId - Rule ID
   * @returns {Promise<Object>} Updated folder
   */
  async deleteRule(userId, folderId, ruleId) {
    try {
      await this.getFolder(userId, folderId);

      const result = await this.foldersCollection.findOneAndUpdate(
        { _id: new ObjectId(folderId), userId },
        {
          $pull: { rules: { _id: new ObjectId(ruleId) } },
          $set: { 'metadata.updatedAt': new Date() },
        },
        { returnDocument: 'after' }
      );

      logger.info('Folder rule deleted', { userId, folderId, ruleId });

      return result.value;
    } catch (error) {
      logger.error('Delete rule error', { error: error.message, userId, folderId });
      throw error;
    }
  }

  /**
   * Test a folder rule
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID
   * @param {string} ruleId - Rule ID
   * @returns {Promise<Object>} Test results
   */
  async testRule(userId, folderId, ruleId) {
    try {
      const folder = await this.getFolder(userId, folderId);
      const rule = folder.rules.find(r => r._id.toString() === ruleId);

      if (!rule) {
        throw new Error('Rule not found');
      }

      // Simple test: count messages that would match
      // In a real implementation, this would parse the condition properly
      const matchCount = await this.messagesCollection.countDocuments({
        $or: [{ senderId: userId }, { recipientIds: userId }],
        deletedAt: null,
        // Would add parsed condition here
      });

      return {
        ruleId,
        ruleName: rule.name,
        matchCount,
        condition: rule.condition,
      };
    } catch (error) {
      logger.error('Test rule error', { error: error.message, userId, folderId });
      throw error;
    }
  }
}

module.exports = FolderService;
