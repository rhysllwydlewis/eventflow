# EventFlow Migration Guide

## Overview

This guide explains how to migrate EventFlow from JSON file storage to MongoDB database. The migration is designed to be safe, reversible, and preserves all your existing data.

## Prerequisites

Before starting the migration:

- ✅ Node.js 16+ installed
- ✅ All dependencies installed (`npm install`)
- ✅ MongoDB connection configured (see [MONGODB_SETUP.md](./MONGODB_SETUP.md))
- ✅ Backup of your existing data (see below)

## Pre-Migration Checklist

### 1. Backup Your Data

**CRITICAL**: Always backup your data before migration!

```bash
# Create a backup directory
mkdir -p backups/$(date +%Y%m%d_%H%M%S)

# Copy all JSON data files
cp -r data/*.json backups/$(date +%Y%m%d_%H%M%S)/

# Verify backup
ls -la backups/$(date +%Y%m%d_%H%M%S)/
```

### 2. Test MongoDB Connection

Ensure your MongoDB connection is working:

```bash
# The server should connect successfully
npm start
```

Look for this message in the logs:
```
Connected to MongoDB database: eventflow
MongoDB connection verified
```

If you see connection errors, review [MONGODB_SETUP.md](./MONGODB_SETUP.md) first.

### 3. Stop the Server

If the server is running, stop it before migration:

```bash
# Press Ctrl+C in the terminal running the server
```

## Migration Process

### Step 1: Run the Migration Script

The migration script (`migrate-to-mongodb.js`) will:
- Read all data from JSON files
- Validate the data
- Insert it into MongoDB collections
- Preserve all relationships

```bash
npm run migrate
```

### Step 2: Verify Migration

The script will output a summary:

```
=== Migration Summary ===
Users: 25 migrated
Suppliers: 12 migrated
Packages: 34 migrated
Plans: 8 migrated
Notes: 15 migrated
Messages: 67 migrated
Threads: 14 migrated
Events: 3 migrated

✅ Migration completed successfully!
```

### Step 3: Check Data Integrity

Start the server and verify your data:

```bash
npm start
```

Then visit these pages to verify:
- `/admin.html` - Check user, supplier, and package counts
- `/suppliers.html` - Verify suppliers are listed
- `/plan.html` - Check your saved plans
- `/dashboard-customer.html` or `/dashboard-supplier.html` - Verify your account

### Step 4: Test Critical Functions

Test these key features:
- ✅ Log in with existing account
- ✅ View supplier profiles
- ✅ View packages
- ✅ Check messages
- ✅ View your plan/notes
- ✅ Search for suppliers

## Rollback Procedure

If you need to rollback to JSON storage:

### Option 1: Quick Rollback (Restore from Backup)

```bash
# Stop the server
# Restore JSON files from backup
cp backups/YYYYMMDD_HHMMSS/*.json data/

# Restart server
npm start
```

### Option 2: Export from MongoDB

If you made changes in MongoDB that you want to keep:

```bash
# Export from MongoDB (create a script if needed)
node -e "
const { connect } = require('./db');
const fs = require('fs');

(async () => {
  const db = await connect();
  const collections = ['users', 'suppliers', 'packages', 'plans', 'notes', 'messages', 'threads', 'events'];
  
  for (const name of collections) {
    const data = await db.collection(name).find({}).toArray();
    fs.writeFileSync(\`data/\${name}.json\`, JSON.stringify(data, null, 2));
    console.log(\`Exported \${name}: \${data.length} documents\`);
  }
  
  process.exit(0);
})();
"
```

## Troubleshooting

### Issue: "Connection refused" or "ECONNREFUSED"

**Cause**: MongoDB is not running or connection string is incorrect.

**Solution**:
1. Check MongoDB is running: `mongosh` (for local) or check MongoDB Atlas dashboard
2. Verify connection string in `.env`
3. Check network/firewall settings

### Issue: "Duplicate key error"

**Cause**: Data already exists in MongoDB from previous migration attempt.

**Solution**:
```bash
# Clear MongoDB collections and retry
node -e "
const { connect } = require('./db');
(async () => {
  const db = await connect();
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).deleteMany({});
    console.log('Cleared:', col.name);
  }
  process.exit(0);
})();
"

# Run migration again
npm run migrate
```

### Issue: "Invalid document" or "Validation error"

**Cause**: Data doesn't match MongoDB schema requirements.

**Solution**:
1. Check which document failed (error message will show details)
2. Fix the data in your JSON file
3. Run migration again

### Issue: Missing data after migration

**Cause**: Some records may not have migrated due to validation errors.

**Solution**:
1. Check migration logs for errors
2. Review the specific JSON file with issues
3. Fix data and re-run migration (the script is idempotent)

## Post-Migration Recommendations

### 1. Monitor Performance

Watch for these metrics in the first few days:
- Response times for API calls
- Database connection pool usage
- Error logs

### 2. Set Up Regular Backups

MongoDB Atlas provides automatic backups. For local MongoDB:

```bash
# Add to crontab (daily backup at 2 AM)
0 2 * * * mongodump --db eventflow --out /backups/mongodb/$(date +\%Y\%m\%d)
```

### 3. Enable Compression (Production)

Update your MongoDB connection string:
```
mongodb+srv://user:pass@cluster.net/eventflow?retryWrites=true&w=majority&compressors=zlib
```

### 4. Add Monitoring

Consider adding:
- MongoDB Atlas monitoring (free tier includes this)
- Application Performance Monitoring (APM) tools
- Error tracking (e.g., Sentry)

## Migration Script Details

The migration script (`migrate-to-mongodb.js`) performs these operations:

1. **Reads JSON files** from `data/*.json`
2. **Validates data** against MongoDB schemas
3. **Creates indexes** for optimal performance
4. **Inserts data** into MongoDB collections
5. **Verifies** migration success
6. **Reports** summary statistics

The script is **idempotent** - you can run it multiple times safely. It will:
- Skip records that already exist (based on `id` field)
- Update records if data has changed
- Add new records

## Data Validation

The migration validates:
- Required fields (id, email for users, etc.)
- Data types (strings, numbers, booleans, dates)
- Email format
- URL format
- Relationship integrity (supplier → packages)

## Schema Information

See `models/index.js` for detailed schema definitions for:
- Users
- Suppliers
- Packages
- Plans
- Notes
- Messages
- Threads
- Events

## Additional Resources

- [MongoDB Setup Guide](./MONGODB_SETUP.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Security Guide](./SECURITY.md)

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review migration logs for specific error messages
3. Verify MongoDB connection with `mongosh` or MongoDB Atlas dashboard
4. Check that all environment variables are set correctly
5. Create an issue on GitHub with:
   - Error messages
   - Migration output
   - MongoDB version
   - Node.js version

## Success Criteria

Your migration is successful when:

✅ All JSON records are in MongoDB
✅ The server starts without errors
✅ You can log in with existing credentials
✅ All suppliers, packages, and plans are visible
✅ Messages and threads are accessible
✅ Search functionality works
✅ No data is missing or corrupted

---

**Need help?** Refer to [MONGODB_SETUP.md](./MONGODB_SETUP.md) for MongoDB configuration or [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production deployment.
