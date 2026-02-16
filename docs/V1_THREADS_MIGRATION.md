# V1 Threads to MongoDB Migration

## Overview

This migration script moves existing threads and messages from the JSON/dbUnified store to MongoDB, adding the necessary `participants` array for v2 API compatibility.

## Background

PR #544 added dual-write to MongoDB for **new** threads, but existing threads created before that PR were never migrated. This causes:

- 404 errors when v2 API queries MongoDB for old threads
- `TypeError` crashes in participant validation
- WebSocket disconnect loops

## Solution

This PR implements:

1. **Manual Migration Script** - `scripts/migrate-v1-threads-to-mongo.js`
2. **Automatic Migration on Server Startup** - Runs in `server.js`
3. **Frontend Fallback Improvements** - Better error handling in `conversation-handler.js`

## Usage

### Manual Migration

Run the migration script manually:

```bash
node scripts/migrate-v1-threads-to-mongo.js
```

This will:

- ✅ Read all threads from local storage
- ✅ Synthesize `participants` array for each thread
- ✅ Write threads to MongoDB (idempotent - safe to run multiple times)
- ✅ Migrate all messages with v2 field aliases
- ✅ Report progress and results

### Automatic Migration

The migration also runs automatically when the server starts:

- After MongoDB connection is established
- Non-blocking (uses `setImmediate`)
- Wrapped in try/catch (won't block server startup on failure)
- Only migrates threads that don't already exist in MongoDB

## What Gets Migrated

### Threads

Each thread gets:

- All existing v1 fields preserved (`customerId`, `supplierId`, `supplierName`, `customerName`, `recipientId`, `marketplace`, etc.)
- **New**: `participants` array synthesized from `[customerId, recipientId]` (NOT `supplierId`)
- `status: 'open'` if not already set
- `id` field preserved (the `thd_xxxxx` string)

**Important**: `supplierId` is NOT included in `participants` because it's a supplier database ID, not a user ID.

### Messages

Each message gets:

- All existing v1 fields preserved
- **New v2 aliases**:
  - `senderId` (from `fromUserId`)
  - `content` (from `text`)
  - `sentAt` (from `createdAt`)
- Defaults: `readBy: []`, `status: 'sent'`
- `threadId` preserved

## Idempotency

The migration uses `updateOne` with `upsert: true` and `$setOnInsert`, making it:

- ✅ Safe to run multiple times
- ✅ Won't overwrite existing MongoDB data
- ✅ Only inserts threads/messages that don't already exist

## Testing

Run the migration tests:

```bash
npm test -- tests/unit/v1-thread-migration.test.js
```

All thread-related tests:

```bash
npm test -- tests/unit/thread-participant-access.test.js
npm test -- tests/unit/v1-thread-compatibility.test.js
npm test -- tests/unit/thread-id-compatibility.test.js
```

## Verification

After migration, verify in MongoDB:

```javascript
// Check threads have participants array
db.threads.find({ id: { $regex: /^thd_/ } }).limit(5);

// Check messages have v2 fields
db.messages.find({ threadId: { $regex: /^thd_/ } }).limit(5);
```

## Backward Compatibility

✅ v1 API continues working (reads from both MongoDB and dbUnified)
✅ v2 API now works with migrated threads
✅ Frontend handles both v1 and v2 formats
✅ `isThreadParticipant()` handles both v1 and v2 threads

## Related Files

- `scripts/migrate-v1-threads-to-mongo.js` - Manual migration script
- `server.js` (lines 1131-1218) - Auto-migration on startup
- `public/assets/js/conversation-handler.js` (lines 335-402) - Frontend fallback
- `routes/messaging-v2.js` (lines 138-160) - Participant validation
- `services/messagingService.js` (lines 38-90) - Service-level participant logic
