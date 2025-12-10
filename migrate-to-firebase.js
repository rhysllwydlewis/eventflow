#!/usr/bin/env node
require('dotenv').config();
/**
 * Data Migration Script for EventFlow
 * Migrates existing data from local JSON files to Firebase Firestore
 * 
 * Usage:
 *   node migrate-to-firebase.js [options]
 * 
 * Options:
 *   --dry-run          Show what would be migrated without actually migrating
 *   --collection=name  Migrate only specific collection (packages, suppliers, etc.)
 *   --force           Overwrite existing documents in Firebase
 */

const fs = require('fs');
const path = require('path');
const { initializeFirebaseAdmin, isFirebaseAvailable, setDocument, getDocument } = require('./firebase-admin');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  collection: args.find(arg => arg.startsWith('--collection='))?.split('=')[1] || null
};

// Collections to migrate (ordered by dependency: users first, then content)
const COLLECTIONS_TO_MIGRATE = [
  { name: 'users', file: 'data/users.json' },           // Base: user accounts
  { name: 'suppliers', file: 'data/suppliers.json' },   // Reference users
  { name: 'packages', file: 'data/packages.json' },     // Reference suppliers
  { name: 'messages', file: 'data/messages.json' },     // Reference users
  { name: 'threads', file: 'data/threads.json' },       // Conversation threads
  { name: 'plans', file: 'data/plans.json' },           // User plans
  { name: 'notes', file: 'data/notes.json' },           // User notes
  { name: 'events', file: 'data/events.json' },         // Event data
  { name: 'reviews', file: 'data/reviews.json' },       // User reviews
  { name: 'audit_logs', file: 'data/audit_logs.json' }  // System logs
];

/**
 * Read JSON file
 */
function readJsonFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return [];
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(content);
    
    // Handle both array and object formats
    if (Array.isArray(data)) {
      return data;
    } else if (typeof data === 'object') {
      return Object.values(data);
    }
    return [];
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Migrate a single collection
 */
async function migrateCollection(collectionName, filePath) {
  console.log(`\n📦 Migrating ${collectionName}...`);
  
  // Read local data
  const localData = readJsonFile(filePath);
  
  if (localData.length === 0) {
    console.log(`   ℹ️  No data to migrate from ${filePath}`);
    return { migrated: 0, skipped: 0, errors: 0 };
  }
  
  console.log(`   Found ${localData.length} items in ${filePath}`);
  
  if (options.dryRun) {
    console.log(`   🔍 DRY RUN - Would migrate ${localData.length} items`);
    localData.slice(0, 3).forEach(item => {
      console.log(`      - ${item.id || 'no-id'}: ${item.name || item.title || item.email || 'unnamed'}`);
    });
    if (localData.length > 3) {
      console.log(`      ... and ${localData.length - 3} more`);
    }
    return { migrated: localData.length, skipped: 0, errors: 0 };
  }
  
  // Migrate each item
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const item of localData) {
    // Accept multiple ID field formats from different collections
    const docId = item.id || 
                  item.uid || 
                  item.userId || 
                  item.supplierId || 
                  item.packageId || 
                  item.planId || 
                  item.eventId || 
                  item.messageId || 
                  item.reviewId || 
                  item.logId;
    
    if (!docId) {
      console.log(`   ⚠️  Skipping item without ID. Available fields: ${Object.keys(item).join(', ')}`);
      console.log(`   📄 Item data: ${JSON.stringify(item).substring(0, 200)}...`);
      skipped++;
      continue;
    }
    
    try {
      // Check if document already exists
      if (!options.force) {
        const existing = await getDocument(collectionName, docId);
        if (existing) {
          console.log(`   ⏭️  Skipping ${docId} (already exists, use --force to overwrite)`);
          skipped++;
          continue;
        }
      }
      
      // Prepare data for Firebase
      const firestoreData = { ...item };
      
      // Convert date strings to proper Firestore timestamps
      if (firestoreData.createdAt) {
        if (typeof firestoreData.createdAt === 'string') {
          firestoreData.createdAt = new Date(firestoreData.createdAt);
        }
      }
      if (firestoreData.updatedAt) {
        if (typeof firestoreData.updatedAt === 'string') {
          firestoreData.updatedAt = new Date(firestoreData.updatedAt);
        }
      }
      
      // Migrate to Firebase
      await setDocument(collectionName, docId, firestoreData);
      console.log(`   ✅ Migrated ${docId}`);
      migrated++;
      
    } catch (error) {
      console.error(`   ❌ Error migrating ${docId}:`, error.message);
      console.error(`   📄 Error code: ${error.code || 'UNKNOWN'}`);
      console.error(`   📄 Item keys: ${Object.keys(item).join(', ')}`);
      errors++;
    }
  }
  
  return { migrated, skipped, errors };
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🔥 EventFlow Data Migration to Firebase\n');
  console.log('Options:', {
    dryRun: options.dryRun,
    force: options.force,
    collection: options.collection || 'all'
  });
  
  // Initialize Firebase Admin
  console.log('\n🔧 Initializing Firebase Admin SDK...');
  initializeFirebaseAdmin();
  
  if (!isFirebaseAvailable()) {
    console.error('\n❌ Firebase Admin SDK not available!');
    console.error('Please set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    console.error('\nExample:');
    console.error('  export FIREBASE_PROJECT_ID=eventflow-ffb12');
    console.error('  export FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'');
    process.exit(1);
  }
  
  console.log('✅ Firebase Admin SDK initialized');
  
  // Determine which collections to migrate
  let collectionsToMigrate = COLLECTIONS_TO_MIGRATE;
  if (options.collection) {
    collectionsToMigrate = COLLECTIONS_TO_MIGRATE.filter(c => c.name === options.collection);
    if (collectionsToMigrate.length === 0) {
      console.error(`\n❌ Unknown collection: ${options.collection}`);
      console.error(`Available collections: ${COLLECTIONS_TO_MIGRATE.map(c => c.name).join(', ')}`);
      process.exit(1);
    }
  }
  
  // Migrate collections
  const results = {};
  for (const { name, file } of collectionsToMigrate) {
    results[name] = await migrateCollection(name, file);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const [name, stats] of Object.entries(results)) {
    console.log(`\n${name}:`);
    console.log(`  ✅ Migrated: ${stats.migrated}`);
    console.log(`  ⏭️  Skipped:  ${stats.skipped}`);
    console.log(`  ❌ Errors:   ${stats.errors}`);
    
    totalMigrated += stats.migrated;
    totalSkipped += stats.skipped;
    totalErrors += stats.errors;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log('='.repeat(60));
  
  if (options.dryRun) {
    console.log('\n🔍 This was a DRY RUN. Run without --dry-run to actually migrate data.');
  } else if (totalErrors === 0 && totalMigrated > 0) {
    console.log('\n✨ Migration completed successfully!');
  } else if (totalErrors > 0) {
    console.log('\n⚠️  Migration completed with errors. Please review the log above.');
  }
}

// Run migration
if (require.main === module) {
  migrate().catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrate };
