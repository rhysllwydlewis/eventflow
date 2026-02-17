# Messaging System Phase 1: Implementation Guide

**Bulk Operations & Management Enhancement**

## Overview

This document provides a comprehensive guide to Phase 1 of the EventFlow messaging system enhancement, which adds critical bulk message management, advanced filtering, sorting, and improved UI/UX for message operations.

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Endpoints](#api-endpoints)
6. [Security Features](#security-features)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Usage Examples](#usage-examples)
10. [Troubleshooting](#troubleshooting)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                       │
├─────────────────────────────────────────────────────────────┤
│  messages.html │ messaging.js │ messaging.css               │
│  - Selection UI                                              │
│  - Bulk Actions Toolbar                                      │
│  - Sort/Filter Sidebar                                       │
│  - JavaScript Classes:                                       │
│    • SelectionManager                                        │
│    • BulkOperationManager                                    │
│    • SortFilterManager                                       │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API (HTTPS)
┌────────────────────▼────────────────────────────────────────┐
│                Backend (Node.js/Express)                     │
├─────────────────────────────────────────────────────────────┤
│  routes/messaging-v2.js                                      │
│  - POST /api/v2/messages/bulk-delete                         │
│  - POST /api/v2/messages/bulk-mark-read                      │
│  - POST /api/v2/messages/:id/flag                            │
│  - POST /api/v2/messages/:id/archive                         │
│  - POST /api/v2/messages/operations/:operationId/undo        │
│  - GET /api/v2/messages/:threadId (enhanced)                 │
│                                                              │
│  services/messagingService.js                                │
│  - bulkDeleteMessages()                                      │
│  - bulkMarkRead()                                            │
│  - flagMessage()                                             │
│  - archiveMessage()                                          │
│  - undoOperation()                                           │
│  - getMessagesWithFilters()                                  │
│                                                              │
│  Middleware:                                                 │
│  - authRequired (JWT validation)                             │
│  - csrfProtection (CSRF token validation)                    │
│  - writeLimiter (80 req/10 min rate limit)                   │
└────────────────────┬────────────────────────────────────────┘
                     │ MongoDB Driver
┌────────────────────▼────────────────────────────────────────┐
│                  Database (MongoDB)                          │
├─────────────────────────────────────────────────────────────┤
│  Collections:                                                │
│  - messages (enhanced with Phase 1 fields)                   │
│  - messageOperations (new - audit trail)                     │
│  - messageFolders (new - for future use)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Enhanced Message Schema

```javascript
{
  _id: ObjectId,
  threadId: String,
  senderId: String,
  recipientIds: [String],
  content: String,
  attachments: [Object],
  reactions: [Object],
  status: String, // 'sent', 'delivered', 'read'
  readBy: [Object],
  deliveredTo: [Object],
  isDraft: Boolean,
  parentMessageId: String,
  editedAt: Date,
  editHistory: [Object],

  // ✨ Phase 1 New Fields
  isStarred: Boolean,           // Flag/starred status
  isArchived: Boolean,          // Archive status
  archivedAt: Date,             // When archived
  messageStatus: String,        // 'new', 'waiting_response', 'resolved'
  lastActionedBy: String,       // User ID of last action
  lastActionedAt: Date,         // Timestamp of last action

  metadata: Object,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date              // Soft delete
}
```

### New: messageOperations Collection

```javascript
{
  _id: ObjectId,
  operationId: String,          // UUID for operation tracking
  userId: String,               // User who performed operation
  operationType: String,        // 'delete', 'restore', 'flag', 'archive', etc.
  messageIds: [String],         // Affected message IDs
  threadId: String,             // Thread context
  previousState: {              // For undo functionality
    messages: [{
      _id: ObjectId,
      isStarred: Boolean,
      isArchived: Boolean,
      messageStatus: String,
      deletedAt: Date
    }]
  },
  action: String,               // Description
  reason: String,               // Optional reason
  createdAt: Date,
  undoExpiresAt: Date,          // 30 seconds from creation
  undoToken: String,            // Secure token for undo
  isUndone: Boolean,            // Whether undone
  undoneAt: Date,               // When undone
  ipAddress: String,            // For audit
  userAgent: String             // For audit
}
```

### Database Indexes

```javascript
// Message collection indexes
db.messages.createIndex({ isStarred: 1 });
db.messages.createIndex({ isArchived: 1 });
db.messages.createIndex({ messageStatus: 1 });
db.messages.createIndex({ lastActionedAt: -1 });

// MessageOperations collection indexes
db.messageOperations.createIndex({ operationId: 1 }, { unique: true });
db.messageOperations.createIndex({ userId: 1 });
db.messageOperations.createIndex({ operationType: 1 });
db.messageOperations.createIndex({ createdAt: -1 });
db.messageOperations.createIndex({ undoExpiresAt: 1 });
db.messageOperations.createIndex({ isUndone: 1 });
```

---

## Backend Implementation

### Service Methods

#### bulkDeleteMessages

```javascript
/**
 * Soft delete multiple messages
 * @param {Array<string>} messageIds - Message IDs to delete
 * @param {string} userId - User performing deletion
 * @param {string} threadId - Thread context
 * @param {string} reason - Optional reason
 * @returns {Promise<Object>} { success, deletedCount, operationId, undoToken, undoExpiresAt }
 */
async bulkDeleteMessages(messageIds, userId, threadId, reason = '')
```

**Key Features:**

- Soft delete (sets `deletedAt` field)
- Stores previous state for undo
- Generates secure undo token
- 30-second undo window
- Audit logging

#### bulkMarkRead

```javascript
/**
 * Mark multiple messages as read/unread
 * @param {Array<string>} messageIds - Message IDs
 * @param {string} userId - User performing action
 * @param {boolean} isRead - Mark as read (true) or unread (false)
 * @returns {Promise<Object>} { success, updatedCount }
 */
async bulkMarkRead(messageIds, userId, isRead)
```

**Implementation:**

- Updates `readBy` array
- Sets message status
- Records last action metadata

#### flagMessage

```javascript
/**
 * Flag/unflag a single message
 * @param {string} messageId - Message ID
 * @param {string} userId - User performing action
 * @param {boolean} isFlagged - Flag status
 * @returns {Promise<Object>} { success, message }
 */
async flagMessage(messageId, userId, isFlagged)
```

#### archiveMessage

```javascript
/**
 * Archive/restore a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User performing action
 * @param {string} action - 'archive' or 'restore'
 * @returns {Promise<Object>} { success, message }
 */
async archiveMessage(messageId, userId, action)
```

#### undoOperation

```javascript
/**
 * Undo a previous operation
 * @param {string} operationId - Operation to undo
 * @param {string} undoToken - Verification token
 * @param {string} userId - User requesting undo
 * @returns {Promise<Object>} { success, restoredCount, error }
 */
async undoOperation(operationId, undoToken, userId)
```

**Validation:**

- Checks operation exists and belongs to user
- Validates undo token
- Ensures undo window hasn't expired
- Restores messages to previous state

#### getMessagesWithFilters

```javascript
/**
 * Fetch messages with sorting and filtering
 * @param {string} threadId - Thread ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { messages, total, page, pageSize }
 */
async getMessagesWithFilters(threadId, options)
```

**Supported Options:**

- `sortBy`: 'date-asc', 'date-desc'
- `filterBy`: 'all', 'read', 'unread', 'flagged', 'archived'
- `dateFrom`, `dateTo`: ISO date strings
- `hasAttachments`: boolean
- `status`: 'new', 'waiting_response', 'resolved'
- `page`, `pageSize`: Pagination

---

## Frontend Implementation

### JavaScript Classes

#### SelectionManager

Manages message selection state.

```javascript
const selectionManager = new SelectionManager();

// Toggle single item
selectionManager.toggle('messageId123');

// Select all
selectionManager.selectAll(['msg1', 'msg2', 'msg3']);

// Deselect all
selectionManager.deselectAll();

// Get selection state
const count = selectionManager.getSelectedCount();
const ids = selectionManager.getSelectedIds();
const isSelected = selectionManager.isSelected('messageId123');
```

#### BulkOperationManager

Handles bulk operations with API communication.

```javascript
const bulkOps = new BulkOperationManager();

// Bulk delete
const result = await bulkOps.bulkDelete(messageIds, threadId, reason);
// Returns: { success, deletedCount, operationId, undoToken }

// Bulk mark read
await bulkOps.bulkMarkRead(messageIds, true);

// Flag message
await bulkOps.flagMessage(messageId, true);

// Archive message
await bulkOps.archiveMessage(messageId, 'archive');

// Undo operation
await bulkOps.undo(operationId, undoToken);

// Get undo queue
const queue = bulkOps.getUndoQueue();
const lastOp = bulkOps.getLastOperation();
```

#### SortFilterManager

Manages sorting, filtering, and preferences.

```javascript
const sortFilter = new SortFilterManager();

// Set sort method
sortFilter.setSortMethod('date-desc');

// Set filter
sortFilter.setFilter('readStatus', 'unread');
sortFilter.setFilter('flagged', true);

// Get filters
const filters = sortFilter.getAllFilters();
const count = sortFilter.getActiveFilterCount();

// Clear all filters
sortFilter.clearFilters();

// Fetch messages with filters
const result = await sortFilter.fetchMessagesWithFilters(threadId);

// Preferences are automatically saved to localStorage
```

### UI Components

#### Bulk Actions Toolbar

```html
<div id="bulkActionsToolbar" class="bulk-actions-toolbar" style="display: none;">
  <div class="selection-counter">
    <span id="selectionCount">0 selected</span>
    <button id="deselectAllBtn">Deselect all</button>
  </div>
  <div class="actions">
    <button id="bulkMarkReadBtn">Mark as read</button>
    <button id="bulkMarkUnreadBtn">Mark as unread</button>
    <button id="bulkDeleteBtn" class="btn-danger">Delete</button>
  </div>
</div>
```

#### Sort Dropdown

```html
<select id="sortDropdown" class="sort-dropdown">
  <option value="date-desc">Newest first</option>
  <option value="date-asc">Oldest first</option>
  <option value="sender-asc">Sender (A-Z)</option>
  <option value="sender-desc">Sender (Z-A)</option>
  <option value="subject-asc">Subject (A-Z)</option>
  <option value="subject-desc">Subject (Z-A)</option>
  <option value="unread-first">Unread first</option>
</select>
```

#### Filter Sidebar

```html
<div id="filterSidebar" class="filter-sidebar" style="display: none;">
  <h3>Filter Messages</h3>

  <div class="filter-section">
    <label>Read Status</label>
    <select id="filterReadStatus">
      <option value="all">All messages</option>
      <option value="unread">Unread only</option>
      <option value="read">Read only</option>
    </select>
  </div>

  <!-- More filters... -->

  <button id="applyFiltersBtn">Apply Filters</button>
  <button id="clearFiltersBtn">Clear All</button>
</div>
```

---

## API Endpoints

### POST /api/v2/messages/bulk-delete

Delete multiple messages at once.

**Request:**

```json
{
  "messageIds": ["msg123", "msg456"],
  "threadId": "thread789",
  "reason": "Optional reason"
}
```

**Response:**

```json
{
  "success": true,
  "deletedCount": 2,
  "operationId": "op-uuid-123",
  "undoToken": "secure-token-456",
  "message": "2 message(s) deleted successfully"
}
```

**Rate Limit:** 80 requests per 10 minutes  
**Authentication:** Required  
**CSRF Protection:** Required

### POST /api/v2/messages/bulk-mark-read

Mark multiple messages as read/unread.

**Request:**

```json
{
  "messageIds": ["msg123", "msg456"],
  "isRead": true
}
```

**Response:**

```json
{
  "success": true,
  "updatedCount": 2,
  "message": "2 message(s) marked as read"
}
```

### POST /api/v2/messages/:id/flag

Flag or unflag a message.

**Request:**

```json
{
  "isFlagged": true
}
```

**Response:**

```json
{
  "success": true,
  "message": {
    /* message object */
  }
}
```

### POST /api/v2/messages/:id/archive

Archive or restore a message.

**Request:**

```json
{
  "action": "archive" // or "restore"
}
```

**Response:**

```json
{
  "success": true,
  "message": {
    /* message object */
  }
}
```

### POST /api/v2/messages/operations/:operationId/undo

Undo a previous operation (30-second window).

**Request:**

```json
{
  "undoToken": "secure-token-456"
}
```

**Response:**

```json
{
  "success": true,
  "restoredCount": 2,
  "message": "2 message(s) restored successfully"
}
```

**Error Cases:**

- `400`: Undo window expired
- `400`: Operation not found or already undone
- `401`: Unauthorized (not the operation owner)

### GET /api/v2/messages/:threadId

Fetch messages with enhanced sorting and filtering.

**Query Parameters:**

```
?sortBy=date-desc
&filterBy=unread
&dateFrom=2024-01-01T00:00:00.000Z
&dateTo=2024-12-31T23:59:59.999Z
&hasAttachments=true
&status=waiting_response
&page=1
&pageSize=50
```

**Response:**

```json
{
  "success": true,
  "messages": [
    /* array of messages */
  ],
  "count": 25,
  "total": 100,
  "page": 1,
  "pageSize": 50
}
```

---

## Security Features

### 1. Rate Limiting

All Phase 1 endpoints use `writeLimiter`:

- **Limit**: 80 requests per 10 minutes per IP
- **Headers**: Includes `RateLimit-*` headers
- **Response**: 429 Too Many Requests when exceeded

### 2. CSRF Protection

All POST endpoints require CSRF token:

```html
<meta name="csrf-token" content="token-here" />
```

```javascript
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
fetch(url, {
  headers: {
    'CSRF-Token': csrfToken,
  },
});
```

### 3. Authentication

JWT-based authentication required for all endpoints:

```
Authorization: Bearer <jwt-token>
```

### 4. Audit Logging

All bulk operations logged in `messageOperations`:

- User ID
- Operation type
- Affected messages
- Timestamp
- IP address
- User agent

### 5. Undo Security

- Secure 32-byte random hex token
- 30-second expiration window
- User ownership verification
- Token tied to specific operation

### 6. Input Validation

- Maximum 100 messages per bulk operation
- ObjectId validation
- Array type checking
- Required field validation

---

## Testing

### Unit Tests (37 test cases)

Located in `tests/unit/messaging-bulk-operations.test.js`:

```bash
npm run test:unit -- tests/unit/messaging-bulk-operations.test.js
```

**Coverage:**

- bulkDeleteMessages (2 tests)
- bulkMarkRead (2 tests)
- flagMessage (2 tests)
- archiveMessage (2 tests)
- undoOperation (3 tests)
- getMessagesWithFilters (4 tests)

### Integration Tests (22 test cases)

Located in `tests/integration/messaging-bulk-operations-api.test.js`:

```bash
npm run test:integration
```

**Coverage:**

- POST /bulk-delete (4 tests)
- POST /bulk-mark-read (4 tests)
- POST /:id/flag (3 tests)
- POST /:id/archive (3 tests)
- POST /operations/:id/undo (3 tests)
- GET /:threadId with filters (4 tests)

### Running All Tests

```bash
# All tests
npm test

# With coverage
npm run test:full

# Smoke tests only
npm run test:smoke
```

---

## Deployment

### Prerequisites

- Node.js >= 20.0.0
- MongoDB >= 6.0
- Existing EventFlow application

### Step 1: Database Migration

No explicit migration needed. New fields have defaults:

- `isStarred`: false
- `isArchived`: false
- `archivedAt`: null
- `messageStatus`: 'new'

Indexes are created automatically by `createIndexes()` in Message model.

### Step 2: Backend Deployment

```bash
# Pull latest code
git pull origin copilot/enhance-bulk-message-management

# Install dependencies (if any new)
npm install

# Restart server
npm start
```

### Step 3: Frontend Deployment

Frontend files are already bundled in the repository:

- `public/messages.html`
- `public/assets/js/messaging.js`
- `public/assets/css/messaging.css`

No build step required. Changes are live after server restart.

### Step 4: Verification

1. Navigate to `/messages.html`
2. Verify UI elements appear:
   - Bulk selection checkboxes
   - Bulk actions toolbar
   - Sort dropdown
   - Filter button
3. Test bulk operations:
   - Select messages
   - Delete with undo
   - Mark as read/unread
   - Flag messages

### Rollback Plan

If issues occur:

```bash
# Revert to previous commit
git revert HEAD

# Restart server
npm start
```

All Phase 1 fields are optional, so rollback is safe.

---

## Usage Examples

### Example 1: Bulk Delete with Undo

```javascript
// User selects 5 messages
const messageIds = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];

// Delete them
const result = await bulkOps.bulkDelete(messageIds, 'thread123', 'Cleanup');

// Show toast with undo button
showToast({
  message: `${result.deletedCount} messages deleted`,
  type: 'success',
  action: {
    label: 'Undo',
    handler: async () => {
      await bulkOps.undo(result.operationId, result.undoToken);
      showToast({ message: 'Messages restored', type: 'success' });
    },
  },
});
```

### Example 2: Advanced Filtering

```javascript
// Set multiple filters
sortFilter.setFilter('readStatus', 'unread');
sortFilter.setFilter('flagged', true);
sortFilter.setFilter('dateFrom', '2024-01-01T00:00:00.000Z');

// Apply filters
const result = await sortFilter.fetchMessagesWithFilters('thread123');

// Display filtered messages
renderMessages(result.messages);
```

### Example 3: Keyboard Shortcuts

```javascript
// Delete selected messages: D key
document.addEventListener('keydown', e => {
  if (e.key === 'd' && selectionManager.hasSelection()) {
    bulkDeleteSelected();
  }
});

// Flag message: F key
document.addEventListener('keydown', e => {
  if (e.key === 'f' && currentMessage) {
    bulkOps.flagMessage(currentMessage.id, !currentMessage.isStarred);
  }
});

// Select all: Ctrl+A / Cmd+A
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    selectionManager.selectAll(allMessageIds);
  }
});

// Deselect: Esc
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    selectionManager.deselectAll();
  }
});
```

---

## Troubleshooting

### Issue: Undo not working

**Symptoms:** Undo button doesn't restore messages

**Solutions:**

1. Check undo window hasn't expired (30 seconds)
2. Verify `undoToken` is correct
3. Check user owns the operation
4. Look for errors in browser console

### Issue: Bulk delete fails

**Symptoms:** 400 or 500 error on bulk delete

**Solutions:**

1. Verify message count <= 100
2. Check `threadId` is provided
3. Ensure user has access to thread
4. Check rate limiting (80 req/10 min)

### Issue: Filters not applying

**Symptoms:** Filtered results don't match criteria

**Solutions:**

1. Check filter values are correct
2. Verify localStorage is accessible
3. Clear filters and reapply
4. Check browser console for errors

### Issue: Selection not persisting

**Symptoms:** Selected messages disappear on tab change

**Solutions:**

- This is expected behavior. Selection is cleared when navigating between tabs (Inbox/Sent/Drafts) for UX clarity.

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('messaging_debug', 'true');
location.reload();
```

This will log:

- Selection changes
- API requests/responses
- Filter applications
- Undo operations

---

## Performance Considerations

### Message List Virtualization

For threads with 500+ messages:

- Only render visible messages
- Use virtual scrolling
- Batch DOM updates

### Debouncing

Search and filter inputs are debounced by 300ms to reduce unnecessary API calls.

### LocalStorage Caching

User preferences are cached in localStorage:

- Sort method
- Active filters
- No expiration (persists across sessions)

### Database Indexing

All frequently queried fields are indexed:

- `isStarred`, `isArchived`, `messageStatus`
- `lastActionedAt`, `operationId`
- Query performance: < 50ms for typical queries

---

## Future Enhancements (Not in Phase 1)

The following features are planned but not included in Phase 1:

### Phase 2: Custom Folders

- User-defined folders
- Move messages to folders
- Folder color coding
- Nested folders

### Phase 3: Advanced Search

- Full-text search with operators
- Search by sender, date range, attachments
- Save search queries
- Search history

### Phase 4: Message Templates

- Create message templates
- Template categories
- Variable placeholders
- Quick insert

### Phase 5: Encryption & Reactions

- End-to-end encryption
- Emoji reactions beyond existing
- Message scheduling
- Read receipts

---

## Support

For issues or questions:

- GitHub Issues: https://github.com/rhysllwydlewis/eventflow/issues
- Email: support@eventflow.com

---

**Document Version:** 1.0  
**Last Updated:** 2024-02-17  
**Author:** EventFlow Development Team
