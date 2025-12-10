# Firebase Migration - Step-by-Step Guide

## Prerequisites ✅
- [x] Firebase project created (eventflow-ffb12)
- [x] Migration script ready (`migrate-to-firebase.js`)
- [x] Data access layer created (`data-access.js`)
- [ ] Firebase credentials configured in `.env`
- [ ] Firebase Admin SDK service account key (optional for testing)

---

## Step 1: Configure Firebase Credentials

### Option A: Quick Test (Project ID Only)
Add to `.env`:
```bash
FIREBASE_PROJECT_ID=eventflow-ffb12
FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app
```

This works for local testing with Application Default Credentials.

### Option B: Production Setup (Service Account)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project `eventflow-ffb12`
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download JSON file
6. Add to `.env`:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"eventflow-ffb12",...}'
```

**Current Status:** ✅ Step 1 completed (credentials added to .env for testing)

---

## Step 2: Test Firebase Connection

```bash
# Test if Firebase Admin SDK can connect
node -e "require('./firebase-admin').initializeFirebaseAdmin(); console.log('Connected:', require('./firebase-admin').isFirebaseAvailable())"
```

**Expected output:** `Connected: true` or `Connected: false` with error message

**If connection fails:**
- Check credentials are correct
- Verify Firebase project exists
- Check internet connection
- Review error messages

---

## Step 3: Dry-Run Migration (Safety Check)

Run migration in test mode to see what would be migrated:

```bash
node migrate-to-firebase.js --dry-run
```

**What to check:**
- Number of items per collection
- Sample items shown match your data
- No error messages

**Expected output:**
```
📦 Migrating users...
   Found 4 items in data/users.json
   🔍 DRY RUN - Would migrate 4 items
      - usr_7y8l47tfztdgju: Admin
      - usr_xk2bphtbztdgmd: Supplier Demo
      ...

📦 Migrating suppliers...
   Found 3 items in data/suppliers.json
   ...
```

---

## Step 4: Run Actual Migration

**⚠️ Important:** This will write data to Firebase. Make sure you reviewed the dry-run output first.

```bash
# Migrate all collections
node migrate-to-firebase.js

# OR migrate one collection at a time
node migrate-to-firebase.js --collection=users
node migrate-to-firebase.js --collection=suppliers
node migrate-to-firebase.js --collection=packages
```

**Expected output:**
```
✅ Migrated usr_7y8l47tfztdgju
✅ Migrated usr_xk2bphtbztdgmd
...
📊 Migration Summary
users:
  ✅ Migrated: 4
  ⏭️  Skipped:  0
  ❌ Errors:   0
```

**Verify in Firebase Console:**
1. Go to Firestore Database
2. Check collections: users, suppliers, packages
3. Verify document counts match

---

## Step 5: Update Backend to Use Firebase

### 5.1: Update server.js Import

**Find this line** (around line 80):
```javascript
const { read, write, uid } = require('./store');
```

**Replace with:**
```javascript
const { read, write, uid } = require('./data-access');
```

### 5.2: Convert Endpoints to Async

You'll need to convert endpoints from synchronous to asynchronous. Here are the patterns:

**Before:**
```javascript
app.get('/api/users', requireAuth, (req, res) => {
  const users = read('users');
  res.json({ users });
});
```

**After:**
```javascript
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await read('users');
    res.json({ users });
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
```

### 5.3: Priority Endpoints to Convert

Start with these critical endpoints (see `FIREBASE_BACKEND_MIGRATION_GUIDE.md` for full list):

1. **Authentication** - `/api/auth/*` endpoints
2. **User Management** - `/api/users/*`
3. **Package Listing** - `/api/packages`
4. **Supplier Listing** - `/api/suppliers`
5. **Admin Functions** - `/api/admin/*`

**Estimated time:** 4-6 hours for all endpoints

---

## Step 6: Test Each Converted Endpoint

After converting each endpoint, test it:

```bash
# Start server
npm start

# Test in another terminal
curl http://localhost:3000/api/packages
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/users
```

**Check:**
- Response data is correct
- No errors in server console
- Firebase Console shows data (for writes)

---

## Step 7: Deploy Firestore Security Rules

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project (if not done)
firebase init

# Deploy rules
firebase deploy --only firestore:rules,storage:rules
```

**Verify:**
- Rules deployed successfully
- Test that security rules work (try accessing data without auth)

---

## Step 8: Final Testing

### Manual Test Checklist
- [ ] User registration works
- [ ] User login works
- [ ] Create package (supplier)
- [ ] List packages (public)
- [ ] List suppliers
- [ ] Admin user management
- [ ] Ticket creation
- [ ] Messaging system
- [ ] File uploads

### Performance Check
- [ ] Response times acceptable
- [ ] No error logs
- [ ] Firebase quota usage reasonable

---

## Step 9: Monitor and Cleanup

### Monitor Firebase Usage
- Check Firebase Console → Usage tab
- Monitor Firestore read/write counts
- Check Storage usage

### Optional: Remove Local Storage
Once confident Firebase works:

1. Update `data-access.js` to not write to local storage
2. Keep local read fallback for safety
3. Archive local JSON files as backups

---

## Troubleshooting

### "Firebase not available"
- Check `.env` has Firebase credentials
- Restart server after adding credentials
- Check Firebase project exists

### "Permission denied" in Firestore
- Deploy security rules: `firebase deploy --only firestore:rules`
- Check rules allow authenticated access
- Verify user is logged in

### Data not syncing
- Check server logs for Firebase errors
- Verify `data-access.js` is being used (not `store.js`)
- Check Firebase Console for data

### "Module not found: firebase-admin"
```bash
npm install firebase-admin
```

---

## Current Progress

- [x] Step 1: Configure credentials (testing setup)
- [ ] Step 2: Test connection
- [ ] Step 3: Dry-run migration
- [ ] Step 4: Run migration
- [ ] Step 5: Update backend code
- [ ] Step 6: Test endpoints
- [ ] Step 7: Deploy rules
- [ ] Step 8: Final testing
- [ ] Step 9: Monitor

---

## Next Steps for You

1. **If you have a service account key:** Add `FIREBASE_SERVICE_ACCOUNT_KEY` to `.env`
2. **If testing locally:** Continue with current `.env` setup
3. **Run:** `node migrate-to-firebase.js --dry-run` to see what will be migrated
4. **Confirm:** Review dry-run output
5. **Proceed:** I'll help with the next steps

Let me know when you're ready to proceed with Step 2!
