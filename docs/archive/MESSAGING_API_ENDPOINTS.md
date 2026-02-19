# Messaging API Endpoints Documentation

## Overview

EventFlow messaging system provides both V1 (legacy) and V2 (modern) API endpoints. All endpoints support resilient error handling, automatic retries, and comprehensive logging.

---

## Base URLs

- **V1 API:** `/api/v1/messages` or `/api/messages` (backward compatibility)
- **V2 API:** `/api/v2/messages`

---

## Path Consistency

The V2 API supports **both** path naming conventions for consistency:

- **Threads:** `/threads/:threadId/...` (original naming)
- **Conversations:** `/conversations/:conversationId/...` (alias for consistency)

Both paths point to the same endpoints and use identical logic.

---

## Core Endpoints

### 1. Get Conversations List

**V1:**
```
GET /api/messages/conversations
GET /api/v1/messages/conversations
```

**V2:**
```
GET /api/v2/messages/conversations
```

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "...",
      "supplierName": "...",
      "lastMessagePreview": "...",
      "lastMessageTime": "...",
      "unreadCount": 0
    }
  ]
}
```

---

### 2. Get Messages in Thread

**V1:**
```
GET /api/messages/threads/:threadId/messages
GET /api/messages/:conversationId
```

**V2:**
```
GET /api/v2/messages/:threadId
```

---

### 3. Send Message

**V1:**
```
POST /api/messages/threads/:threadId/messages
```

**V2:**
```
POST /api/v2/messages/:threadId
```

**Request Body:**
```json
{
  "message": "Message text",
  "attachments": [] // Optional
}
```

---

### 4. Mark Thread as Read

**V1:**
```
POST /api/messages/threads/:threadId/mark-read
```

**V2 (Both paths supported):**
```
POST /api/v2/messages/threads/:threadId/read
POST /api/v2/messages/conversations/:conversationId/read
```

**Response:**
```json
{
  "success": true,
  "message": "Thread marked as read",
  "markedCount": 5,
  "threadId": "..."
}
```

---

### 5. Get Unread Count

**V1:**
```
GET /api/messages/unread
```

**V2:**
```
GET /api/v2/messages/unread
```

**Response:**
```json
{
  "count": 12
}
```

---

## Bulk Operations (V2 Only)

### 1. Bulk Delete Messages

```
POST /api/v2/messages/bulk-delete
```

**Request Body:**
```json
{
  "messageIds": ["id1", "id2", "id3"],
  "threadId": "thread-id",
  "reason": "Optional reason"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 3,
  "operationId": "op-123",
  "undoToken": "token-456",
  "message": "3 message(s) deleted successfully",
  "duration": 245
}
```

**Limits:**
- Maximum 100 messages per request
- 30-second timeout

**Error Response:**
```json
{
  "error": "Cannot delete more than 100 messages at once",
  "retriable": false,
  "code": "TOO_MANY_MESSAGES",
  "limit": 100,
  "provided": 150,
  "hint": "Split into smaller batches of 100 or fewer messages"
}
```

---

### 2. Bulk Mark as Read/Unread

```
POST /api/v2/messages/bulk-mark-read
```

**Request Body:**
```json
{
  "messageIds": ["id1", "id2", "id3"],
  "isRead": true
}
```

**Response:**
```json
{
  "success": true,
  "updatedCount": 3,
  "message": "3 message(s) marked as read",
  "duration": 152
}
```

**Limits:**
- Maximum 100 messages per request
- 30-second timeout

---

### 3. Undo Operation

```
POST /api/v2/messages/operations/:operationId/undo
```

**Request Body:**
```json
{
  "undoToken": "token-from-original-operation"
}
```

**Response:**
```json
{
  "success": true,
  "restoredCount": 3,
  "message": "3 message(s) restored successfully",
  "operationId": "op-123",
  "duration": 189
}
```

**Error Response (Expired):**
```json
{
  "error": "Undo window has expired",
  "retriable": false,
  "code": "UNDO_EXPIRED",
  "operationId": "op-123"
}
```

**Notes:**
- Undo window is 30 seconds from the original operation
- Returns 410 Gone status if undo window expired

---

## Message Operations (V2)

### 1. Flag/Unflag Message

```
POST /api/v2/messages/:id/flag
```

**Request Body:**
```json
{
  "isFlagged": true
}
```

---

### 2. Archive/Unarchive Message

```
POST /api/v2/messages/:id/archive
```

**Request Body:**
```json
{
  "action": "archive" // or "unarchive"
}
```

---

### 3. Archive Thread

**V1:**
```
POST /api/messages/threads/:threadId/archive
```

**V2:**
```
POST /api/v2/messages/threads/:threadId/archive
```

---

## Error Handling

### Error Response Structure

All V2 endpoints return structured errors:

```json
{
  "error": "Human-readable error message",
  "retriable": true, // or false
  "code": "ERROR_CODE",
  "hint": "Helpful suggestion for resolving the error",
  // Additional context fields
}
```

### Error Codes

| Code | Meaning | Retriable | Status |
|------|---------|-----------|--------|
| `MISSING_THREAD_ID` | Thread ID not provided | No | 400 |
| `THREAD_NOT_FOUND` | Thread doesn't exist | No | 404 |
| `ACCESS_DENIED` | User lacks permission | No | 403 |
| `INVALID_MESSAGE_IDS` | Invalid ID format | No | 400 |
| `TOO_MANY_MESSAGES` | Exceeded batch limit | No | 400 |
| `TIMEOUT` | Operation timed out | Yes | 504 |
| `INTERNAL_ERROR` | Server error | Yes | 500 |
| `UNDO_EXPIRED` | Undo window passed | No | 410 |

---

## Frontend Retry Logic

The frontend automatically retries failed requests using exponential backoff:

### Retry Strategy

```javascript
// Implemented in retryWithBackoff()
- Attempt 1: Immediate
- Attempt 2: 1s delay + jitter
- Attempt 3: 2s delay + jitter
- Max delay: 10s
```

### Retry Conditions

**Retries on:**
- Network errors
- Server errors (5xx)
- Timeouts (408, 504)
- Rate limits (429)
- Backend sets `retriable: true`

**Does NOT retry on:**
- Client errors (400, 403, 404)
- Backend sets `retriable: false`
- After 3 failed attempts

### Jitter

Random jitter (up to 30% of delay) prevents thundering herd problem when multiple clients retry simultaneously.

---

## Timeout Protection

All bulk operations have built-in timeout protection:

- **Timeout Duration:** 30 seconds
- **Behavior:** Operation races against timeout
- **Response:** 504 Gateway Timeout with `retriable: true`
- **Client Action:** Automatic retry with exponential backoff

---

## Performance Logging

All operations log performance metrics:

```javascript
{
  userId: "user-id",
  threadId: "thread-id",
  deletedCount: 5,
  duration: 245, // milliseconds
  timestamp: "2026-02-18T18:00:00Z"
}
```

---

## Rate Limiting

- **Write Operations:** Limited by `writeLimiter` middleware
- **Read Operations:** No rate limit
- **Bulk Operations:** Lower rate limit due to higher resource usage

---

## CSRF Protection

All POST/PUT/DELETE endpoints require CSRF token:

```javascript
headers: {
  'CSRF-Token': csrfToken
}
```

CSRF token available in meta tag:
```html
<meta name="csrf-token" content="...">
```

---

## WebSocket Integration

Real-time updates available via Socket.IO:

**Events:**
- `message:new` - New message received
- `message:read` - Messages marked as read
- `message:typing` - User is typing
- `thread:updated` - Thread metadata changed

---

## Best Practices

### 1. Always Use Retry Logic

```javascript
// Use retryWithBackoff() wrapper
const result = await retryWithBackoff(
  async () => messagingSystem.bulkDelete(ids, threadId),
  { maxAttempts: 3 }
);
```

### 2. Handle Errors Gracefully

```javascript
try {
  await messagingSystem.bulkDelete(ids, threadId);
} catch (error) {
  if (error.response?.code === 'TOO_MANY_MESSAGES') {
    // Split into smaller batches
  } else if (error.response?.retriable) {
    // Show "retry" button to user
  } else {
    // Show permanent error message
  }
}
```

### 3. Respect Batch Limits

```javascript
// Split large arrays into batches of 100
const batches = [];
for (let i = 0; i < messageIds.length; i += 100) {
  batches.push(messageIds.slice(i, i + 100));
}

for (const batch of batches) {
  await messagingSystem.bulkDelete(batch, threadId);
}
```

### 4. Use Undo Functionality

```javascript
// Store undo information
const result = await messagingSystem.bulkDelete(ids, threadId);
console.log('Undo available for 30 seconds:', result.operationId);

// Show undo button with countdown
// If user clicks undo within 30 seconds:
await messagingSystem.undoOperation(
  result.operationId,
  result.undoToken
);
```

---

## Migration Guide (V1 → V2)

### Key Differences

1. **Error Responses:** V2 includes `retriable`, `code`, `hint` fields
2. **Bulk Operations:** Only available in V2
3. **Undo:** Only available in V2
4. **Timeout Protection:** Only in V2
5. **Performance Metrics:** Only in V2 responses

### Gradual Migration

Both V1 and V2 are supported simultaneously. Migrate endpoints gradually:

**Step 1:** Start using V2 for new features
**Step 2:** Add retry logic to existing V1 calls
**Step 3:** Migrate critical paths to V2
**Step 4:** Migrate remaining endpoints
**Step 5:** Deprecate V1 (with plenty of notice)

---

## Testing Endpoints

### Using cURL

```bash
# Get conversations
curl -X GET \
  -H "Cookie: session=..." \
  https://eventflow.app/api/v2/messages/conversations

# Bulk delete with retry logic
curl -X POST \
  -H "Content-Type: application/json" \
  -H "CSRF-Token: ..." \
  -H "Cookie: session=..." \
  -d '{"messageIds":["id1","id2"],"threadId":"thread-id"}' \
  https://eventflow.app/api/v2/messages/bulk-delete
```

### Using Frontend Console

```javascript
// Test bulk delete
await messagingSystem.bulkDelete(
  ['msg-id-1', 'msg-id-2'], 
  'thread-id',
  'Testing bulk delete'
);

// Test with retry
await retryWithBackoff(
  async () => messagingSystem.bulkMarkRead(['msg-id-1'], true),
  { maxAttempts: 3 }
);
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** "CSRF token not found"
**Solution:** Ensure meta tag is present in HTML head

**Issue:** Bulk operation times out
**Solution:** Reduce batch size or retry after delay

**Issue:** Undo window expired
**Solution:** Undo must be called within 30 seconds

**Issue:** Too many messages
**Solution:** Split into batches of 100 or fewer

---

## Version History

- **V2 (Current):** Enhanced error handling, resilience, bulk operations
- **V1 (Legacy):** Basic endpoints, maintained for compatibility

---

**Last Updated:** 2026-02-18
**Status:** Production Ready ✅
