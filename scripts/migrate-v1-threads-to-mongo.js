#!/usr/bin/env node
/**
 * Migration Script: Migrate v1 Threads and Messages to MongoDB
 *
 * This script migrates existing threads and messages from the JSON/dbUnified store to MongoDB.
 * - Reads all threads from dbUnified.read('threads')
 * - Synthesizes participants array for v2 compatibility
 * - Writes threads to MongoDB using upsert for idempotency
 * - Migrates all messages with v2 field aliases
 *
 * Safe to run multiple times (idempotent).
 * Usage: node scripts/migrate-v1-threads-to-mongo.js
 */

'use strict';

require('dotenv').config();

const db = require('../db');
const store = require('../store');

async function migrateThreadsAndMessages() {
  console.log('🔄 Starting migration of v1 threads and messages to MongoDB...\n');

  let mongoClient = null;
  let mongodb = null;

  try {
    // Connect to MongoDB
    if (!db.isMongoAvailable()) {
      console.error('❌ MongoDB is not configured. Set MONGODB_URI environment variable.');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    mongoClient = await db.connect();
    mongodb = mongoClient;
    console.log('✅ Connected to MongoDB\n');

    // Read all threads from dbUnified (JSON store)
    console.log('📖 Reading threads from local storage...');
    const threads = store.read('threads') || [];
    console.log(`   Found ${threads.length} threads in local storage\n`);

    // Migrate threads
    const threadsCollection = mongodb.collection('threads');
    let threadsInserted = 0;
    let threadsSkipped = 0;

    console.log('🔄 Migrating threads to MongoDB...');
    for (const thread of threads) {
      if (!thread.id) {
        console.warn(`   ⚠️  Skipping thread without ID:`, thread);
        threadsSkipped++;
        continue;
      }

      // Synthesize participants array if not present
      // Use customerId and recipientId (NOT supplierId - that's a supplier DB ID, not a user ID)
      const participants = [];
      if (thread.customerId) {
        participants.push(thread.customerId);
      }
      if (thread.recipientId && !participants.includes(thread.recipientId)) {
        participants.push(thread.recipientId);
      }
      // Filter out any null/undefined values
      const cleanParticipants = participants.filter(Boolean);

      // Prepare thread document with participants and defaults
      const threadDoc = {
        ...thread,
        participants: cleanParticipants,
        status: thread.status || 'open',
      };

      // Use updateOne with upsert and $setOnInsert for idempotency
      // This ensures we don't overwrite existing data if thread already exists in MongoDB
      const result = await threadsCollection.updateOne(
        { id: thread.id },
        {
          $setOnInsert: threadDoc,
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        threadsInserted++;
      } else if (result.matchedCount > 0) {
        threadsSkipped++;
      }
    }

    console.log(`✅ Threads migration complete:`);
    console.log(`   - Inserted: ${threadsInserted}`);
    console.log(`   - Already existed: ${threadsSkipped}`);
    console.log();

    // Read all messages from dbUnified (JSON store)
    console.log('📖 Reading messages from local storage...');
    const messages = store.read('messages') || [];
    console.log(`   Found ${messages.length} messages in local storage\n`);

    // Migrate messages
    const messagesCollection = mongodb.collection('messages');
    let messagesInserted = 0;
    let messagesSkipped = 0;

    console.log('🔄 Migrating messages to MongoDB...');
    for (const message of messages) {
      if (!message.id) {
        console.warn(`   ⚠️  Skipping message without ID:`, message);
        messagesSkipped++;
        continue;
      }

      // Transform message with v2 field aliases
      const messageDoc = {
        ...message,
        // v2 field aliases (but keep v1 fields for backward compatibility)
        senderId: message.senderId || message.fromUserId,
        content: message.content || message.text,
        sentAt: message.sentAt || message.createdAt,
        // v2 defaults
        readBy: message.readBy || [],
        status: message.status || 'sent',
      };

      // Use updateOne with upsert and $setOnInsert for idempotency
      const result = await messagesCollection.updateOne(
        { id: message.id },
        {
          $setOnInsert: messageDoc,
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        messagesInserted++;
      } else if (result.matchedCount > 0) {
        messagesSkipped++;
      }
    }

    console.log(`✅ Messages migration complete:`);
    console.log(`   - Inserted: ${messagesInserted}`);
    console.log(`   - Already existed: ${messagesSkipped}`);
    console.log();

    // Summary
    console.log('🎉 Migration completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Threads: ${threadsInserted} inserted, ${threadsSkipped} already existed`);
    console.log(`   Messages: ${messagesInserted} inserted, ${messagesSkipped} already existed`);
    console.log();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from MongoDB
    if (mongoClient) {
      try {
        await db.disconnect();
        console.log('✅ Disconnected from MongoDB');
      } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
      }
    }
  }
}

// Run migration
migrateThreadsAndMessages()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
