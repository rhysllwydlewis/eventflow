#!/usr/bin/env node

/**
 * Cleanup Test Data Script
 *
 * Removes test/seeded data from the database based on isTest flag and optionally seedBatch.
 *
 * Usage:
 *   node scripts/cleanup-test-data.js [options]
 *
 * Options:
 *   --dry-run           Show what would be deleted without actually deleting
 *   --batch <id>        Only delete items from specific seed batch
 *   --suppliers         Only delete test suppliers
 *   --packages          Only delete test packages
 *   --reviews           Only delete test reviews
 *   --all               Delete all test data (default)
 *   --force             Skip confirmation prompt
 *
 * Examples:
 *   node scripts/cleanup-test-data.js --dry-run
 *   node scripts/cleanup-test-data.js --batch seed_1234567890
 *   node scripts/cleanup-test-data.js --suppliers --force
 */

'use strict';

const dbUnified = require('../db-unified');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  batch: null,
  suppliers: args.includes('--suppliers'),
  packages: args.includes('--packages'),
  reviews: args.includes('--reviews'),
  all: args.includes('--all'),
  force: args.includes('--force'),
};

// Extract batch ID if provided
const batchIndex = args.indexOf('--batch');
if (batchIndex !== -1 && args[batchIndex + 1]) {
  options.batch = args[batchIndex + 1];
}

// Default to all if no specific collection specified
if (!options.suppliers && !options.packages && !options.reviews) {
  options.all = true;
}

/**
 * Get confirmation from user
 */
function getConfirmation(message) {
  return new Promise(resolve => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Clean test data from a collection
 *
 * Note: For large datasets (>10,000 items), this approach of reading entire
 * collections into memory may be inefficient. Consider implementing database-level
 * filtering using MongoDB queries if performance becomes an issue.
 */
async function cleanCollection(collectionName) {
  try {
    const items = await dbUnified.read(collectionName);

    // Filter items to delete based on isTest flag and optional batch
    let itemsToDelete = items.filter(item => item.isTest === true);

    if (options.batch) {
      itemsToDelete = itemsToDelete.filter(item => item.seedBatch === options.batch);
    }

    if (itemsToDelete.length === 0) {
      console.log(`  ✓ No test data found in ${collectionName}`);
      return { collection: collectionName, count: 0 };
    }

    console.log(`  Found ${itemsToDelete.length} test item(s) in ${collectionName}`);

    if (options.dryRun) {
      console.log(`  [DRY RUN] Would delete ${itemsToDelete.length} item(s)`);
      itemsToDelete.forEach(item => {
        console.log(
          `    - ${item.id || item.name || 'Unknown'} ${item.seedBatch ? `(batch: ${item.seedBatch})` : ''}`
        );
      });
      return { collection: collectionName, count: itemsToDelete.length, dryRun: true };
    }

    // Delete items by keeping only non-test items
    const itemsToKeep = items.filter(item => !itemsToDelete.includes(item));
    await dbUnified.write(collectionName, itemsToKeep);

    console.log(`  ✓ Deleted ${itemsToDelete.length} test item(s) from ${collectionName}`);
    return { collection: collectionName, count: itemsToDelete.length };
  } catch (error) {
    console.error(`  ✗ Error cleaning ${collectionName}:`, error.message);
    return { collection: collectionName, count: 0, error: error.message };
  }
}

/**
 * Main cleanup function
 */
async function cleanup() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('   EventFlow Test Data Cleanup Script');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Show configuration
  console.log('Configuration:');
  console.log(`  Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log(`  Batch filter: ${options.batch || 'NONE (all batches)'}`);
  console.log(
    `  Collections: ${options.all ? 'ALL' : [options.suppliers && 'suppliers', options.packages && 'packages', options.reviews && 'reviews'].filter(Boolean).join(', ')}`
  );
  console.log('');

  try {
    // Initialize database
    await dbUnified.initializeDatabase();
    const dbType = dbUnified.getDatabaseType();
    console.log(`Database type: ${dbType}`);
    console.log('');

    // Determine which collections to clean
    const collectionsToClean = [];
    if (options.all || options.suppliers) {
      collectionsToClean.push('suppliers');
    }
    if (options.all || options.packages) {
      collectionsToClean.push('packages');
    }
    if (options.all || options.reviews) {
      collectionsToClean.push('reviews');
    }

    if (collectionsToClean.length === 0) {
      console.log('No collections specified for cleanup.');
      console.log('');
      return;
    }

    // Get confirmation unless force flag is set
    if (!options.dryRun && !options.force) {
      console.log('⚠️  WARNING: This will permanently delete test data from the database.');
      console.log('');
      const confirmed = await getConfirmation('Do you want to continue?');
      if (!confirmed) {
        console.log('Cleanup cancelled.');
        console.log('');
        return;
      }
      console.log('');
    }

    console.log('Processing...');
    console.log('');

    // Clean each collection
    const results = [];
    for (const collection of collectionsToClean) {
      const result = await cleanCollection(collection);
      results.push(result);
    }

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('   Cleanup Summary');
    console.log('═══════════════════════════════════════════');
    console.log('');

    const totalDeleted = results.reduce((sum, r) => sum + r.count, 0);
    const totalErrors = results.filter(r => r.error).length;

    results.forEach(result => {
      const status = result.error ? '✗' : '✓';
      const action = result.dryRun ? 'Would delete' : 'Deleted';
      console.log(`  ${status} ${result.collection}: ${action} ${result.count} item(s)`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log('');
    console.log(`Total: ${options.dryRun ? 'Would delete' : 'Deleted'} ${totalDeleted} item(s)`);
    if (totalErrors > 0) {
      console.log(`Errors: ${totalErrors} collection(s) had errors`);
    }
    console.log('');

    if (options.dryRun) {
      console.log('ℹ️  This was a dry run. No data was actually deleted.');
      console.log('   Run without --dry-run to perform actual deletion.');
      console.log('');
    }
  } catch (error) {
    console.error('');
    console.error('✗ Fatal error:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log('');
  console.log('EventFlow Test Data Cleanup Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/cleanup-test-data.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run           Show what would be deleted without actually deleting');
  console.log('  --batch <id>        Only delete items from specific seed batch');
  console.log('  --suppliers         Only delete test suppliers');
  console.log('  --packages          Only delete test packages');
  console.log('  --reviews           Only delete test reviews');
  console.log('  --all               Delete all test data (default)');
  console.log('  --force             Skip confirmation prompt');
  console.log('  --help, -h          Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/cleanup-test-data.js --dry-run');
  console.log('  node scripts/cleanup-test-data.js --batch seed_1234567890');
  console.log('  node scripts/cleanup-test-data.js --suppliers --force');
  console.log('');
  process.exit(0);
}

// Run cleanup
cleanup()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
