/**
 * Database Migration Script
 * Adds new collections and indexes for messaging system features
 * 
 * Run with: node scripts/migrate-messaging-features.js
 */

'use strict';

require('dotenv').config();
const { MongoClient } = require('mongodb');

// Import models
const Message = require('../models/Message');
const MessageQueue = require('../models/MessageQueue');
const BlockedUser = require('../models/BlockedUser');
const ReportedMessage = require('../models/ReportedMessage');
const Mention = require('../models/Mention');
const LinkPreview = require('../models/LinkPreview');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_LOCAL_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'eventflow';

  if (!uri) {
    console.error('❌ MONGODB_URI or MONGODB_LOCAL_URI is required');
    process.exit(1);
  }

  console.log('🚀 Starting messaging system migration...\n');

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);

    // 1. Update Message indexes (including text search)
    console.log('\n📝 Creating Message indexes...');
    await Message.createIndexes(db);

    // 2. Create MessageQueue collection and indexes
    console.log('\n📝 Creating MessageQueue collection and indexes...');
    const queueExists = await db.listCollections({ name: MessageQueue.COLLECTION }).hasNext();
    if (!queueExists) {
      await db.createCollection(MessageQueue.COLLECTION);
      console.log(`✅ Created ${MessageQueue.COLLECTION} collection`);
    } else {
      console.log(`ℹ️  ${MessageQueue.COLLECTION} collection already exists`);
    }
    await MessageQueue.createIndexes(db);

    // 3. Create BlockedUser collection and indexes
    console.log('\n📝 Creating BlockedUser collection and indexes...');
    const blockedExists = await db.listCollections({ name: BlockedUser.COLLECTION }).hasNext();
    if (!blockedExists) {
      await db.createCollection(BlockedUser.COLLECTION);
      console.log(`✅ Created ${BlockedUser.COLLECTION} collection`);
    } else {
      console.log(`ℹ️  ${BlockedUser.COLLECTION} collection already exists`);
    }
    await BlockedUser.createIndexes(db);

    // 4. Create ReportedMessage collection and indexes
    console.log('\n📝 Creating ReportedMessage collection and indexes...');
    const reportsExists = await db
      .listCollections({ name: ReportedMessage.COLLECTION })
      .hasNext();
    if (!reportsExists) {
      await db.createCollection(ReportedMessage.COLLECTION);
      console.log(`✅ Created ${ReportedMessage.COLLECTION} collection`);
    } else {
      console.log(`ℹ️  ${ReportedMessage.COLLECTION} collection already exists`);
    }
    await ReportedMessage.createIndexes(db);

    // 5. Create Mention collection and indexes
    console.log('\n📝 Creating Mention collection and indexes...');
    const mentionsExists = await db.listCollections({ name: Mention.COLLECTION }).hasNext();
    if (!mentionsExists) {
      await db.createCollection(Mention.COLLECTION);
      console.log(`✅ Created ${Mention.COLLECTION} collection`);
    } else {
      console.log(`ℹ️  ${Mention.COLLECTION} collection already exists`);
    }
    await Mention.createIndexes(db);

    // 6. Create LinkPreview collection and indexes
    console.log('\n📝 Creating LinkPreview collection and indexes...');
    const previewsExists = await db.listCollections({ name: LinkPreview.COLLECTION }).hasNext();
    if (!previewsExists) {
      await db.createCollection(LinkPreview.COLLECTION);
      console.log(`✅ Created ${LinkPreview.COLLECTION} collection`);
    } else {
      console.log(`ℹ️  ${LinkPreview.COLLECTION} collection already exists`);
    }
    await LinkPreview.createIndexes(db);

    // 7. Add new fields to existing threads (pinnedAt, mutedUntil)
    console.log('\n📝 Updating existing threads with new fields...');
    const threadsCollection = db.collection('threads');
    const updateResult = await threadsCollection.updateMany(
      { pinnedAt: { $exists: false } },
      {
        $set: {
          pinnedAt: {},
          mutedUntil: {},
        },
      }
    );
    console.log(`✅ Updated ${updateResult.modifiedCount} threads`);

    // 8. Add new fields to existing messages (editedAt, editHistory)
    console.log('\n📝 Updating existing messages with new fields...');
    const messagesCollection = db.collection('messages');
    const msgUpdateResult = await messagesCollection.updateMany(
      { editedAt: { $exists: false } },
      {
        $set: {
          editedAt: null,
          editHistory: [],
        },
      }
    );
    console.log(`✅ Updated ${msgUpdateResult.modifiedCount} messages`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Message indexes updated (including text search)');
    console.log(`  - ${MessageQueue.COLLECTION} collection ready`);
    console.log(`  - ${BlockedUser.COLLECTION} collection ready`);
    console.log(`  - ${ReportedMessage.COLLECTION} collection ready`);
    console.log(`  - ${Mention.COLLECTION} collection ready`);
    console.log(`  - ${LinkPreview.COLLECTION} collection ready`);
    console.log('  - Threads updated with pinning/muting fields');
    console.log('  - Messages updated with edit history fields');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrate().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = migrate;
