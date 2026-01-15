# Real-Time Messaging & Notifications System

## Overview

EventFlow's real-time messaging and notifications system provides production-grade communication capabilities including:

- **Real-time WebSocket messaging** with clustering support
- **Multi-channel notifications** (in-app, email, push)
- **User presence tracking** (online/offline/away)
- **Rich messaging features** (typing indicators, read receipts, reactions)
- **Message persistence** with MongoDB
- **Fault-tolerant delivery** with queuing and retries

## Architecture

```
┌──────────────────┐
│   HTTP Routes    │
│(messaging-v2.js) │
└────────┬─────────┘
         │
    ┌────▼──────────────────────┐
    │  WebSocket Interface      │
    │(websocket-server-v2.js)   │
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────┐
    │  Services Layer           │
    │ • messagingService.js     │
    │ • presenceService.js      │
    │ • notificationService.js  │
    └────┬──────────────────────┘
         │
         ▼
    ┌────────────┐
    │  Database  │
    │ (MongoDB)  │
    └────────────┘
```

## Core Components

### 1. WebSocket Server v2 (`websocket-server-v2.js`)

Production-ready WebSocket server with:

- Redis adapter support for horizontal scaling
- JWT-based authentication
- Event handlers for messages, typing, reactions, presence
- Graceful shutdown and error handling

**Key Events:**

- `message:send` / `message:received` - Message exchange
- `typing:start` / `typing:stop` - Typing indicators
- `message:read` - Read receipts
- `reaction:send` / `reaction:received` - Message reactions
- `presence:update` / `presence:sync` - User presence

### 2. Messaging Service (`services/messagingService.js`)

Core business logic for messaging:

- Thread creation and management
- Message sending with validation
- Read receipts and delivery tracking
- Reactions
- Soft deletion
- Unread count tracking

### 3. Presence Service (`services/presenceService.js`)

User presence tracking:

- Online/offline/away states
- Heartbeat mechanism
- Bulk presence queries
- Redis support for clustering (optional)
- Automatic cleanup

### 4. Notification Service (`services/notificationService.js`)

Multi-channel notification delivery:

- **In-app**: Real-time WebSocket delivery
- **Email**: Digest emails for offline users
- **Push**: Mobile notification infrastructure (requires setup)
- User preference management
- Queue-based retry mechanism

### 5. REST API v2 (`routes/messaging-v2.js`)

RESTful endpoints at `/api/v2/messages/`:

#### Thread Management

- `POST /api/v2/messages/threads` - Create thread
- `GET /api/v2/messages/threads` - List user's threads
- `GET /api/v2/messages/threads/:id` - Get thread details
- `DELETE /api/v2/messages/threads/:id` - Archive thread

#### Messaging

- `GET /api/v2/messages/:threadId` - Get message history
- `POST /api/v2/messages/:threadId` - Send message
- `POST /api/v2/messages/:id/reactions` - Add/remove reaction
- `POST /api/v2/messages/:id/read` - Mark message as read
- `POST /api/v2/messages/threads/:threadId/read` - Mark thread as read

#### User Presence

- `GET /api/v2/presence/:userId` - Get user presence
- `GET /api/v2/presence?userIds=...` - Bulk presence query

#### Notifications

- `GET /api/v2/notifications` - List notifications
- `POST /api/v2/notifications` - Send notification (admin only)
- `GET /api/v2/notifications/preferences` - Get preferences
- `POST /api/v2/notifications/preferences` - Update preferences
- `POST /api/v2/notifications/:id/read` - Mark as read
- `DELETE /api/v2/notifications/:id` - Delete notification

#### Monitoring

- `GET /api/v2/messaging/status` - Server health (admin only)

## Database Schema

### Message Collection

```javascript
{
  _id: ObjectId,
  threadId: String,
  senderId: String,
  recipientIds: [String],
  content: String,
  attachments: [{
    type: String,     // 'image', 'video', 'document'
    url: String,
    filename: String,
    size: Number,
    mimeType: String,
    metadata: Object
  }],
  reactions: [{
    emoji: String,
    userId: String,
    createdAt: Date
  }],
  status: String,     // 'sent', 'delivered', 'read'
  readBy: [{
    userId: String,
    readAt: Date
  }],
  isDraft: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Thread Collection

```javascript
{
  _id: ObjectId,
  participants: [String],
  lastMessageId: String,
  lastMessageAt: Date,
  unreadCount: {
    userId1: Number,
    userId2: Number
  },
  status: String,   // 'active', 'archived', 'deleted'
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

## Client Integration

### WebSocket Connection

```javascript
// Connect to WebSocket
const socket = io('wss://your-domain.com', {
  transports: ['websocket', 'polling'],
});

// Authenticate
socket.emit('auth', { userId: 'user123' });

socket.on('auth:success', data => {
  console.log('Authenticated:', data.userId);
});

// Listen for messages
socket.on('message:received', data => {
  console.log('New message:', data.message);
});

// Send a message
socket.emit('message:send', {
  threadId: 'thread123',
  content: 'Hello!',
  attachments: [],
});

// Typing indicators
socket.emit('typing:start', { threadId: 'thread123' });
socket.emit('typing:stop', { threadId: 'thread123' });
```

### REST API Usage

```javascript
// Create a thread
const response = await fetch('/api/v2/messages/threads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({
    participants: ['user456'],
    metadata: { subject: 'Project Discussion' },
  }),
});

// Get messages
const messages = await fetch(`/api/v2/messages/${threadId}`);

// Send message
await fetch(`/api/v2/messages/${threadId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({
    content: 'Hello, World!',
    attachments: [],
  }),
});

// Add reaction
await fetch(`/api/v2/messages/${messageId}/reactions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ emoji: '👍' }),
});
```

## Configuration

### Environment Variables

```bash
# WebSocket clustering (optional)
REDIS_URL=redis://localhost:6379

# MongoDB (required)
MONGODB_URI=mongodb://localhost:27017/eventflow

# JWT Secret (required)
JWT_SECRET=your-secret-key-min-32-chars

# Base URL (required for email links)
BASE_URL=https://your-domain.com

# Email configuration (optional)
EMAIL_ENABLED=true
POSTMARK_API_KEY=your-postmark-key
POSTMARK_FROM=noreply@your-domain.com

# Push notifications (optional)
FIREBASE_CREDENTIALS=path/to/firebase-credentials.json
```

### Redis Setup (Optional - for clustering)

For production deployments with multiple server instances:

```bash
# Install Redis
npm install @socket.io/redis-adapter ioredis

# Set environment variable
export REDIS_URL=redis://localhost:6379
```

The system automatically falls back to in-memory storage if Redis is not available.

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- tests/unit/presenceService.test.js
```

### Integration Testing

```bash
# Start server with test database
NODE_ENV=test npm start

# Run API tests (in another terminal)
npm run test:integration
```

## Performance Considerations

### WebSocket Connections

- Recommended: 1000-5000 concurrent connections per server instance
- Use Redis adapter for horizontal scaling beyond this

### Message Throughput

- ~1000 messages/second per server instance
- MongoDB indexes optimize message retrieval

### Presence Updates

- Heartbeat every 30 seconds
- Automatic cleanup of stale records every 60 seconds

## Security

### Authentication

- JWT-based WebSocket authentication
- HTTP-only cookies for REST API
- CSRF protection on all POST/PUT/DELETE endpoints

### Rate Limiting

- WebSocket: 100 events per minute per socket
- REST API: Standard rate limits apply

### Input Validation

- All message content sanitized
- File attachments validated
- Maximum message length: 10,000 characters

## Monitoring

### Health Check

```bash
GET /api/v2/messaging/status
```

Returns:

```json
{
  "success": true,
  "status": "healthy",
  "stats": {
    "connectedClients": 245,
    "onlineUsers": 198,
    "typingUsers": 12,
    "rooms": 156
  },
  "timestamp": "2024-01-13T12:00:00.000Z"
}
```

### Logging

All components use Winston for structured logging:

- Info: Connection/disconnection events
- Debug: Message send/receive, presence updates
- Error: Failed operations with stack traces

## Troubleshooting

### WebSocket Connection Issues

**Problem**: Clients can't connect to WebSocket
**Solution**:

- Check firewall allows WebSocket traffic
- Verify `BASE_URL` is set correctly
- Check server logs for connection errors

### Message Delivery Issues

**Problem**: Messages not being delivered
**Solution**:

- Verify MongoDB connection
- Check recipient is authenticated
- Review server logs for errors

### Presence Not Updating

**Problem**: User status stuck as online/offline
**Solution**:

- Verify heartbeat mechanism is working
- Check Redis connection (if using clustering)
- Restart presence service

## Migration from v1

The v2 system is fully backward compatible with the existing messaging system (`routes/messages.js`). Both systems can run concurrently:

- **v1 routes**: `/api/messages/*`
- **v2 routes**: `/api/v2/messages/*`

Clients can gradually migrate to v2 endpoints without downtime.

## Future Enhancements

- [ ] End-to-end encryption
- [ ] Voice/video calling
- [ ] File upload with cloud storage
- [ ] Message search and filtering
- [ ] Push notification implementation
- [ ] Analytics dashboard
- [ ] Message threading/replies

## Support

For issues or questions:

1. Check server logs: `tail -f logs/combined.log`
2. Review health endpoint: `GET /api/v2/messaging/status`
3. Check MongoDB connection status
4. Verify environment variables are set

## License

This is part of the EventFlow platform. See main LICENSE file for details.
