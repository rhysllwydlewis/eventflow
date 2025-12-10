# Data Migration to Firebase

This guide explains how to migrate existing EventFlow data from local JSON files to Firebase Firestore.

## Prerequisites

1. **Firebase Project Setup**
   - Firebase project created in Firebase Console
   - Firestore Database enabled
   - Service account credentials downloaded

2. **Environment Configuration**
   - Set `FIREBASE_PROJECT_ID` or `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable
   - See `.env.example` for details

## Quick Start

### Option 1: Using Project ID (Development)

```bash
# Set Firebase Project ID
export FIREBASE_PROJECT_ID=eventflow-ffb12

# Run migration in dry-run mode (preview only)
node migrate-to-firebase.js --dry-run

# Run actual migration
node migrate-to-firebase.js
```

### Option 2: Using Service Account (Production)

```bash
# Download service account JSON from Firebase Console
# Project Settings > Service Accounts > Generate New Private Key

# Set as environment variable
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"eventflow-ffb12",...}'

# Run migration
node migrate-to-firebase.js
```

## Migration Options

### Dry Run Mode
Preview what will be migrated without actually migrating:

```bash
node migrate-to-firebase.js --dry-run
```

### Migrate Specific Collection
Migrate only one collection at a time:

```bash
# Migrate only packages
node migrate-to-firebase.js --collection=packages

# Migrate only suppliers
node migrate-to-firebase.js --collection=suppliers

# Migrate only users
node migrate-to-firebase.js --collection=users
```

### Force Overwrite
Overwrite existing documents in Firebase:

```bash
node migrate-to-firebase.js --force
```

### Combine Options
```bash
# Dry run for packages only
node migrate-to-firebase.js --dry-run --collection=packages

# Force overwrite suppliers
node migrate-to-firebase.js --force --collection=suppliers
```

## What Gets Migrated

The script migrates data from these local JSON files to Firebase:

| Collection | Local File | Firebase Collection |
|------------|------------|---------------------|
| Packages | `data/packages.json` | `packages` |
| Suppliers | `data/suppliers.json` | `suppliers` |
| Users | `data/users.json` | `users` |

## Data Transformation

The migration script:
- ✅ Preserves all existing fields
- ✅ Converts date strings to ISO format
- ✅ Maintains document IDs
- ✅ Skips items without IDs
- ✅ Skips existing documents (unless `--force` used)

## Output Example

```
🔥 EventFlow Data Migration to Firebase

Options: { dryRun: false, force: false, collection: 'all' }

🔧 Initializing Firebase Admin SDK...
✅ Firebase Admin SDK initialized

📦 Migrating packages...
   Found 15 items in data/packages.json
   ✅ Migrated pkg_001
   ✅ Migrated pkg_002
   ⏭️  Skipping pkg_003 (already exists)
   ...

📦 Migrating suppliers...
   Found 8 items in data/suppliers.json
   ✅ Migrated sup_001
   ...

📦 Migrating users...
   ℹ️  No data to migrate from data/users.json

============================================================
📊 Migration Summary
============================================================

packages:
  ✅ Migrated: 12
  ⏭️  Skipped:  3
  ❌ Errors:   0

suppliers:
  ✅ Migrated: 8
  ⏭️  Skipped:  0
  ❌ Errors:   0

users:
  ✅ Migrated: 0
  ⏭️  Skipped:  0
  ❌ Errors:   0

============================================================
Total: 20 migrated, 3 skipped, 0 errors
============================================================

✨ Migration completed successfully!
```

## Troubleshooting

### "Firebase Admin SDK not available"
**Problem**: Environment variables not set

**Solution**:
```bash
# Set Firebase Project ID
export FIREBASE_PROJECT_ID=eventflow-ffb12

# OR set service account key
export FIREBASE_SERVICE_ACCOUNT_KEY='...'
```

### "Skipping item without ID"
**Problem**: Data item missing `id` field

**Solution**: Check your JSON files and ensure all items have an `id` field

### "Error migrating: Permission denied"
**Problem**: Firestore security rules blocking write

**Solution**: 
1. Check Firestore rules allow admin access
2. Verify service account has proper permissions
3. Temporarily relax rules for migration if needed

### "File not found"
**Problem**: JSON file doesn't exist

**Solution**: Check that `data/` directory and JSON files exist

## Post-Migration Steps

1. **Verify Data in Firebase Console**
   - Open Firebase Console
   - Go to Firestore Database
   - Check that collections contain migrated data

2. **Test Application**
   - Test package listings
   - Test supplier profiles
   - Verify all features work with Firebase data

3. **Update Backend** (Optional)
   - Modify `server.js` to read from Firebase instead of local files
   - Remove dependency on local JSON files

4. **Backup Local Data**
   - Keep backups of `data/*.json` files
   - Don't delete until Firebase integration is fully tested

## Safety Features

The migration script includes safety features:

- ✅ **Dry Run Mode**: Preview changes without modifying data
- ✅ **Skip Existing**: Won't overwrite unless `--force` used
- ✅ **Error Handling**: Continues on errors, reports at end
- ✅ **Validation**: Checks for IDs and required fields
- ✅ **Fallback**: Works with or without Firebase (graceful degradation)

## Best Practices

1. **Always test with --dry-run first**
2. **Migrate one collection at a time initially**
3. **Verify data in Firebase Console after migration**
4. **Keep backups of local JSON files**
5. **Test application thoroughly after migration**
6. **Monitor Firestore quotas and usage**

## Advanced Usage

### Using with npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "migrate": "node migrate-to-firebase.js",
    "migrate:dry-run": "node migrate-to-firebase.js --dry-run",
    "migrate:packages": "node migrate-to-firebase.js --collection=packages",
    "migrate:suppliers": "node migrate-to-firebase.js --collection=suppliers"
  }
}
```

Then run:
```bash
npm run migrate:dry-run
npm run migrate
```

### Automated CI/CD Migration

```bash
#!/bin/bash
# Set credentials from secrets
export FIREBASE_SERVICE_ACCOUNT_KEY="$FIREBASE_CREDENTIALS"

# Run migration
node migrate-to-firebase.js --force

# Check exit code
if [ $? -eq 0 ]; then
  echo "Migration successful"
else
  echo "Migration failed"
  exit 1
fi
```

## Support

For issues or questions:
1. Check this README
2. Review `FIREBASE_GUIDE.md`
3. Check Firebase Console for errors
4. Review migration script output for specific errors
