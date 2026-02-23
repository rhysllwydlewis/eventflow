/**
 * Messenger v3 Migration Script
 * Migrates existing messaging data from v1/v2 to v3 schema
 *
 * Run: node scripts/migrate-to-messenger-v3.js
 */

'use strict';

const { ObjectId } = require('mongodb');
const mongoDb = require('../db');
const { initializeIndexes } = require('../models/Conversation');

/**
 * Map thread participants to conversation participants
 */
function mapParticipants(thread, users) {
  const participants = [];
  const now = new Date();

  // Map customerId
  if (thread.customerId) {
    const user = users.find(u => u.id === thread.customerId);
    if (user) {
      participants.push({
        userId: thread.customerId,
        displayName: user.name || 'Customer',
        avatar: user.avatar || user.name?.[0]?.toUpperCase() || 'C',
        role: 'customer',
        joinedAt: thread.createdAt || now,
        lastReadAt: thread.lastReadAt || new Date(0),
        isPinned: false,
        isMuted: false,
        isArchived: thread.status === 'archived',
        unreadCount: thread.unreadCount?.[thread.customerId] || 0,
      });
    }
  }

  // Map supplierId (needs to be resolved to ownerUserId)
  if (thread.supplierId) {
    const supplier = users.find(u => u.role === 'supplier' && u.supplierId === thread.supplierId);
    if (supplier) {
      participants.push({
        userId: supplier.id,
        displayName: supplier.name || 'Supplier',
        avatar: supplier.avatar || supplier.name?.[0]?.toUpperCase() || 'S',
        role: 'supplier',
        joinedAt: thread.createdAt || now,
        lastReadAt: new Date(0),
        isPinned: false,
        isMuted: false,
        isArchived: false,
        unreadCount: thread.unreadCount?.[supplier.id] || 0,
      });
    }
  }

  // Map recipientId (if different from above)
  if (thread.recipientId && thread.recipientId !== thread.customerId) {
    const user = users.find(u => u.id === thread.recipientId);
    if (user) {
      participants.push({
        userId: thread.recipientId,
        displayName: user.name || 'User',
        avatar: user.avatar || user.name?.[0]?.toUpperCase() || 'U',
        role: user.role || 'customer',
        joinedAt: thread.createdAt || now,
        lastReadAt: new Date(0),
        isPinned: false,
        isMuted: false,
        isArchived: false,
        unreadCount: thread.unreadCount?.[thread.recipientId] || 0,
      });
    }
  }

  return participants;
}

/**
 * Map thread context to conversation context
 */
function mapContext(thread) {
  if (thread.packageId) {
    return {
      type: 'package',
      referenceId: thread.packageId,
      referenceTitle: thread.packageTitle || 'Package',
      referenceImage: thread.packageImage || null,
      referenceUrl: `/package.html?id=${thread.packageId}`,
    };
  }

  if (thread.listingId) {
    return {
      type: 'listing',
      referenceId: thread.listingId,
      referenceTitle: thread.listingTitle || 'Listing',
      referenceImage: thread.listingImage || null,
      referenceUrl: `/listing.html?id=${thread.listingId}`,
    };
  }

  return null;
}

/**
 * Migrate threads to conversations
 */
async function migrateThreads(db) {
  console.log('\n📦 Migrating threads to conversations...');

  const threadsCollection = db.collection('threads');
  const conversationsCollection = db.collection('conversations');
  const usersCollection = db.collection('users');

  // Load all users for participant mapping
  const users = await usersCollection.find({}).toArray();
  console.log(`   Loaded ${users.length} users for mapping`);

  // Get all threads
  const threads = await threadsCollection.find({}).toArray();
  console.log(`   Found ${threads.length} threads to migrate`);

  let migrated = 0;
  let skipped = 0;
  const errors = [];

  for (const thread of threads) {
    try {
      // Map participants
      const participants = mapParticipants(thread, users);

      if (participants.length === 0) {
        console.log(`   ⚠️  Skipping thread ${thread.id} - no valid participants`);
        skipped++;
        continue;
      }

      // Build conversation document
      const conversation = {
        _id: thread._id || new ObjectId(),
        type: thread.type || 'direct',
        participants: participants,
        context: mapContext(thread),
        lastMessage: thread.lastMessagePreview
          ? {
              content: thread.lastMessagePreview.substring(0, 100),
              senderId: thread.lastMessageSenderId || participants[0].userId,
              senderName: thread.lastMessageSenderName || participants[0].displayName,
              sentAt: thread.lastMessageAt || thread.updatedAt || new Date(),
              type: 'text',
            }
          : null,
        metadata: {
          subject: thread.subject || null,
          eventType: thread.eventType || null,
          eventDate: thread.eventDate || null,
          location: thread.location || null,
          guests: thread.guests || null,
          budget: thread.budget || null,
          postcode: thread.postcode || null,
          phone: thread.phone || null,
        },
        status: thread.status === 'archived' ? 'closed' : 'active',
        messageCount: thread.messageCount || 0,
        createdAt: thread.createdAt || new Date(),
        updatedAt: thread.updatedAt || new Date(),
      };

      // Insert conversation
      await conversationsCollection.insertOne(conversation);
      migrated++;

      if (migrated % 100 === 0) {
        console.log(`   Migrated ${migrated} conversations...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate thread ${thread.id}:`, error.message);
      errors.push({ threadId: thread.id, error: error.message });
    }
  }

  console.log(`\n✅ Thread migration complete:`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Migration errors:');
    errors.forEach(e => console.log(`   Thread ${e.threadId}: ${e.error}`));
  }

  return { migrated, skipped, errors };
}

/**
 * Migrate messages to chat_messages
 */
async function migrateMessages(db) {
  console.log('\n📨 Migrating messages to chat_messages...');

  const messagesCollection = db.collection('messages');
  const chatMessagesCollection = db.collection('chat_messages');
  const conversationsCollection = db.collection('conversations');
  const threadsCollection = db.collection('threads');

  // Get all messages
  const messages = await messagesCollection.find({}).toArray();
  console.log(`   Found ${messages.length} messages to migrate`);

  let migrated = 0;
  let skipped = 0;
  const errors = [];

  for (const message of messages) {
    try {
      // Find corresponding conversation by thread ID
      const thread = await threadsCollection.findOne({ id: message.threadId });
      if (!thread) {
        console.log(`   ⚠️  Skipping message ${message.id} - thread not found`);
        skipped++;
        continue;
      }

      const conversation = await conversationsCollection.findOne({ _id: thread._id });
      if (!conversation) {
        console.log(`   ⚠️  Skipping message ${message.id} - conversation not found`);
        skipped++;
        continue;
      }

      // Map message document
      const chatMessage = {
        _id: message._id || new ObjectId(),
        conversationId: conversation._id,
        senderId: message.senderId || message.userId,
        senderName: message.senderName || 'User',
        senderAvatar: message.senderAvatar || message.senderName?.[0]?.toUpperCase() || 'U',
        content: message.message || message.text || '',
        type: message.type || 'text',
        attachments: message.attachments || [],
        reactions: message.reactions || [],
        readBy: message.readBy || [
          {
            userId: message.senderId || message.userId,
            readAt: message.createdAt || new Date(),
          },
        ],
        replyTo: null,
        editHistory: [],
        isEdited: false,
        isDeleted: message.isDeleted || false,
        status: 'sent',
        createdAt: message.createdAt || message.timestamp || new Date(),
        updatedAt: message.updatedAt || message.createdAt || new Date(),
      };

      // Insert chat message
      await chatMessagesCollection.insertOne(chatMessage);
      migrated++;

      if (migrated % 500 === 0) {
        console.log(`   Migrated ${migrated} messages...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate message ${message.id}:`, error.message);
      errors.push({ messageId: message.id, error: error.message });
    }
  }

  console.log(`\n✅ Message migration complete:`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Migration errors:');
    errors.forEach(e => console.log(`   Message ${e.messageId}: ${e.error}`));
  }

  return { migrated, skipped, errors };
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting Messenger v3 migration...');
  console.log('============================================\n');

  let db;
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    db = await mongoDb.getDb();
    console.log('✅ Connected to MongoDB\n');

    // Create indexes
    console.log('🔍 Creating indexes...');
    await initializeIndexes(db);
    console.log('✅ Indexes created\n');

    // Migrate threads
    const threadResult = await migrateThreads(db);

    // Migrate messages
    const messageResult = await migrateMessages(db);

    // Summary
    console.log('\n============================================');
    console.log('✅ Migration complete!');
    console.log('============================================');
    console.log(`Conversations migrated: ${threadResult.migrated}`);
    console.log(`Messages migrated: ${messageResult.migrated}`);
    console.log(`Total errors: ${threadResult.errors.length + messageResult.errors.length}`);
    console.log('\n⚠️  Old collections (threads, messages) have been preserved as backup');
    console.log(
      '   Review new collections (conversations, chat_messages) before removing old data'
    );
    console.log('\nNext steps:');
    console.log('1. Test the new messenger system');
    console.log('2. Verify data integrity');
    console.log('3. Update frontend to use /api/v3/messenger endpoints');
    console.log('4. Once verified, old collections can be archived/removed\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close connection
    if (db) {
      await mongoDb.close();
      console.log('📡 Database connection closed');
    }
  }
}

// Run migration
if (require.main === module) {
  migrate().catch(console.error);
}

module.exports = { migrate, migrateThreads, migrateMessages };
