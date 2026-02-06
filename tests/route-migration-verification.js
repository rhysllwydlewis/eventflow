/**
 * Route Migration Verification Test
 * Validates that all extracted routes are properly structured
 */

const fs = require('fs');
const path = require('path');

const newRouteFiles = [
  'suppliers.js',
  'categories.js',
  'plans-legacy.js',
  'threads.js',
  'marketplace.js',
  'discovery.js',
  'search.js',
  'reviews.js',
  'photos.js',
  'metrics.js',
  'cache.js',
  'misc.js',
];

console.log('🔍 Route Migration Verification Test\n');

let allPassed = true;

// Test 1: Check all route files exist
console.log('Test 1: Checking all route files exist...');
newRouteFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', 'routes', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file} exists`);
  } else {
    console.log(`  ❌ ${file} NOT FOUND`);
    allPassed = false;
  }
});

// Test 2: Check all files export initializeDependencies
console.log('\nTest 2: Checking initializeDependencies export...');
newRouteFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', 'routes', file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('module.exports.initializeDependencies')) {
      console.log(`  ✅ ${file} exports initializeDependencies`);
    } else {
      console.log(`  ❌ ${file} MISSING initializeDependencies export`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`  ❌ ${file} ERROR: ${error.message}`);
    allPassed = false;
  }
});

// Test 3: Check no duplicate /api/ prefixes in routes
console.log('\nTest 3: Checking for duplicate /api/ prefixes...');
newRouteFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', 'routes', file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let foundDuplicate = false;
    
    lines.forEach((line, index) => {
      // Look for router definitions with /api/ prefix
      if (line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"]\/api\//)) {
        console.log(`  ❌ ${file}:${index + 1} has duplicate /api/ prefix: ${line.trim()}`);
        foundDuplicate = true;
        allPassed = false;
      }
    });
    
    if (!foundDuplicate) {
      console.log(`  ✅ ${file} has no duplicate prefixes`);
    }
  } catch (error) {
    console.log(`  ❌ ${file} ERROR: ${error.message}`);
    allPassed = false;
  }
});

// Test 4: Check routes/index.js imports all new files
console.log('\nTest 4: Checking routes/index.js imports...');
const indexPath = path.join(__dirname, '..', 'routes', 'index.js');
const indexContent = fs.readFileSync(indexPath, 'utf8');

const expectedImports = {
  'suppliers': 'suppliersRoutes',
  'categories': 'categoriesRoutes',
  'plans-legacy': 'plansLegacyRoutes',
  'threads': 'threadsRoutes',
  'marketplace': 'marketplaceRoutes',
  'discovery': 'discoveryRoutes',
  'search': 'searchRoutes',
  'reviews': 'reviewsRoutes',
  'photos': 'photosRoutes',
  'metrics': 'metricsRoutes',
  'cache': 'cacheRoutes',
  'misc': 'miscRoutes',
};

Object.entries(expectedImports).forEach(([file, varName]) => {
  const importPattern = new RegExp(`const\\s+${varName}\\s+=\\s+require\\(['"]\\.\/${file}['"]\\)`);
  if (importPattern.test(indexContent)) {
    console.log(`  ✅ ${file} is imported as ${varName}`);
  } else {
    console.log(`  ❌ ${file} NOT imported in index.js`);
    allPassed = false;
  }
});

// Test 5: Check routes are mounted in index.js
console.log('\nTest 5: Checking route mounting in index.js...');
Object.entries(expectedImports).forEach(([file, varName]) => {
  const mountPattern = new RegExp(`app\\.use\\([^)]*${varName}\\)`);
  if (mountPattern.test(indexContent)) {
    console.log(`  ✅ ${varName} is mounted`);
  } else {
    console.log(`  ❌ ${varName} NOT mounted`);
    allPassed = false;
  }
});

// Test 6: Check initialization calls
console.log('\nTest 6: Checking dependency initialization calls...');
Object.entries(expectedImports).forEach(([file, varName]) => {
  const initPattern = new RegExp(`${varName}\\.initializeDependencies`);
  if (initPattern.test(indexContent)) {
    console.log(`  ✅ ${varName}.initializeDependencies is called`);
  } else {
    console.log(`  ❌ ${varName}.initializeDependencies NOT called`);
    allPassed = false;
  }
});

// Summary
console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('✅ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  process.exit(1);
}
