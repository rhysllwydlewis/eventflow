/**
 * Grouping Service
 * Message grouping and organization logic
 */

'use strict';

const logger = require('../utils/logger');
const { COLLECTIONS: MESSAGE_COLLECTIONS } = require('../models/Message');

class GroupingService {
  constructor(db) {
    this.db = db;
    this.messagesCollection = db.collection(MESSAGE_COLLECTIONS.MESSAGES);
  }

  /**
   * Group messages by specified method
   * @param {Array} messages - Messages to group
   * @param {string} method - Grouping method
   * @returns {Object} Grouped messages
   */
  async groupBy(messages, method) {
    switch (method) {
      case 'sender':
        return this.groupBySender(messages);
      case 'date':
        return this.groupByDate(messages);
      case 'status':
        return this.groupByStatus(messages);
      case 'label':
        return this.groupByLabel(messages);
      case 'folder':
        return this.groupByFolder(messages);
      case 'priority':
        return this.groupByPriority(messages);
      default:
        throw new Error(`Unknown grouping method: ${method}`);
    }
  }

  /**
   * Group messages by sender
   * @param {Array} messages - Messages
   * @returns {Object} Grouped messages
   */
  groupBySender(messages) {
    const groups = {};

    for (const message of messages) {
      const senderId = message.senderId || 'unknown';

      if (!groups[senderId]) {
        groups[senderId] = {
          key: senderId,
          name: senderId, // Should be enriched with user name
          icon: '👤',
          messages: [],
          count: 0,
          unreadCount: 0,
        };
      }

      groups[senderId].messages.push(message);
      groups[senderId].count++;

      if (!message.readBy || message.readBy.length === 0) {
        groups[senderId].unreadCount++;
      }
    }

    return {
      method: 'sender',
      groups: Object.values(groups),
      totalGroups: Object.keys(groups).length,
    };
  }

  /**
   * Group messages by date
   * @param {Array} messages - Messages
   * @returns {Object} Grouped messages
   */
  groupByDate(messages) {
    const groups = {
      today: { key: 'today', name: 'Today', icon: '📅', messages: [], count: 0, unreadCount: 0 },
      yesterday: {
        key: 'yesterday',
        name: 'Yesterday',
        icon: '📆',
        messages: [],
        count: 0,
        unreadCount: 0,
      },
      thisWeek: {
        key: 'thisWeek',
        name: 'This Week',
        icon: '📅',
        messages: [],
        count: 0,
        unreadCount: 0,
      },
      lastMonth: {
        key: 'lastMonth',
        name: 'Last Month',
        icon: '📅',
        messages: [],
        count: 0,
        unreadCount: 0,
      },
      older: { key: 'older', name: 'Older', icon: '📦', messages: [], count: 0, unreadCount: 0 },
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    for (const message of messages) {
      const messageDate = new Date(message.createdAt);
      let groupKey;

      if (messageDate >= today) {
        groupKey = 'today';
      } else if (messageDate >= yesterday) {
        groupKey = 'yesterday';
      } else if (messageDate >= weekAgo) {
        groupKey = 'thisWeek';
      } else if (messageDate >= monthAgo) {
        groupKey = 'lastMonth';
      } else {
        groupKey = 'older';
      }

      groups[groupKey].messages.push(message);
      groups[groupKey].count++;

      if (!message.readBy || message.readBy.length === 0) {
        groups[groupKey].unreadCount++;
      }
    }

    // Filter out empty groups
    const nonEmptyGroups = Object.values(groups).filter(g => g.count > 0);

    return {
      method: 'date',
      groups: nonEmptyGroups,
      totalGroups: nonEmptyGroups.length,
    };
  }

  /**
   * Group messages by status
   * @param {Array} messages - Messages
   * @returns {Object} Grouped messages
   */
  groupByStatus(messages) {
    const groups = {
      new: { key: 'new', name: 'New', icon: '🆕', messages: [], count: 0, unreadCount: 0 },
      waiting_response: {
        key: 'waiting_response',
        name: 'Waiting Response',
        icon: '⏳',
        messages: [],
        count: 0,
        unreadCount: 0,
      },
      resolved: {
        key: 'resolved',
        name: 'Resolved',
        icon: '✅',
        messages: [],
        count: 0,
        unreadCount: 0,
      },
    };

    for (const message of messages) {
      const status = message.messageStatus || 'new';

      if (groups[status]) {
        groups[status].messages.push(message);
        groups[status].count++;

        if (!message.readBy || message.readBy.length === 0) {
          groups[status].unreadCount++;
        }
      }
    }

    // Filter out empty groups
    const nonEmptyGroups = Object.values(groups).filter(g => g.count > 0);

    return {
      method: 'status',
      groups: nonEmptyGroups,
      totalGroups: nonEmptyGroups.length,
    };
  }

  /**
   * Group messages by label
   * @param {Array} messages - Messages
   * @returns {Object} Grouped messages
   */
  groupByLabel(messages) {
    const groups = {};

    for (const message of messages) {
      const labels = message.labels || [];

      if (labels.length === 0) {
        // No labels group
        if (!groups['unlabeled']) {
          groups['unlabeled'] = {
            key: 'unlabeled',
            name: 'No Labels',
            icon: '🏷️',
            messages: [],
            count: 0,
            unreadCount: 0,
          };
        }
        groups['unlabeled'].messages.push(message);
        groups['unlabeled'].count++;
        if (!message.readBy || message.readBy.length === 0) {
          groups['unlabeled'].unreadCount++;
        }
      } else {
        // Create group for each label
        for (const labelId of labels) {
          if (!groups[labelId]) {
            groups[labelId] = {
              key: labelId,
              name: labelId, // Should be enriched with label name
              icon: '🏷️',
              messages: [],
              count: 0,
              unreadCount: 0,
            };
          }

          groups[labelId].messages.push(message);
          groups[labelId].count++;

          if (!message.readBy || message.readBy.length === 0) {
            groups[labelId].unreadCount++;
          }
        }
      }
    }

    return {
      method: 'label',
      groups: Object.values(groups),
      totalGroups: Object.keys(groups).length,
    };
  }

  /**
   * Group messages by folder
   * @param {Array} messages - Messages
   * @returns {Object} Grouped messages
   */
  groupByFolder(messages) {
    const groups = {};

    for (const message of messages) {
      const folderId = message.folderId || 'inbox';

      if (!groups[folderId]) {
        groups[folderId] = {
          key: folderId,
          name: folderId, // Should be enriched with folder name
          icon: '📁',
          messages: [],
          count: 0,
          unreadCount: 0,
        };
      }

      groups[folderId].messages.push(message);
      groups[folderId].count++;

      if (!message.readBy || message.readBy.length === 0) {
        groups[folderId].unreadCount++;
      }
    }

    return {
      method: 'folder',
      groups: Object.values(groups),
      totalGroups: Object.keys(groups).length,
    };
  }

  /**
   * Group messages by priority
   * @param {Array} messages - Messages
   * @returns {Object} Grouped messages
   */
  groupByPriority(messages) {
    const groups = {
      high: {
        key: 'high',
        name: 'High Priority',
        icon: '🔴',
        messages: [],
        count: 0,
        unreadCount: 0,
      },
      normal: { key: 'normal', name: 'Normal', icon: '🟡', messages: [], count: 0, unreadCount: 0 },
      low: { key: 'low', name: 'Low Priority', icon: '🟢', messages: [], count: 0, unreadCount: 0 },
    };

    for (const message of messages) {
      // Determine priority based on flags
      let priority = 'normal';
      if (message.isStarred || message.messageStatus === 'waiting_response') {
        priority = 'high';
      } else if (message.isArchived) {
        priority = 'low';
      }

      groups[priority].messages.push(message);
      groups[priority].count++;

      if (!message.readBy || message.readBy.length === 0) {
        groups[priority].unreadCount++;
      }
    }

    // Filter out empty groups
    const nonEmptyGroups = Object.values(groups).filter(g => g.count > 0);

    return {
      method: 'priority',
      groups: nonEmptyGroups,
      totalGroups: nonEmptyGroups.length,
    };
  }

  /**
   * Sort messages within groups
   * @param {Object} groupedMessages - Grouped messages
   * @param {string} sortBy - Sort method
   * @returns {Object} Sorted grouped messages
   */
  sortWithinGroups(groupedMessages, sortBy = 'date') {
    const sortedGroups = { ...groupedMessages };

    for (const group of sortedGroups.groups) {
      switch (sortBy) {
        case 'date':
          group.messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
        case 'sender':
          group.messages.sort((a, b) => (a.senderId || '').localeCompare(b.senderId || ''));
          break;
        case 'subject':
          group.messages.sort((a, b) =>
            (a.metadata?.subject || '').localeCompare(b.metadata?.subject || '')
          );
          break;
      }
    }

    return sortedGroups;
  }

  /**
   * Get grouping preference for user
   * @param {string} userId - User ID
   * @returns {Promise<string>} Grouping method
   */
  async getGroupingPreference(userId) {
    // Would typically fetch from user preferences
    // For now, return default
    logger.debug('Get grouping preference', { userId });
    return 'date';
  }

  /**
   * Set grouping preference for user
   * @param {string} userId - User ID
   * @param {string} method - Grouping method
   * @returns {Promise<Object>} Update result
   */
  async setGroupingPreference(userId, method) {
    try {
      // Would typically save to user preferences
      logger.info('Grouping preference set', { userId, method });
      return { success: true, method };
    } catch (error) {
      logger.error('Set grouping preference error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Perform bulk action on grouped messages
   * @param {string} userId - User ID
   * @param {string} groupKey - Group key
   * @param {string} action - Action to perform
   * @param {Array} messages - Messages in group
   * @returns {Promise<Object>} Action result
   */
  async bulkActionOnGroup(userId, groupKey, action, messages) {
    try {
      const messageIds = messages.map(m => m._id);

      switch (action) {
        case 'mark_read':
          await this.messagesCollection.updateMany(
            { _id: { $in: messageIds } },
            {
              $addToSet: {
                readBy: {
                  userId,
                  readAt: new Date(),
                },
              },
              $set: { updatedAt: new Date() },
            }
          );
          break;

        case 'mark_unread':
          await this.messagesCollection.updateMany(
            { _id: { $in: messageIds } },
            {
              $pull: { readBy: { userId } },
              $set: { updatedAt: new Date() },
            }
          );
          break;

        case 'star':
          await this.messagesCollection.updateMany(
            { _id: { $in: messageIds } },
            {
              $set: {
                isStarred: true,
                updatedAt: new Date(),
              },
            }
          );
          break;

        case 'archive':
          await this.messagesCollection.updateMany(
            { _id: { $in: messageIds } },
            {
              $set: {
                isArchived: true,
                archivedAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );
          break;

        case 'delete':
          await this.messagesCollection.updateMany(
            { _id: { $in: messageIds } },
            {
              $set: {
                deletedAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      logger.info('Bulk action on group', { userId, groupKey, action, count: messageIds.length });

      return { success: true, count: messageIds.length };
    } catch (error) {
      logger.error('Bulk action on group error', { error: error.message, userId, groupKey });
      throw error;
    }
  }
}

module.exports = GroupingService;
