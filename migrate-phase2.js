/**
 * Database Migration Script - Phase 2
 * Migrates database for folders, labels, and search enhancements
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const logger = require('./utils/logger');

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventflow';

/**
 * Create indices for new collections
 */
async function createIndices(db) {
  logger.info('Creating indices for Phase 2 collections...');

  const foldersCollection = db.collection('messageFolders');
  const labelsCollection = db.collection('messageLabels');
  const messagesCollection = db.collection('messages');

  // Folder indices
  await foldersCollection.createIndex({ userId: 1 });
  await foldersCollection.createIndex({ userId: 1, name: 1 });
  await foldersCollection.createIndex({ userId: 1, 'metadata.deletedAt': 1 });
  await foldersCollection.createIndex({ parentId: 1 });
  await foldersCollection.createIndex({ isSystemFolder: 1 });
  await foldersCollection.createIndex({ order: 1 });
  logger.info('✅ Created folder indices');

  // Label indices
  await labelsCollection.createIndex({ userId: 1 });
  await labelsCollection.createIndex({ userId: 1, name: 1 });
  await labelsCollection.createIndex({ 'metadata.usageCount': -1 });
  await labelsCollection.createIndex({ 'metadata.lastUsed': -1 });
  await labelsCollection.createIndex({ category: 1 });
  logger.info('✅ Created label indices');

  // Message indices for Phase 2 fields
  await messagesCollection.createIndex({ folderId: 1 });
  await messagesCollection.createIndex({ labels: 1 });
  await messagesCollection.createIndex({ folderId: 1, createdAt: -1 });
  await messagesCollection.createIndex({ labels: 1, createdAt: -1 });
  logger.info('✅ Created message Phase 2 indices');

  logger.info('✅ All indices created successfully');
}

/**
 * Initialize system folders for existing users
 */
async function initializeSystemFolders(db) {
  logger.info('Initializing system folders for existing users...');

  const usersCollection = db.collection('users');
  const foldersCollection = db.collection('messageFolders');

  // Get all active users
  const users = await usersCollection
    .find({
      deletedAt: null,
    })
    .toArray();

  logger.info(`Found ${users.length} users`);

  let foldersCreated = 0;

  for (const user of users) {
    const userId = user._id.toString();

    // Check if user already has folders
    const existingFolders = await foldersCollection.countDocuments({
      userId,
      isSystemFolder: true,
    });

    if (existingFolders > 0) {
      logger.info(`User ${userId} already has system folders, skipping...`);
      continue;
    }

    // Create system folders
    const systemFolders = [
      {
        _id: new ObjectId(),
        userId,
        name: 'Inbox',
        parentId: null,
        color: '#3B82F6',
        icon: '📥',
        isSystemFolder: true,
        messageCount: 0,
        unreadCount: 0,
        order: 1,
        isShared: false,
        sharedWith: [],
        rules: [],
        settings: {
          autoArchiveAfterDays: null,
          notificationEnabled: true,
          isCollapsed: false,
          sortBy: 'date',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          lastMessageAt: null,
          messageSize: 0,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Sent',
        parentId: null,
        color: '#10B981',
        icon: '📤',
        isSystemFolder: true,
        messageCount: 0,
        unreadCount: 0,
        order: 2,
        isShared: false,
        sharedWith: [],
        rules: [],
        settings: {
          autoArchiveAfterDays: null,
          notificationEnabled: true,
          isCollapsed: false,
          sortBy: 'date',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          lastMessageAt: null,
          messageSize: 0,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Drafts',
        parentId: null,
        color: '#F59E0B',
        icon: '📝',
        isSystemFolder: true,
        messageCount: 0,
        unreadCount: 0,
        order: 3,
        isShared: false,
        sharedWith: [],
        rules: [],
        settings: {
          autoArchiveAfterDays: null,
          notificationEnabled: true,
          isCollapsed: false,
          sortBy: 'date',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          lastMessageAt: null,
          messageSize: 0,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Starred',
        parentId: null,
        color: '#EF4444',
        icon: '⭐',
        isSystemFolder: true,
        messageCount: 0,
        unreadCount: 0,
        order: 4,
        isShared: false,
        sharedWith: [],
        rules: [],
        settings: {
          autoArchiveAfterDays: null,
          notificationEnabled: true,
          isCollapsed: false,
          sortBy: 'date',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          lastMessageAt: null,
          messageSize: 0,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Archived',
        parentId: null,
        color: '#6B7280',
        icon: '📦',
        isSystemFolder: true,
        messageCount: 0,
        unreadCount: 0,
        order: 5,
        isShared: false,
        sharedWith: [],
        rules: [],
        settings: {
          autoArchiveAfterDays: null,
          notificationEnabled: false,
          isCollapsed: false,
          sortBy: 'date',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          lastMessageAt: null,
          messageSize: 0,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Trash',
        parentId: null,
        color: '#9CA3AF',
        icon: '🗑️',
        isSystemFolder: true,
        messageCount: 0,
        unreadCount: 0,
        order: 6,
        isShared: false,
        sharedWith: [],
        rules: [],
        settings: {
          autoArchiveAfterDays: 30,
          notificationEnabled: false,
          isCollapsed: false,
          sortBy: 'date',
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          lastMessageAt: null,
          messageSize: 0,
        },
      },
    ];

    await foldersCollection.insertMany(systemFolders);
    foldersCreated += systemFolders.length;

    logger.info(`Created ${systemFolders.length} system folders for user ${userId}`);
  }

  logger.info(`✅ Created ${foldersCreated} system folders for ${users.length} users`);
}

/**
 * Initialize default labels for existing users
 */
async function initializeDefaultLabels(db) {
  logger.info('Initializing default labels for existing users...');

  const usersCollection = db.collection('users');
  const labelsCollection = db.collection('messageLabels');

  // Get all active users
  const users = await usersCollection
    .find({
      deletedAt: null,
    })
    .toArray();

  logger.info(`Found ${users.length} users`);

  let labelsCreated = 0;

  for (const user of users) {
    const userId = user._id.toString();

    // Check if user already has labels
    const existingLabels = await labelsCollection.countDocuments({ userId });

    if (existingLabels > 0) {
      logger.info(`User ${userId} already has labels, skipping...`);
      continue;
    }

    // Create default labels
    const defaultLabels = [
      {
        _id: new ObjectId(),
        userId,
        name: 'Urgent',
        color: '#FFFFFF',
        backgroundColor: '#EF4444',
        icon: '🚨',
        messageCount: 0,
        category: 'Priority',
        isShared: false,
        sharedWith: [],
        autoRules: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          frequency: 0,
        },
        mlModel: {
          isTrained: false,
          trainingDataPoints: 0,
          accuracy: 0,
          lastTrainedAt: null,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Important',
        color: '#FFFFFF',
        backgroundColor: '#F97316',
        icon: '⚠️',
        messageCount: 0,
        category: 'Priority',
        isShared: false,
        sharedWith: [],
        autoRules: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          frequency: 0,
        },
        mlModel: {
          isTrained: false,
          trainingDataPoints: 0,
          accuracy: 0,
          lastTrainedAt: null,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Work',
        color: '#FFFFFF',
        backgroundColor: '#3B82F6',
        icon: '💼',
        messageCount: 0,
        category: 'Context',
        isShared: false,
        sharedWith: [],
        autoRules: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          frequency: 0,
        },
        mlModel: {
          isTrained: false,
          trainingDataPoints: 0,
          accuracy: 0,
          lastTrainedAt: null,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Personal',
        color: '#FFFFFF',
        backgroundColor: '#10B981',
        icon: '👤',
        messageCount: 0,
        category: 'Context',
        isShared: false,
        sharedWith: [],
        autoRules: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          frequency: 0,
        },
        mlModel: {
          isTrained: false,
          trainingDataPoints: 0,
          accuracy: 0,
          lastTrainedAt: null,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Finance',
        color: '#FFFFFF',
        backgroundColor: '#F59E0B',
        icon: '💰',
        messageCount: 0,
        category: 'Topic',
        isShared: false,
        sharedWith: [],
        autoRules: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          frequency: 0,
        },
        mlModel: {
          isTrained: false,
          trainingDataPoints: 0,
          accuracy: 0,
          lastTrainedAt: null,
        },
      },
      {
        _id: new ObjectId(),
        userId,
        name: 'Follow Up',
        color: '#FFFFFF',
        backgroundColor: '#8B5CF6',
        icon: '🔄',
        messageCount: 0,
        category: 'Action',
        isShared: false,
        sharedWith: [],
        autoRules: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          frequency: 0,
        },
        mlModel: {
          isTrained: false,
          trainingDataPoints: 0,
          accuracy: 0,
          lastTrainedAt: null,
        },
      },
    ];

    await labelsCollection.insertMany(defaultLabels);
    labelsCreated += defaultLabels.length;

    logger.info(`Created ${defaultLabels.length} default labels for user ${userId}`);
  }

  logger.info(`✅ Created ${labelsCreated} default labels for ${users.length} users`);
}

/**
 * Update existing messages with Phase 2 fields
 */
async function updateExistingMessages(db) {
  logger.info('Updating existing messages with Phase 2 fields...');

  const messagesCollection = db.collection('messages');

  // Add Phase 2 fields to existing messages
  const result = await messagesCollection.updateMany(
    {
      folderId: { $exists: false },
    },
    {
      $set: {
        folderId: null,
        labels: [],
        previousFolders: [],
        previousLabels: [],
      },
    }
  );

  logger.info(`✅ Updated ${result.modifiedCount} messages with Phase 2 fields`);
}

/**
 * Main migration function
 */
async function migrate() {
  let client;

  try {
    logger.info('Starting Phase 2 migration...');
    logger.info(`Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db();
    logger.info('Connected to MongoDB successfully');

    // Run migrations
    await createIndices(db);
    await initializeSystemFolders(db);
    await initializeDefaultLabels(db);
    await updateExistingMessages(db);

    logger.info('✅ Phase 2 migration completed successfully!');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      logger.info('MongoDB connection closed');
    }
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      logger.info('Migration script finished');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
