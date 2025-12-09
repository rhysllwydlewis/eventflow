#!/usr/bin/env node
/**
 * Data Migration Script
 * Migrates data from JSON files (store.js) to MongoDB
 * Usage: node migrate-to-mongodb.js
 */

'use strict';

require('dotenv').config();
const store = require('./store');
const db = require('./db');
const dbUtils = require('./db-utils');
const { initializeCollections } = require('./models');

async function migrate() {
  console.log('=== EventFlow Data Migration: JSON to MongoDB ===\n');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    const database = await db.connect();
    console.log('✓ Connected to MongoDB\n');

    // Initialize collections with schemas
    console.log('Initializing collections and indexes...');
    await initializeCollections(database);
    console.log('✓ Collections initialized\n');

    // Run migration
    console.log('Starting data migration...');
    const results = await dbUtils.migrateFromJson(store);

    // Display results
    console.log('\n=== Migration Results ===');
    console.log('Successful migrations:');
    results.success.forEach(collection => {
      console.log(`  ✓ ${collection}: ${results.counts[collection]} documents`);
    });

    if (results.failed.length > 0) {
      console.log('\nFailed migrations:');
      results.failed.forEach(collection => {
        console.log(`  ✗ ${collection}`);
      });
    }

    const totalDocs = Object.values(results.counts).reduce((sum, count) => sum + count, 0);
    console.log(`\nTotal documents migrated: ${totalDocs}`);

    // Close connection
    await db.close();
    console.log('\n✓ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error.stack);
    await db.close();
    process.exit(1);
  }
}

// Run migration
migrate();
