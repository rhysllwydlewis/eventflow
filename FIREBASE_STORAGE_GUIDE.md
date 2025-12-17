# Firebase as Primary Storage for EventFlow

This document explains how Firebase is configured as the primary storage solution for EventFlow, covering both database (Firestore) and file storage.

## Overview

EventFlow is designed to use **Firebase** as its primary cloud storage platform for:
- **Database**: All application data (users, packages, posts, reviews, etc.) in Firestore
- **File Storage**: All photos and media files in Firebase Storage

## Current Configuration

### 1. Database Storage (Firestore)

The system automatically prioritizes Firebase Firestore for all data storage:

**Priority Order** (configured in `db-unified.js`):
1. **Firebase Firestore** (tried first) ✅ **Recommended for production**
2. MongoDB (fallback if Firestore unavailable)
3. Local JSON files (development only - not suitable for production)

**Collections stored in Firestore**:
- `users` - User accounts (customers, suppliers, admins)
- `suppliers` - Supplier business profiles
- `packages` - Service packages
- `reviews` - Reviews and ratings
- `messages` - Customer-supplier messages
- `tickets` - Support tickets
- `events` - Event records
- All other application data

### 2. File Storage (Firebase Storage)

Firebase Storage is used for all media uploads:

**What's stored**:
- Supplier gallery photos
- Package images
- Profile pictures
- Event photos
- Any user-uploaded media

**Current implementation**:
- Frontend: `public/assets/js/supplier-photo-upload.js` uses Firebase Storage
- Backend: `firebase-admin.js` provides Storage access via Admin SDK
- Storage bucket: `eventflow-ffb12.firebasestorage.app`

## How to Enable Firebase (Production Setup)

### Step 1: Set Environment Variables

Add these to your `.env` file or hosting platform (Railway, Heroku, etc.):

```env
# Required: Firebase Project ID
FIREBASE_PROJECT_ID=eventflow-ffb12

# Required for Production: Service Account Key
# Download from Firebase Console > Project Settings > Service Accounts > Generate New Private Key
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"eventflow-ffb12","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

# Storage Configuration
STORAGE_TYPE=firebase
FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app
```

### Step 2: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `eventflow-ffb12`
3. Click the gear icon → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file
7. Copy the entire JSON content and paste it as the value for `FIREBASE_SERVICE_ACCOUNT_KEY`

**Important**: Keep this key secure! Never commit it to version control.

### Step 3: Verify Setup

After setting environment variables and restarting your server:

1. Check server startup logs for:
   ```
   ✅ Using Firebase Firestore for data storage
   ```

2. If you see this instead, Firebase is not configured:
   ```
   ⚠️  Using local file storage (not suitable for production)
   ```

3. Check the `/api/health` endpoint:
   ```bash
   curl https://your-app.railway.app/api/health
   ```
   
   Should show:
   ```json
   {
     "database": "firestore",
     "databaseStatus": "connected"
   }
   ```

## Development vs Production

### Development (Local)

For local development, you have three options:

**Option 1: Use Firebase (Recommended)**
```env
FIREBASE_PROJECT_ID=eventflow-ffb12
# No service account key needed for development
```

**Option 2: Use MongoDB**
```env
MONGODB_URI=mongodb://localhost:27017/eventflow
```

**Option 3: Use Local Files** (default if nothing configured)
- No environment variables needed
- Data stored in `data/*.json` files
- **Not suitable for production!**

### Production (Deployed)

**Always use Firebase with service account credentials:**

```env
FIREBASE_PROJECT_ID=eventflow-ffb12
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
STORAGE_TYPE=firebase
```

## Troubleshooting

### "Using local file storage" message

**Problem**: Server is falling back to local files instead of using Firebase.

**Solutions**:
1. Verify `FIREBASE_PROJECT_ID` is set in environment variables
2. For production, verify `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly
3. Check that the service account JSON is valid (must be valid JSON string)
4. Restart the server after setting environment variables

### "Firebase Firestore not available" error

**Possible causes**:
1. Service account key is invalid or malformed
2. Project ID doesn't match the service account
3. Firebase project doesn't exist or access is revoked
4. Network issues connecting to Firebase

**Debug steps**:
1. Check logs for specific error message
2. Verify credentials in Firebase Console
3. Ensure project ID matches: `eventflow-ffb12`
4. Try regenerating service account key

### Photos not uploading

**Check**:
1. `STORAGE_TYPE=firebase` in environment variables
2. `FIREBASE_STORAGE_BUCKET=eventflow-ffb12.firebasestorage.app` is set
3. Storage bucket exists in Firebase Console
4. Storage rules allow uploads (check `storage.rules`)

## Architecture

### Database Layer (`db-unified.js`)

The unified database layer provides automatic fallback:

```javascript
// Tries Firebase first
await initializeDatabase();
// Returns: 'firestore', 'mongodb', or 'local'
```

All database operations automatically use the active storage backend:
- `read(collection)` - Get all documents
- `readOne(collection, id)` - Get single document
- `write(collection, data)` - Create/update document
- `deleteOne(collection, id)` - Delete document

### Storage Layer

**Backend** (`firebase-admin.js`):
- Provides Firebase Admin SDK for server-side operations
- Used for secure operations requiring elevated permissions

**Frontend** (`firebase-config.js` and `src/config/firebase.js`):
- Client-side Firebase SDK for direct browser uploads
- Used for user photo uploads with security rules

## Security

### Firestore Security Rules (`firestore.rules`)

Controls who can read/write data in Firestore. Review and customize based on your needs.

### Storage Security Rules (`storage.rules`)

Controls who can upload/download files. Review and customize based on your needs.

### Best Practices

1. **Never commit service account keys** to version control
2. **Use environment variables** for all sensitive credentials
3. **Review security rules** before deploying to production
4. **Enable Firebase Authentication** for user identity management
5. **Monitor Firebase usage** in Firebase Console to avoid unexpected costs

## Migration from Local Storage

If you're currently using local file storage and want to migrate to Firebase:

1. Set up Firebase environment variables (see Step 1 above)
2. Run the migration script (if available): `node migrate-to-firebase.js`
3. Verify data in Firebase Console
4. Update `.gitignore` to exclude local `data/*.json` files
5. Restart the server to use Firebase

## Monitoring

### Firebase Console

Monitor your Firebase usage at:
- Database: https://console.firebase.google.com/project/eventflow-ffb12/firestore
- Storage: https://console.firebase.google.com/project/eventflow-ffb12/storage

### Application Logs

Check server logs for database operations:
```
✅ Using Firebase Firestore for data storage
Firebase Admin SDK initialized successfully
```

### Health Check Endpoint

```bash
curl https://your-app.com/api/health
```

Returns current database status and type.

## Summary

- ✅ Firebase Firestore is the **primary database** for all application data
- ✅ Firebase Storage is the **primary file storage** for photos and media
- ✅ System is **already configured** to prioritize Firebase
- ✅ Just add **environment variables** to activate in production
- ✅ **No local storage** is used when Firebase is properly configured

For questions or issues, check server logs and Firebase Console for details.
