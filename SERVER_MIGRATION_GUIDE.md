# Server-Side Cloud Migration Guide

## Overview

The unified database layer (`db-unified.js`) is now available and provides automatic cloud database selection. This guide explains how to migrate `server.js` to use it.

## How It Works

The unified database layer automatically selects the best available option:

1. **Firebase Firestore** (if `FIREBASE_PROJECT_ID` is set)
2. **MongoDB** (if `MONGODB_URI` is set)
3. **Local files** (fallback for development)

## Migration Strategy

### Phase 1: Gradual Migration (Recommended)

Replace `store.read()` and `store.write()` calls with `db-unified` equivalents:

```javascript
// OLD (local files only)
const { read, write } = require('./store');
const users = read('users');
write('users', users);

// NEW (cloud-ready with automatic fallback)
const db = require('./db-unified');
const users = await db.read('users');
await db.write('users', users);
```

**Key Changes:**
- Import from `./db-unified` instead of `./store`
- Add `await` before all database calls (they're async now)
- Wrap route handlers with `async`

### Phase 2: Example Migration

Here's a before/after example for a typical endpoint:

**Before (using store.js):**
```javascript
const { read, write } = require('./store');

app.get('/api/suppliers', (req, res) => {
  const suppliers = read('suppliers').filter(s => s.approved);
  res.json({ items: suppliers });
});

app.post('/api/suppliers', (req, res) => {
  const suppliers = read('suppliers');
  const newSupplier = {
    id: uid('sup'),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  suppliers.push(newSupplier);
  write('suppliers', suppliers);
  res.json(newSupplier);
});
```

**After (using db-unified.js):**
```javascript
const db = require('./db-unified');

app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await db.read('suppliers');
    const approved = suppliers.filter(s => s.approved);
    res.json({ items: approved });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const newSupplier = {
      id: db.uid('sup'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    await db.insertOne('suppliers', newSupplier);
    res.json(newSupplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});
```

### Phase 3: Better Performance with Direct Operations

For better performance, especially with Firestore/MongoDB, use direct operations instead of read/write:

```javascript
// Instead of this:
const users = await db.read('users');
const user = users.find(u => u.email === email);

// Do this:
const user = await db.findOne('users', { email });

// Instead of this:
const users = await db.read('users');
const index = users.findIndex(u => u.id === userId);
users[index] = { ...users[index], name: newName };
await db.write('users', users);

// Do this:
await db.updateOne('users', userId, { name: newName });
```

## Database Layer API

### Reading Data

```javascript
// Get all documents
const users = await db.read('users');

// Find one document
const user = await db.findOne('users', { email: 'user@example.com' });
const user = await db.findOne('users', u => u.role === 'admin');
```

### Writing Data

```javascript
// Insert new document
const newUser = await db.insertOne('users', {
  id: db.uid('usr'),
  name: 'John',
  email: 'john@example.com'
});

// Update existing document
await db.updateOne('users', userId, { name: 'Jane' });

// Delete document
await db.deleteOne('users', userId);

// Replace all documents (use sparingly - mostly for migrations)
await db.write('users', arrayOfUsers);
```

### Utilities

```javascript
// Generate unique ID
const id = db.uid('usr'); // Returns: usr_abc123xyz

// Check database type
const dbType = db.getDatabaseType(); // Returns: 'firestore', 'mongodb', or 'local'
```

## Migration Checklist

### Endpoints to Update

Based on common patterns in EventFlow, here are the main areas to update:

#### User Management
- [ ] `POST /api/auth/register` - User creation
- [ ] `POST /api/auth/login` - User lookup
- [ ] `GET /api/admin/users` - List users
- [ ] `PATCH /api/admin/users/:id` - Update user
- [ ] `DELETE /api/admin/users/:id` - Delete user

#### Suppliers
- [ ] `GET /api/suppliers` - List suppliers
- [ ] `POST /api/me/suppliers` - Create supplier
- [ ] `PATCH /api/me/suppliers/:id` - Update supplier
- [ ] `DELETE /api/suppliers/:id` - Delete supplier

#### Packages
- [ ] `GET /api/packages` - List packages
- [ ] `POST /api/me/packages` - Create package
- [ ] `PUT /api/me/packages/:id` - Update package
- [ ] `DELETE /api/packages/:id` - Delete package

#### Plans, Events, Reviews
- [ ] All plan endpoints
- [ ] All event endpoints
- [ ] All review endpoints

## Testing Strategy

### 1. Test with Local Files First
```bash
# Don't set FIREBASE_PROJECT_ID or MONGODB_URI
npm start
# App will use local files - test that everything works
```

### 2. Test with Firestore
```bash
# Set Firebase project ID
export FIREBASE_PROJECT_ID=eventflow-ffb12
npm start
# App will use Firestore - test CRUD operations
```

### 3. Verify Data in Firebase Console
- Go to https://console.firebase.google.com
- Open your project
- Navigate to Firestore Database
- Verify documents are being created/updated

## Rollback Plan

If something goes wrong:

1. **Immediate rollback:** Remove `db-unified` imports and revert to `store`
2. **Data recovery:** Local JSON files are preserved (not deleted by migration)
3. **Firebase data:** Can export from Firebase Console if needed

## Performance Considerations

### Firestore Best Practices
- Use `findOne()` instead of `read()` when possible (avoids downloading all docs)
- Use `updateOne()` instead of read + write (reduces bandwidth)
- Implement pagination for large collections
- Add indexes for common queries

### MongoDB Best Practices
- Same as Firestore above
- Consider adding compound indexes
- Use projection to limit returned fields

## Common Pitfalls

### 1. Forgetting `await`
```javascript
// ❌ WRONG - missing await
const users = db.read('users');

// ✅ CORRECT
const users = await db.read('users');
```

### 2. Not handling errors
```javascript
// ❌ WRONG - no error handling
app.get('/api/users', async (req, res) => {
  const users = await db.read('users');
  res.json(users);
});

// ✅ CORRECT - with error handling
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.read('users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
```

### 3. Using synchronous patterns
```javascript
// ❌ WRONG - won't work with async database
const user = db.findOne('users', { email });
if (user) { ... }

// ✅ CORRECT
const user = await db.findOne('users', { email });
if (user) { ... }
```

## Next Steps

1. **Start with one endpoint** - Pick a simple GET endpoint to test
2. **Test thoroughly** - Verify it works with local files
3. **Gradually migrate more** - One route at a time
4. **Deploy with Firestore** - Set `FIREBASE_PROJECT_ID` in production
5. **Monitor** - Watch logs for any issues

## Questions?

The unified database layer is designed to be a drop-in replacement that makes migration easier. If you encounter any issues:

1. Check that route handlers are marked `async`
2. Verify all database calls have `await`
3. Check error logs for specific issues
4. Fall back to local files temporarily if needed
