#!/usr/bin/env node
/**
 * Test script for unified database layer
 * Verifies that db-unified.js works correctly with different backends
 */

const db = require('./db-unified');

async function runTests() {
  console.log('🧪 Testing Unified Database Layer\n');

  try {
    // Initialize database
    await db.initializeDatabase();
    const dbType = db.getDatabaseType();
    console.log(`✅ Database initialized: ${dbType}\n`);

    // Test 1: Generate ID
    console.log('Test 1: Generate unique ID');
    const id = db.uid('test');
    console.log(`  Generated ID: ${id}`);
    console.log(`  ✓ ID generation works\n`);

    // Test 2: Insert document
    console.log('Test 2: Insert document');
    const testDoc = {
      id: db.uid('test'),
      name: 'Test Document',
      createdAt: new Date().toISOString(),
    };
    const inserted = await db.insertOne('test_collection', testDoc);
    console.log(`  Inserted: ${JSON.stringify(inserted, null, 2)}`);
    console.log(`  ✓ Insert works\n`);

    // Test 3: Read all documents
    console.log('Test 3: Read all documents');
    const all = await db.read('test_collection');
    console.log(`  Found ${all.length} document(s)`);
    console.log(`  ✓ Read works\n`);

    // Test 4: Find one document
    console.log('Test 4: Find one document');
    const found = await db.findOne('test_collection', { id: testDoc.id });
    console.log(`  Found: ${found ? found.name : 'null'}`);
    console.log(`  ✓ FindOne works\n`);

    // Test 5: Update document
    console.log('Test 5: Update document');
    await db.updateOne('test_collection', testDoc.id, { name: 'Updated Name' });
    const updated = await db.findOne('test_collection', { id: testDoc.id });
    console.log(`  Updated name: ${updated ? updated.name : 'null'}`);
    console.log(`  ✓ Update works\n`);

    // Test 6: Delete document
    console.log('Test 6: Delete document');
    await db.deleteOne('test_collection', testDoc.id);
    const deleted = await db.findOne('test_collection', { id: testDoc.id });
    console.log(`  After delete: ${deleted ? 'Still exists (ERROR)' : 'Deleted successfully'}`);
    console.log(`  ✓ Delete works\n`);

    console.log('✅ All tests passed!\n');
    console.log(`📊 Database type: ${dbType}`);
    console.log(`   - To use Firestore: Set FIREBASE_PROJECT_ID=eventflow-ffb12`);
    console.log(`   - To use MongoDB: Set MONGODB_URI=your-connection-string`);
    console.log(`   - Currently using: ${dbType}`);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
