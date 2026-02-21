/**
 * Migration Script: v1/v2/v3 Messaging to v4
 * Migrates all existing conversations and messages to the new v4 schema
 */

'use strict';

const { MongoClient } = require('mongodb');
require('dotenv').config();

const logger = console;

class MessengerV4Migrator {
  constructor(db) {
    this.db = db;
    this.stats = {
      conversationsProcessed: 0,
      conversationsCreated: 0,
      conversationsSkipped: 0,
      messagesProcessed: 0,
      messagesMigrated: 0,
      errors: [],
    };
  }

  /**
   * Run complete migration
   */
  async migrate() {
    logger.info('Starting Messenger v4 migration...');

    try {
      // Step 1: Create indexes
      await this.createIndexes();

      // Step 2: Migrate v1/v2 threads
      await this.migrateV1V2Threads();

      // Step 3: Migrate v3 conversations
      await this.migrateV3Conversations();

      // Step 4: Verify migration
      await this.verifyMigration();

      logger.info('Migration completed successfully', this.stats);
      return this.stats;
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Create v4 indexes
   */
  async createIndexes() {
    logger.info('Creating v4 indexes...');

    const conversationsV4 = this.db.collection('conversations_v4');
    const messagesV4 = this.db.collection('chat_messages_v4');

    // Conversation indexes
    await conversationsV4.createIndexes([
      {
        key: { 'participants.userId': 1, status: 1, updatedAt: -1 },
        name: 'participant_status_updated',
      },
      {
        key: { type: 1, updatedAt: -1 },
        name: 'type_updated',
      },
      {
        key: { 'context.referenceId': 1, 'context.type': 1 },
        name: 'context_reference',
        sparse: true,
      },
      {
        key: { 'participants.userId': 1, 'participants.isPinned': 1 },
        name: 'participant_pinned',
        sparse: true,
      },
      {
        key: { 'participants.userId': 1, 'participants.isArchived': 1 },
        name: 'participant_archived',
        sparse: true,
      },
      {
        key: { 'participants.userId': 1, 'participants.unreadCount': 1 },
        name: 'participant_unread',
        sparse: true,
      },
      {
        key: { 'participants.userId': 1 },
        name: 'participants_dedup',
      },
    ]);

    // Message indexes
    await messagesV4.createIndexes([
      {
        key: { conversationId: 1, createdAt: -1 },
        name: 'conversation_created',
      },
      {
        key: { senderId: 1, createdAt: -1 },
        name: 'sender_created',
      },
      {
        key: { 'readBy.userId': 1, 'readBy.readAt': -1 },
        name: 'read_by_user',
        sparse: true,
      },
      {
        key: { content: 'text' },
        name: 'content_text',
        weights: { content: 10 },
        default_language: 'english',
      },
      {
        key: { 'replyTo.messageId': 1 },
        name: 'reply_to',
        sparse: true,
      },
      {
        key: { conversationId: 1, isDeleted: 1, createdAt: -1 },
        name: 'conversation_deleted_created',
      },
    ]);

    logger.info('Indexes created successfully');
  }

  /**
   * Migrate v1/v2 threads to v4 conversations
   */
  async migrateV1V2Threads() {
    logger.info('Migrating v1/v2 threads...');

    const threadsCollection = this.db.collection('threads');
    const messagesCollection = this.db.collection('messages');
    const conversationsV4 = this.db.collection('conversations_v4');
    const messagesV4 = this.db.collection('chat_messages_v4');
    const usersCollection = this.db.collection('users');

    const threads = await threadsCollection.find({}).toArray();
    logger.info(`Found ${threads.length} v1/v2 threads to migrate`);

    for (const thread of threads) {
      try {
        this.stats.conversationsProcessed++;

        // Extract participant IDs (handle both v1 and v2 formats)
        let participantIds = [];
        if (thread.participants && Array.isArray(thread.participants)) {
          // v2 format
          participantIds = thread.participants;
        } else if (thread.customerId && thread.recipientId) {
          // v1 format
          participantIds = [thread.customerId, thread.recipientId];
        } else {
          logger.warn(`Thread ${thread._id} has invalid participant format, skipping`);
          this.stats.conversationsSkipped++;
          continue;
        }

        // Check if already migrated
        const existingConv = await conversationsV4.findOne({
          'context.type': 'legacy_thread',
          'context.referenceId': thread._id.toString(),
        });

        if (existingConv) {
          logger.debug(`Thread ${thread._id} already migrated, skipping`);
          this.stats.conversationsSkipped++;
          continue;
        }

        // Fetch user information
        const users = await usersCollection
          .find({
            _id: { $in: participantIds },
          })
          .toArray();

        if (users.length === 0) {
          logger.warn(`No users found for thread ${thread._id}, skipping`);
          this.stats.conversationsSkipped++;
          continue;
        }

        // Build participants array
        const participants = users.map(user => ({
          userId: user._id,
          displayName: user.displayName || user.businessName || user.email || 'Unknown',
          avatar: user.avatar || null,
          role: user.role || 'customer',
          isPinned: false,
          isMuted: false,
          isArchived: false,
          unreadCount: 0,
          lastReadAt: null,
        }));

        // Determine conversation type
        let conversationType = 'direct';
        let context = {
          type: 'legacy_thread',
          referenceId: thread._id.toString(),
          referenceTitle: thread.subject || null,
          referenceImage: null,
        };

        // Check if thread has package context
        if (thread.packageId) {
          conversationType = 'enquiry';
          context = {
            type: 'package',
            referenceId: thread.packageId,
            referenceTitle: thread.packageTitle || thread.subject || null,
            referenceImage: null,
          };
        }

        // Get messages for this thread
        const threadMessages = await messagesCollection
          .find({
            $or: [{ threadId: thread._id }, { threadId: thread._id.toString() }],
          })
          .sort({ timestamp: 1 })
          .toArray();

        // Create conversation
        const conversation = {
          type: conversationType,
          participants,
          context,
          lastMessage: null,
          metadata: {
            migratedFrom: 'v1_v2_threads',
            originalThreadId: thread._id.toString(),
          },
          status: thread.status === 'closed' ? 'closed' : 'active',
          messageCount: threadMessages.length,
          createdAt: thread.createdAt || new Date(thread.timestamp) || new Date(),
          updatedAt: thread.updatedAt || new Date(),
        };

        // Add last message if available
        if (threadMessages.length > 0) {
          const lastMsg = threadMessages[threadMessages.length - 1];
          const lastSender = users.find(u => u._id === lastMsg.senderId);

          conversation.lastMessage = {
            content: (lastMsg.content || '').substring(0, 100),
            senderId: lastMsg.senderId,
            senderName: lastSender
              ? lastSender.displayName || lastSender.businessName || lastSender.email
              : 'Unknown',
            sentAt: lastMsg.timestamp || lastMsg.createdAt || new Date(),
            type: 'text',
          };
        }

        const convResult = await conversationsV4.insertOne(conversation);
        const conversationId = convResult.insertedId;

        this.stats.conversationsCreated++;

        // Migrate messages
        for (const msg of threadMessages) {
          try {
            const sender = users.find(u => u._id === msg.senderId);

            const migratedMessage = {
              conversationId,
              senderId: msg.senderId,
              senderName: sender
                ? sender.displayName || sender.businessName || sender.email
                : 'Unknown',
              senderAvatar: sender?.avatar || null,
              content: msg.content || '',
              type: 'text',
              attachments: msg.attachments || [],
              replyTo: null,
              reactions: msg.reactions || [],
              readBy: msg.readBy || [{ userId: msg.senderId, readAt: msg.timestamp }],
              editedAt: msg.editedAt || null,
              isDeleted: msg.isDeleted || false,
              createdAt: msg.timestamp || msg.createdAt || new Date(),
            };

            await messagesV4.insertOne(migratedMessage);
            this.stats.messagesProcessed++;
            this.stats.messagesMigrated++;
          } catch (msgError) {
            logger.error(`Error migrating message ${msg._id}:`, msgError);
            this.stats.errors.push({
              type: 'message_migration',
              messageId: msg._id,
              error: msgError.message,
            });
          }
        }

        logger.debug(`Migrated thread ${thread._id} with ${threadMessages.length} messages`);
      } catch (error) {
        logger.error(`Error migrating thread ${thread._id}:`, error);
        this.stats.errors.push({
          type: 'thread_migration',
          threadId: thread._id,
          error: error.message,
        });
      }
    }

    logger.info('V1/V2 thread migration complete');
  }

  /**
   * Migrate v3 conversations to v4
   */
  async migrateV3Conversations() {
    logger.info('Migrating v3 conversations...');

    const conversationsV3 = this.db.collection('conversations');
    const messagesV3 = this.db.collection('chat_messages');
    const conversationsV4 = this.db.collection('conversations_v4');
    const messagesV4 = this.db.collection('chat_messages_v4');

    // Check if v3 collections exist
    const collections = await this.db.listCollections().toArray();
    const hasV3Conversations = collections.some(c => c.name === 'conversations');

    if (!hasV3Conversations) {
      logger.info('No v3 conversations collection found, skipping');
      return;
    }

    const conversations = await conversationsV3.find({}).toArray();
    logger.info(`Found ${conversations.length} v3 conversations to migrate`);

    for (const conv of conversations) {
      try {
        this.stats.conversationsProcessed++;

        // Check if already migrated
        const existingConv = await conversationsV4.findOne({
          'metadata.migratedFrom': 'v3_conversations',
          'metadata.originalConversationId': conv._id.toString(),
        });

        if (existingConv) {
          logger.debug(`Conversation ${conv._id} already migrated, skipping`);
          this.stats.conversationsSkipped++;
          continue;
        }

        // Transform v3 conversation to v4 format
        const v4Conversation = {
          type: conv.type || 'direct',
          participants: conv.participants || [],
          context: conv.context || null,
          lastMessage: conv.lastMessage || null,
          metadata: {
            ...conv.metadata,
            migratedFrom: 'v3_conversations',
            originalConversationId: conv._id.toString(),
          },
          status: conv.status || 'active',
          messageCount: conv.messageCount || 0,
          createdAt: conv.createdAt || new Date(),
          updatedAt: conv.updatedAt || new Date(),
        };

        const result = await conversationsV4.insertOne(v4Conversation);
        const v4ConversationId = result.insertedId;

        this.stats.conversationsCreated++;

        // Migrate messages
        if (messagesV3) {
          const messages = await messagesV3
            .find({ conversationId: conv._id })
            .sort({ createdAt: 1 })
            .toArray();

          for (const msg of messages) {
            try {
              const v4Message = {
                conversationId: v4ConversationId,
                senderId: msg.senderId,
                senderName: msg.senderName,
                senderAvatar: msg.senderAvatar || null,
                content: msg.content || '',
                type: msg.type || 'text',
                attachments: msg.attachments || [],
                replyTo: msg.replyTo || null,
                reactions: msg.reactions || [],
                readBy: msg.readBy || [],
                editedAt: msg.editedAt || null,
                isDeleted: msg.isDeleted || false,
                createdAt: msg.createdAt || new Date(),
              };

              await messagesV4.insertOne(v4Message);
              this.stats.messagesProcessed++;
              this.stats.messagesMigrated++;
            } catch (msgError) {
              logger.error(`Error migrating v3 message ${msg._id}:`, msgError);
              this.stats.errors.push({
                type: 'v3_message_migration',
                messageId: msg._id,
                error: msgError.message,
              });
            }
          }

          logger.debug(`Migrated v3 conversation ${conv._id} with ${messages.length} messages`);
        }
      } catch (error) {
        logger.error(`Error migrating v3 conversation ${conv._id}:`, error);
        this.stats.errors.push({
          type: 'v3_conversation_migration',
          conversationId: conv._id,
          error: error.message,
        });
      }
    }

    logger.info('V3 conversation migration complete');
  }

  /**
   * Verify migration results
   */
  async verifyMigration() {
    logger.info('Verifying migration...');

    const conversationsV4 = this.db.collection('conversations_v4');
    const messagesV4 = this.db.collection('chat_messages_v4');

    const conversationCount = await conversationsV4.countDocuments();
    const messageCount = await messagesV4.countDocuments();

    logger.info('Migration verification:', {
      totalConversations: conversationCount,
      totalMessages: messageCount,
    });

    // Check for orphaned messages (messages without conversations)
    const orphanedMessages = await messagesV4
      .aggregate([
        {
          $lookup: {
            from: 'conversations_v4',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversation',
          },
        },
        {
          $match: {
            conversation: { $size: 0 },
          },
        },
        {
          $count: 'count',
        },
      ])
      .toArray();

    if (orphanedMessages.length > 0 && orphanedMessages[0].count > 0) {
      logger.warn(`Found ${orphanedMessages[0].count} orphaned messages`);
    }

    logger.info('Verification complete');
  }
}

/**
 * Run migration if executed directly
 */
async function main() {
  const MONGODB_URI =
    process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eventflow';

  logger.info(`Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    const migrator = new MessengerV4Migrator(db);
    const stats = await migrator.migrate();

    logger.info('Migration completed:', stats);

    if (stats.errors.length > 0) {
      logger.warn(`Migration completed with ${stats.errors.length} errors`);
      logger.warn('First 10 errors:', stats.errors.slice(0, 10));
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = MessengerV4Migrator;
