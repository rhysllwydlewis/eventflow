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

## Frontend Integration Examples

### Complete Messaging UI Implementation

#### 1. Initialize WebSocket Connection

```html
<!-- Load Socket.IO client -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>

<script>
  // Initialize connection
  class MessagingClient {
    constructor() {
      this.socket = null;
      this.userId = null;
      this.currentThreadId = null;
      this.typingTimeout = null;
    }

    connect(userId) {
      this.userId = userId;
      this.socket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.setupEventListeners();
      this.authenticate();
    }

    authenticate() {
      this.socket.emit('auth', { userId: this.userId });

      this.socket.on('auth:success', data => {
        console.log('✓ Authenticated:', data.userId);
        this.loadThreads();
      });

      this.socket.on('auth:error', error => {
        console.error('✗ Authentication failed:', error);
        this.showError('Failed to connect to messaging service');
      });
    }

    setupEventListeners() {
      // Connection events
      this.socket.on('connect', () => {
        console.log('✓ Connected to server');
        this.updateConnectionStatus(true);
      });

      this.socket.on('disconnect', () => {
        console.log('✗ Disconnected from server');
        this.updateConnectionStatus(false);
      });

      this.socket.on('reconnect', attemptNumber => {
        console.log(`✓ Reconnected after ${attemptNumber} attempts`);
        this.authenticate(); // Re-authenticate after reconnect
      });

      // Message events
      this.socket.on('message:received', data => {
        this.handleMessageReceived(data);
      });

      // Typing indicators
      this.socket.on('typing:update', data => {
        this.handleTypingUpdate(data);
      });

      // Presence updates
      this.socket.on('presence:sync', data => {
        this.updateUserPresence(data);
      });

      // Read receipts
      this.socket.on('message:read:update', data => {
        this.updateReadStatus(data);
      });

      // Reactions
      this.socket.on('reaction:received', data => {
        this.handleReactionReceived(data);
      });
    }

    // ... more methods below
  }
</script>
```

#### 2. Message Display Component

```html
<div id="messaging-container">
  <!-- Thread List -->
  <div class="threads-panel">
    <div class="threads-header">
      <h3>Messages</h3>
      <button onclick="messagingClient.createNewThread()">New Message</button>
    </div>
    <div id="threads-list" class="threads-list">
      <!-- Threads will be dynamically added -->
    </div>
  </div>

  <!-- Message Thread -->
  <div class="messages-panel">
    <div class="messages-header">
      <div class="participant-info">
        <img id="participant-avatar" class="avatar" src="" alt="" />
        <div>
          <h4 id="participant-name"></h4>
          <span id="participant-status" class="status-indicator"></span>
        </div>
      </div>
    </div>

    <div id="messages-container" class="messages-container">
      <!-- Messages will be dynamically added -->
    </div>

    <div class="typing-indicator" id="typing-indicator" style="display: none;">
      <span class="typing-dots"> <span></span><span></span><span></span> </span>
      <span class="typing-text">User is typing...</span>
    </div>

    <div class="message-input-container">
      <textarea id="message-input" placeholder="Type your message..." rows="3"></textarea>
      <div class="message-actions">
        <button onclick="messagingClient.attachFile()">📎</button>
        <button onclick="messagingClient.sendMessage()" class="btn-send">Send</button>
      </div>
    </div>
  </div>
</div>
```

#### 3. Message Handling Methods

```javascript
// Continuation of MessagingClient class

async loadThreads() {
  try {
    const response = await fetch('/api/v2/messages/threads', {
      credentials: 'include',
    });
    const data = await response.json();

    if (data.success) {
      this.renderThreads(data.threads);
    }
  } catch (error) {
    console.error('Failed to load threads:', error);
  }
}

renderThreads(threads) {
  const container = document.getElementById('threads-list');
  container.innerHTML = '';

  threads.forEach(thread => {
    const threadEl = document.createElement('div');
    threadEl.className = `thread-item ${thread.unreadCount ? 'unread' : ''}`;
    threadEl.onclick = () => this.openThread(thread._id);

    threadEl.innerHTML = `
      <img src="${thread.participant.avatar}" class="avatar" alt="">
      <div class="thread-info">
        <div class="thread-name">${thread.participant.name}</div>
        <div class="thread-preview">${thread.lastMessage?.content || 'No messages yet'}</div>
        <div class="thread-time">${this.formatTime(thread.lastMessageAt)}</div>
      </div>
      ${thread.unreadCount ? `<span class="unread-badge">${thread.unreadCount}</span>` : ''}
    `;

    container.appendChild(threadEl);
  });
}

async openThread(threadId) {
  this.currentThreadId = threadId;

  // Join thread room
  this.socket.emit('thread:join', { threadId });

  // Load messages
  try {
    const response = await fetch(`/api/v2/messages/${threadId}`, {
      credentials: 'include',
    });
    const data = await response.json();

    if (data.success) {
      this.renderMessages(data.messages);
      this.markThreadAsRead(threadId);
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

renderMessages(messages) {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  messages.forEach(message => {
    const messageEl = this.createMessageElement(message);
    container.appendChild(messageEl);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

createMessageElement(message) {
  const div = document.createElement('div');
  const isOwn = message.senderId === this.userId;

  div.className = `message ${isOwn ? 'message-own' : 'message-other'}`;
  div.dataset.messageId = message._id;

  div.innerHTML = `
    <div class="message-bubble">
      <div class="message-content">${this.escapeHtml(message.content)}</div>
      <div class="message-meta">
        <span class="message-time">${this.formatTime(message.createdAt)}</span>
        ${isOwn ? `<span class="message-status">${this.getStatusIcon(message.status)}</span>` : ''}
      </div>
      ${message.reactions.length ? this.renderReactions(message.reactions) : ''}
    </div>
    <div class="message-actions">
      <button onclick="messagingClient.addReaction('${message._id}', '👍')">👍</button>
      <button onclick="messagingClient.addReaction('${message._id}', '❤️')">❤️</button>
      <button onclick="messagingClient.addReaction('${message._id}', '😊')">😊</button>
    </div>
  `;

  return div;
}

async sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();

  if (!content || !this.currentThreadId) return;

  // Emit to WebSocket for real-time delivery
  this.socket.emit('message:send', {
    threadId: this.currentThreadId,
    content,
    attachments: [],
  });

  // Also send via REST API as backup
  try {
    await fetch(`/api/v2/messages/${this.currentThreadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify({ content, attachments: [] }),
    });

    // Clear input
    input.value = '';
    this.stopTyping();
  } catch (error) {
    console.error('Failed to send message:', error);
    this.showError('Failed to send message');
  }
}

handleMessageReceived(data) {
  if (data.message.threadId !== this.currentThreadId) {
    // Message for different thread - show notification
    this.showNotification(data.message);
    return;
  }

  // Add message to current thread
  const messageEl = this.createMessageElement(data.message);
  const container = document.getElementById('messages-container');
  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;

  // Mark as read if thread is open
  this.markMessageAsRead(data.message._id);

  // Play notification sound
  this.playNotificationSound();
}

// Typing indicators
setupTypingIndicator() {
  const input = document.getElementById('message-input');

  input.addEventListener('input', () => {
    this.startTyping();
  });

  input.addEventListener('blur', () => {
    this.stopTyping();
  });
}

startTyping() {
  if (!this.currentThreadId) return;

  // Emit typing start
  this.socket.emit('typing:start', { threadId: this.currentThreadId });

  // Clear existing timeout
  if (this.typingTimeout) {
    clearTimeout(this.typingTimeout);
  }

  // Auto-stop after 3 seconds
  this.typingTimeout = setTimeout(() => {
    this.stopTyping();
  }, 3000);
}

stopTyping() {
  if (!this.currentThreadId) return;

  this.socket.emit('typing:stop', { threadId: this.currentThreadId });

  if (this.typingTimeout) {
    clearTimeout(this.typingTimeout);
    this.typingTimeout = null;
  }
}

handleTypingUpdate(data) {
  if (data.threadId !== this.currentThreadId) return;

  const indicator = document.getElementById('typing-indicator');
  if (data.isTyping && data.userId !== this.userId) {
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}

// Presence tracking
updateUserPresence(data) {
  const statusEl = document.getElementById('participant-status');
  if (statusEl) {
    statusEl.className = `status-indicator status-${data.status}`;
    statusEl.title = data.status === 'online' ? 'Online' : 'Offline';
  }
}

// Reactions
async addReaction(messageId, emoji) {
  try {
    await fetch(`/api/v2/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify({ emoji }),
    });

    // WebSocket will broadcast the update
  } catch (error) {
    console.error('Failed to add reaction:', error);
  }
}

handleReactionReceived(data) {
  const messageEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
  if (messageEl) {
    const reactionsEl = messageEl.querySelector('.message-reactions');
    if (reactionsEl) {
      reactionsEl.innerHTML = this.renderReactions(data.reactions);
    }
  }
}

renderReactions(reactions) {
  const grouped = {};
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = 0;
    grouped[r.emoji]++;
  });

  return `
    <div class="message-reactions">
      ${Object.entries(grouped).map(([emoji, count]) => `
        <span class="reaction">${emoji} ${count}</span>
      `).join('')}
    </div>
  `;
}

// Utility methods
formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

getStatusIcon(status) {
  const icons = {
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
  };
  return icons[status] || '';
}

escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

getCsrfToken() {
  return window.__CSRF_TOKEN__ || '';
}

showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('New Message', {
      body: message.content,
      icon: '/assets/images/notification-icon.png',
    });
  }
}

playNotificationSound() {
  const audio = new Audio('/assets/sounds/notification.mp3');
  audio.volume = 0.5;
  audio.play().catch(() => {}); // Ignore if blocked
}

showError(message) {
  // Implement your error notification system
  console.error(message);
}

updateConnectionStatus(isConnected) {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.textContent = isConnected ? 'Connected' : 'Disconnected';
    statusEl.className = isConnected ? 'status-online' : 'status-offline';
  }
}
```

#### 4. Styling (CSS)

```css
/* Messaging Container */
#messaging-container {
  display: flex;
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

/* Threads Panel */
.threads-panel {
  width: 300px;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
}

.threads-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.threads-list {
  flex: 1;
  overflow-y: auto;
}

.thread-item {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  display: flex;
  gap: 10px;
  position: relative;
}

.thread-item:hover {
  background: #f5f5f5;
}

.thread-item.unread {
  background: #e3f2fd;
  font-weight: 600;
}

.unread-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #2196f3;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
}

/* Messages Panel */
.messages-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
}

.participant-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.status-online {
  background: #4caf50;
}

.status-offline {
  background: #9e9e9e;
}

/* Messages Container */
.messages-container {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  margin-bottom: 8px;
}

.message-own {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 18px;
  position: relative;
}

.message-own .message-bubble {
  background: #2196f3;
  color: white;
}

.message-other .message-bubble {
  background: #f1f1f1;
  color: #333;
}

.message-content {
  word-wrap: break-word;
}

.message-meta {
  margin-top: 5px;
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 5px;
}

.message-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 5px;
  margin-top: 5px;
}

.message:hover .message-actions {
  opacity: 1;
}

.message-reactions {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}

.reaction {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 14px;
}

/* Typing Indicator */
.typing-indicator {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
  font-size: 14px;
}

.typing-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  margin: 0 2px;
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

/* Message Input */
.message-input-container {
  padding: 15px;
  border-top: 1px solid #ddd;
}

#message-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: none;
  font-family: inherit;
}

.message-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}

.btn-send {
  background: #2196f3;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-send:hover {
  background: #1976d2;
}
```

#### 5. Initialize on Page Load

```javascript
// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Get current user ID from page
  const userId = document.body.dataset.userId;

  if (userId) {
    // Create messaging client
    window.messagingClient = new MessagingClient();
    messagingClient.connect(userId);
    messagingClient.setupTypingIndicator();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
});
```

### Mobile Responsive Considerations

```css
/* Mobile optimizations */
@media (max-width: 768px) {
  #messaging-container {
    flex-direction: column;
    height: 100vh;
  }

  .threads-panel {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #ddd;
  }

  .messages-panel {
    flex: 1;
  }

  .message-bubble {
    max-width: 85%;
  }
}
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
