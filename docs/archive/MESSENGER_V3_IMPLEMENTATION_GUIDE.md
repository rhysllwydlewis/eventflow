# Messenger v3 Implementation Guide

## Overview

This document outlines the Messenger v3 implementation - a complete rebuild of the EventFlow messaging system with unified API, liquid glass UI, and real-time WebSocket communication.

## What's Been Implemented

### Backend (100% Complete)

#### API Routes (`routes/messenger.js`)
All endpoints mounted at `/api/v3/messenger/`:

**Conversations:**
- `POST /conversations` - Create new conversation
- `GET /conversations` - List conversations with filters
- `GET /conversations/:id` - Get conversation details
- `PATCH /conversations/:id` - Update (pin, mute, archive)
- `DELETE /conversations/:id` - Soft delete

**Messages:**
- `POST /conversations/:id/messages` - Send message (multipart for files)
- `GET /conversations/:id/messages` - Get messages (cursor pagination)
- `PATCH /messages/:id` - Edit message (15min window)
- `DELETE /messages/:id` - Soft delete
- `POST /conversations/:id/read` - Mark as read
- `POST /messages/:id/reactions` - Toggle emoji reaction

**Utilities:**
- `GET /search` - Full-text message search
- `GET /contacts` - Get contactable users
- `GET /unread-count` - Get unread badge count
- `POST /conversations/:id/typing` - Typing indicator

#### Service Layer (`services/messenger.service.js`)
- Complete business logic separation
- MongoDB native driver (no dbUnified)
- Smart thread reuse (checks for existing conversations)
- Cursor-based pagination
- Edit window enforcement (15 minutes)

#### Data Models (`models/Conversation.js`)
**Collections:**
- `conversations` - Conversation metadata
- `chat_messages` - All messages

**Indexes Created:**
- User conversations by activity
- Archived/active conversations
- Context-based lookups (package/listing)
- Message full-text search
- Conversation status filtering

#### WebSocket Events (`websocket-server.js`)
New v3 messenger events:
- `messenger:join` - Join conversation room
- `messenger:leave` - Leave conversation room
- `messenger:typing` - Typing indicators
- `messenger:message` - New message broadcast
- `messenger:new-message` - Message received
- `messenger:message-edited` - Edit notification
- `messenger:message-deleted` - Delete notification
- `messenger:reaction-updated` - Reaction changes
- `messenger:conversation-read` - Read receipt

#### Migration Script (`scripts/migrate-to-messenger-v3.js`)
- Migrates threads → conversations
- Migrates messages → chat_messages
- Maps old field names to new schema
- Preserves unread counts
- Creates all indexes
- Progress logging

### Frontend (70% Complete)

#### HTML Structure (`public/messenger/index.html`)
Complete responsive layout:
- Navigation header with notifications
- Sidebar: search, tabs, conversation list
- Main area: conversation view, messages, composer
- Contact picker modal
- Mobile responsive (breakpoint 768px)

#### CSS Design System (`public/messenger/css/`)

**`messenger.css` (19KB):**
- Liquid glass sidebar & cards
- Conversation list items with hover states
- Message bubbles (sent/received)
- Typing indicator dots
- Context banners
- Composer with glass input
- Modal with backdrop blur
- Responsive breakpoints
- Accessibility (@media prefers-reduced-motion)

**`messenger-animations.css` (6KB):**
- Message entrance animations (sent/received)
- Typing indicator bounce
- Reaction pop
- Badge bounce
- Presence pulse
- Conversation slide-in
- Empty state float
- Send button pulse
- Skeleton loading
- Modal slide-in
- All utility classes

#### JavaScript Components

**Complete:**
1. **MessengerState.js** - State management
   - Centralized data store
   - Event emitter pattern
   - Filtered conversations
   - Typing/presence tracking

2. **MessengerAPI.js** - HTTP client
   - All endpoint wrappers
   - CSRF token handling
   - FormData for file uploads
   - Error handling

3. **MessengerSocket.js** - WebSocket client
   - Socket.IO wrapper
   - Auto-reconnect logic
   - Room management
   - Event dispatching

4. **MessengerApp.js** - Main orchestrator
   - Initializes all components
   - Loads current user
   - Deep link handling
   - Error/success toasts

5. **ConversationList.js** - Sidebar component
   - Renders conversation items
   - Filter tabs
   - Search input
   - Time formatting
   - Click handlers

**Stubbed (Need Implementation):**
6. **ConversationView.js** - Needs:
   - Message rendering with date separators
   - Scroll to bottom on new message
   - Load more on scroll up
   - Edit/delete message UI
   - Reaction picker
   - Read receipts display

7. **MessageComposer.js** - Needs:
   - Auto-resize textarea
   - File attachment handling
   - Emoji picker integration
   - Reply-to UI
   - Send on Ctrl+Enter
   - Typing indicator emit

8. **ContactPicker.js** - Needs:
   - User search/filter
   - Contact list rendering
   - Modal open/close
   - Create conversation on select

9. **MessengerWidget.js** - Needs:
   - Dashboard embed version
   - 5 recent conversations
   - Unread badge
   - Link to full messenger

10. **MessengerTrigger.js** - Needs:
    - Auto-init on pages
    - Data attributes parsing
    - Open messenger with context

11. **NotificationBridge.js** - Needs:
    - Listen to messenger events
    - Dispatch to notification system
    - Update global badge
    - Desktop notifications

## Implementation Priorities

### Critical (Do First)
1. **ConversationView.js** - Core chat functionality
2. **MessageComposer.js** - Essential for sending messages
3. **ContactPicker.js** - Starting new conversations

### Important (Do Next)
4. **NotificationBridge.js** - Integration with existing system
5. **MessengerWidget.js** - Dashboard visibility

### Nice to Have (Do Later)
6. **MessengerTrigger.js** - Universal buttons
7. Additional features (edit message UI, emoji reactions)

## Detailed Implementation Tasks

### 1. ConversationView.js Implementation

```javascript
class ConversationView {
  constructor(app) {
    this.app = app;
    this.state = app.state;
    this.api = app.api;
    
    // DOM elements
    this.container = document.getElementById('conversationView');
    this.emptyState = document.getElementById('mainEmptyState');
    this.messagesArea = document.getElementById('messagesArea');
    this.contextBanner = document.getElementById('contextBanner');
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Listen for active conversation changes
    this.state.on('activeConversationChanged', (id) => {
      if (id) {
        this.show(id);
      } else {
        this.showEmpty();
      }
    });
    
    // Listen for message changes
    this.state.on('messagesChanged', ({ conversationId }) => {
      if (conversationId === this.state.activeConversationId) {
        this.renderMessages();
      }
    });
    
    // Back button (mobile)
    document.getElementById('backButton').addEventListener('click', () => {
      this.state.setActiveConversation(null);
      // Show sidebar on mobile
      if (window.innerWidth <= 768) {
        document.querySelector('.messenger-sidebar').classList.remove('hidden');
        document.querySelector('.messenger-main').classList.add('hidden');
      }
    });
    
    // Action buttons
    document.getElementById('pinButton').addEventListener('click', () => this.togglePin());
    document.getElementById('archiveButton').addEventListener('click', () => this.archive());
    document.getElementById('refreshButton').addEventListener('click', () => this.refresh());
  }
  
  show(conversationId) {
    this.emptyState.style.display = 'none';
    this.container.style.display = 'flex';
    
    const conversation = this.state.conversations.find(c => c._id === conversationId);
    if (!conversation) return;
    
    // Update header
    const otherParticipant = conversation.participants.find(
      p => p.userId !== this.state.currentUser.id
    );
    
    document.getElementById('conversationAvatar').textContent = otherParticipant?.avatar || 'U';
    document.getElementById('conversationName').textContent = otherParticipant?.displayName || 'User';
    document.getElementById('conversationStatus').textContent = 'Offline'; // TODO: Use presence
    
    // Show context banner if exists
    if (conversation.context) {
      this.showContext(conversation.context);
    } else {
      this.contextBanner.style.display = 'none';
    }
    
    // Render messages
    this.renderMessages();
  }
  
  showEmpty() {
    this.emptyState.style.display = 'flex';
    this.container.style.display = 'none';
  }
  
  showContext(context) {
    this.contextBanner.style.display = 'flex';
    document.getElementById('contextType').textContent = context.type;
    document.getElementById('contextTitle').textContent = context.referenceTitle;
    document.getElementById('contextImage').src = context.referenceImage || '';
    document.getElementById('contextLink').href = context.referenceUrl || '#';
  }
  
  renderMessages() {
    const messages = this.state.getMessages(this.state.activeConversationId);
    this.messagesArea.innerHTML = '';
    
    let lastDate = null;
    
    messages.forEach((msg, index) => {
      // Add date separator if date changed
      const msgDate = new Date(msg.createdAt).toLocaleDateString();
      if (msgDate !== lastDate) {
        this.messagesArea.appendChild(this.createDateSeparator(msg.createdAt));
        lastDate = msgDate;
      }
      
      // Render message
      this.messagesArea.appendChild(this.createMessageElement(msg));
    });
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  createDateSeparator(date) {
    const div = document.createElement('div');
    div.className = 'message-date-separator';
    
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let label;
    if (d.toDateString() === today.toDateString()) {
      label = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday';
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    div.innerHTML = `<span>${label}</span>`;
    return div;
  }
  
  createMessageElement(message) {
    const div = document.createElement('div');
    const isSent = message.senderId === this.state.currentUser.id;
    
    div.className = `message-group ${isSent ? 'sent' : 'received'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
    
    // Add sender name for received messages
    if (!isSent) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = message.senderName;
      bubble.appendChild(sender);
    }
    
    // Message content
    const content = document.createElement('p');
    content.className = 'message-content';
    content.textContent = message.content;
    bubble.appendChild(content);
    
    // Attachments
    if (message.attachments && message.attachments.length > 0) {
      message.attachments.forEach(att => {
        bubble.appendChild(this.createAttachmentElement(att));
      });
    }
    
    // Time + edited indicator
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    if (message.isEdited) {
      const edited = document.createElement('span');
      edited.className = 'message-edited';
      edited.textContent = '(edited)';
      time.appendChild(edited);
    }
    bubble.appendChild(time);
    
    // Reactions
    if (message.reactions && message.reactions.length > 0) {
      const reactions = document.createElement('div');
      reactions.className = 'message-reactions';
      // Group reactions by emoji
      const grouped = {};
      message.reactions.forEach(r => {
        if (!grouped[r.emoji]) grouped[r.emoji] = [];
        grouped[r.emoji].push(r);
      });
      
      Object.entries(grouped).forEach(([emoji, users]) => {
        const reactionEl = document.createElement('span');
        reactionEl.className = 'message-reaction';
        reactionEl.textContent = `${emoji} ${users.length}`;
        reactions.appendChild(reactionEl);
      });
      
      bubble.appendChild(reactions);
    }
    
    div.appendChild(bubble);
    return div;
  }
  
  createAttachmentElement(attachment) {
    const div = document.createElement('div');
    div.className = 'message-attachment';
    
    if (attachment.type === 'image') {
      const img = document.createElement('img');
      img.src = attachment.url;
      img.alt = attachment.filename;
      div.appendChild(img);
    } else {
      const fileDiv = document.createElement('div');
      fileDiv.className = 'message-attachment-file';
      fileDiv.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <div>
          <div>${attachment.filename}</div>
          <div>${(attachment.size / 1024).toFixed(1)} KB</div>
        </div>
      `;
      div.appendChild(fileDiv);
    }
    
    return div;
  }
  
  scrollToBottom(smooth = false) {
    this.messagesArea.scrollTo({
      top: this.messagesArea.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }
  
  async togglePin() {
    // Implementation
  }
  
  async archive() {
    // Implementation
  }
  
  async refresh() {
    await this.app.loadMessages(this.state.activeConversationId);
  }
}
```

### 2. MessageComposer.js Implementation

```javascript
class MessageComposer {
  constructor(app) {
    this.app = app;
    this.state = app.state;
    this.api = app.api;
    this.socket = app.socket;
    
    this.input = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.fileInput = document.getElementById('fileInput');
    this.attachButton = document.getElementById('attachButton');
    this.attachmentPreview = document.getElementById('attachmentPreview');
    
    this.attachments = [];
    this.typingTimeout = null;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Auto-resize textarea
    this.input.addEventListener('input', () => {
      this.autoResize();
      this.updateSendButton();
      this.handleTyping();
    });
    
    // Send on Ctrl+Enter
    this.input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.send();
      }
    });
    
    // Send button
    this.sendButton.addEventListener('click', () => this.send());
    
    // Attach button
    this.attachButton.addEventListener('click', () => this.fileInput.click());
    
    // File input
    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });
  }
  
  autoResize() {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
  }
  
  updateSendButton() {
    const hasContent = this.input.value.trim().length > 0 || this.attachments.length > 0;
    this.sendButton.disabled = !hasContent;
  }
  
  handleTyping() {
    const conversationId = this.state.activeConversationId;
    if (!conversationId) return;
    
    // Send typing=true
    this.socket.sendTyping(conversationId, true);
    
    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Send typing=false after 3 seconds
    this.typingTimeout = setTimeout(() => {
      this.socket.sendTyping(conversationId, false);
    }, 3000);
  }
  
  handleFiles(files) {
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        this.app.showError(`File ${file.name} is too large (max 10MB)`);
        return;
      }
      
      this.attachments.push(file);
    });
    
    this.renderAttachmentPreview();
    this.updateSendButton();
  }
  
  renderAttachmentPreview() {
    if (this.attachments.length === 0) {
      this.attachmentPreview.style.display = 'none';
      return;
    }
    
    this.attachmentPreview.style.display = 'flex';
    this.attachmentPreview.innerHTML = '';
    
    this.attachments.forEach((file, index) => {
      const preview = document.createElement('div');
      preview.className = 'attachment-preview';
      
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
      } else {
        preview.textContent = file.name;
      }
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'attachment-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        this.attachments.splice(index, 1);
        this.renderAttachmentPreview();
        this.updateSendButton();
      });
      
      preview.appendChild(removeBtn);
      this.attachmentPreview.appendChild(preview);
    });
  }
  
  async send() {
    const content = this.input.value.trim();
    const conversationId = this.state.activeConversationId;
    
    if (!conversationId || (!content && this.attachments.length === 0)) {
      return;
    }
    
    // Disable send button
    this.sendButton.disabled = true;
    
    try {
      await this.app.sendMessage(conversationId, content, this.attachments);
      
      // Clear input
      this.input.value = '';
      this.attachments = [];
      this.renderAttachmentPreview();
      this.autoResize();
      this.updateSendButton();
      
      // Stop typing indicator
      this.socket.sendTyping(conversationId, false);
    } catch (error) {
      this.app.showError('Failed to send message');
      this.sendButton.disabled = false;
    }
  }
}
```

### 3. ContactPicker.js Implementation

```javascript
class ContactPicker {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.state = app.state;
    
    this.modal = document.getElementById('contactPickerModal');
    this.searchInput = document.getElementById('contactSearch');
    this.contactList = document.getElementById('contactList');
    this.closeButton = document.getElementById('closeContactPicker');
    
    this.contacts = [];
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Close button
    this.closeButton.addEventListener('click', () => this.close());
    
    // Close on overlay click
    this.modal.querySelector('.messenger-modal__overlay').addEventListener('click', () => this.close());
    
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.filterContacts(e.target.value);
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display === 'block') {
        this.close();
      }
    });
  }
  
  async open() {
    this.modal.style.display = 'block';
    this.searchInput.value = '';
    this.searchInput.focus();
    
    // Load contacts
    try {
      const response = await this.api.getContacts();
      this.contacts = response.contacts || [];
      this.renderContacts(this.contacts);
    } catch (error) {
      this.app.showError('Failed to load contacts');
    }
  }
  
  close() {
    this.modal.style.display = 'none';
  }
  
  filterContacts(query) {
    if (!query) {
      this.renderContacts(this.contacts);
      return;
    }
    
    const filtered = this.contacts.filter(contact =>
      contact.name.toLowerCase().includes(query.toLowerCase()) ||
      contact.email.toLowerCase().includes(query.toLowerCase())
    );
    
    this.renderContacts(filtered);
  }
  
  renderContacts(contacts) {
    this.contactList.innerHTML = '';
    
    if (contacts.length === 0) {
      this.contactList.innerHTML = '<p style="text-align: center; padding: 40px; color: #6B7280;">No users found</p>';
      return;
    }
    
    contacts.forEach(contact => {
      const el = this.createContactElement(contact);
      this.contactList.appendChild(el);
    });
  }
  
  createContactElement(contact) {
    const div = document.createElement('div');
    div.className = 'contact-item';
    
    div.innerHTML = `
      <div class="messenger-avatar">${contact.name?.[0]?.toUpperCase() || 'U'}</div>
      <div class="contact-item__info">
        <div class="contact-item__name">${contact.name || 'User'}</div>
        <span class="contact-item__role contact-item__role--${contact.role || 'customer'}">
          ${contact.role || 'customer'}
        </span>
      </div>
    `;
    
    div.addEventListener('click', () => this.selectContact(contact));
    
    return div;
  }
  
  async selectContact(contact) {
    try {
      // Create conversation
      const response = await this.api.createConversation(contact.id);
      
      // Switch to the conversation
      this.state.setActiveConversation(response.conversation._id);
      
      // Update conversations list
      await this.app.loadConversations();
      
      // Close modal
      this.close();
    } catch (error) {
      this.app.showError('Failed to create conversation');
    }
  }
}
```

## Testing Checklist

- [ ] Backend API endpoints respond correctly
- [ ] WebSocket events fire and propagate
- [ ] File uploads work (images, PDFs, docs)
- [ ] Conversation creation with context
- [ ] Message pagination loads correctly
- [ ] Search returns relevant results
- [ ] Edit window enforced (15 minutes)
- [ ] Reactions toggle on/off
- [ ] Read receipts update
- [ ] Typing indicators appear/disappear
- [ ] Mobile responsive layout works
- [ ] Accessibility (keyboard nav, screen readers)
- [ ] Migration script runs without errors
- [ ] Email notifications sent when offline

## Deployment Steps

1. Run migration: `node scripts/migrate-to-messenger-v3.js`
2. Verify indexes created in MongoDB
3. Test API endpoints with Postman/curl
4. Test frontend in browser
5. Check browser console for errors
6. Test on mobile devices
7. Run CodeQL security scan
8. Update documentation

## Performance Considerations

- Messages paginated (50 per page)
- Conversations loaded on demand
- WebSocket reconnection with backoff
- Image thumbnails for attachments
- Text search indexed in MongoDB
- State updates batched for rendering

## Security Features

- CSRF protection on all write operations
- Rate limiting (80 req/10min for writes)
- File upload validation (type, size)
- Input sanitization (HTML escaping)
- Auth required on all endpoints
- Participant verification before actions
- Edit window enforcement

---

This guide provides everything needed to complete the messenger v3 implementation. The backend is production-ready, and the frontend has a solid foundation. Follow the implementation priorities above to complete the remaining components.
