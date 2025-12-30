/**
 * Customer Messaging Interface
 * Handles displaying conversations for customers
 */

import messagingSystem from './messaging.js';
import { getListItemSkeletons, showEmptyState, showErrorState } from './utils/skeleton-loader.js';

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Render conversations
function renderConversations(conversations) {
  const container = document.getElementById('threads-cust');
  if (!container) {
    return;
  }

  if (!conversations || conversations.length === 0) {
    showEmptyState(container, {
      icon: '💬',
      title: 'No messages yet',
      description: 'Conversations will appear here when you contact suppliers.',
    });
    return;
  }

  let html = '<div class="thread-list">';

  conversations.forEach(conversation => {
    const supplierName = conversation.supplierName || 'Supplier';
    const lastMessage = conversation.lastMessage || 'No messages yet';
    const lastMessageTime = conversation.lastMessageTime
      ? messagingSystem.formatTimestamp(conversation.lastMessageTime)
      : '';

    html += `
      <div class="thread-item" style="border:1px solid #e4e4e7;padding:1rem;margin-bottom:0.5rem;border-radius:4px;cursor:pointer;transition:background 0.2s;" data-conversation-id="${conversation.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <strong>${escapeHtml(supplierName)}</strong>
          <span class="small" style="color:#9ca3af;">${lastMessageTime}</span>
        </div>
        <p class="small" style="margin:0;color:#6b7280;">${escapeHtml(lastMessage.substring(0, 80))}${lastMessage.length > 80 ? '...' : ''}</p>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Add click handlers
  container.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', function () {
      const conversationId = this.getAttribute('data-conversation-id');
      openConversation(conversationId);
    });

    // Hover effect
    item.addEventListener('mouseenter', function () {
      this.style.background = '#fafafa';
    });
    item.addEventListener('mouseleave', function () {
      this.style.background = '';
    });
  });
}

// Open conversation modal
function openConversation(conversationId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:600px;height:80vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <h3>Conversation</h3>
        <button class="modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto;padding:1rem;">
        <div id="conversationMessages"><p class="small">Loading...</p></div>
      </div>
      <div class="modal-footer" style="padding:1rem;border-top:1px solid #e4e4e7;">
        <form id="sendMessageForm" style="display:flex;gap:0.5rem;">
          <textarea id="messageInput" placeholder="Type your message..." rows="2" style="flex:1;padding:0.5rem;border:1px solid #d4d4d8;border-radius:4px;resize:none;" required></textarea>
          <button type="submit" class="btn btn-primary" style="align-self:flex-end;">Send</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => {
    if (messagesUnsubscribe) {
      messagesUnsubscribe();
    }
    modal.remove();
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Load messages with real-time updates
  let messagesUnsubscribe = null;
  let currentUser = null;

  const renderMessages = messages => {
    const container = document.getElementById('conversationMessages');
    if (!container) {
      return;
    }

    if (!messages || messages.length === 0) {
      container.innerHTML = '<p class="small">No messages yet. Start the conversation!</p>';
      return;
    }

    let html = '<div class="messages-list">';

    messages.forEach(message => {
      const timestamp = messagingSystem.formatFullTimestamp(message.timestamp);
      const isFromCustomer = message.senderType === 'customer';
      const alignment = isFromCustomer ? 'right' : 'left';
      const bgColor = isFromCustomer ? '#3b82f6' : '#e4e4e7';
      const textColor = isFromCustomer ? '#fff' : '#1a1a1a';

      html += `
        <div style="display:flex;justify-content:${isFromCustomer ? 'flex-end' : 'flex-start'};margin-bottom:1rem;">
          <div style="max-width:70%;padding:0.75rem;background:${bgColor};color:${textColor};border-radius:8px;">
            <div style="font-weight:600;margin-bottom:0.25rem;font-size:12px;opacity:0.9;">${escapeHtml(message.senderName || 'Unknown')}</div>
            <p style="margin:0;word-wrap:break-word;">${escapeHtml(message.message)}</p>
            <div style="margin-top:0.25rem;font-size:11px;opacity:0.8;">${timestamp}</div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  };

  // Get current user and set up listener
  getCurrentUser().then(user => {
    if (!user) {
      return;
    }
    currentUser = user;

    // Listen to messages
    messagesUnsubscribe = messagingSystem.listenToMessages(conversationId, renderMessages);

    // Mark messages as read
    messagingSystem.markMessagesAsRead(conversationId, user.id).catch(err => {
      console.error('Error marking messages as read:', err);
    });
  });

  // Send message form
  modal.querySelector('#sendMessageForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!currentUser) {
      if (typeof Toast !== 'undefined') {
        Toast.error('Please sign in to send messages');
      }
      return;
    }

    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();

    if (!messageText) {
      return;
    }

    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      await messagingSystem.sendMessage(conversationId, {
        senderId: currentUser.id,
        senderType: 'customer',
        senderName: currentUser.name || currentUser.email,
        message: messageText,
      });

      messageInput.value = '';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    } catch (error) {
      console.error('Error sending message:', error);
      if (typeof Toast !== 'undefined') {
        Toast.error(`Failed to send message: ${error.message}`);
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    }
  });
}

// Initialize
async function init() {
  const container = document.getElementById('threads-cust');
  if (!container) {
    return;
  }

  // Show skeleton loader
  container.innerHTML = getListItemSkeletons(3);

  const user = await getCurrentUser();
  if (!user) {
    showEmptyState(container, {
      icon: '🔒',
      title: 'Sign in to view messages',
      description: 'Log in to see your conversations with suppliers.',
      actionText: 'Sign In',
      actionHref: '/auth.html',
    });
    return;
  }

  // Listen to conversations for this customer
  try {
    messagingSystem.listenToUserConversations(user.id, 'customer', conversations => {
      // Sort by last message time
      conversations.sort((a, b) => {
        const timeA = a.lastMessageTime?.seconds || 0;
        const timeB = b.lastMessageTime?.seconds || 0;
        return timeB - timeA;
      });

      renderConversations(conversations);
    });

    // Listen to unread count for this customer
    messagingSystem.listenToUnreadCount(user.id, 'customer', unreadCount => {
      updateUnreadBadge(unreadCount);
    });
  } catch (error) {
    console.error('Error listening to conversations:', error);
    const container = document.getElementById('threads-cust');
    if (container) {
      showErrorState(container, {
        title: 'Unable to load messages',
        description: 'Please try refreshing the page.',
        actionText: 'Refresh',
        onAction: () => window.location.reload(),
      });
    }
  }
}

// Update unread badge
function updateUnreadBadge(count) {
  const badge = document.getElementById('unreadMessageBadge');
  if (badge) {
    if (count > 0) {
      badge.textContent = `${count} unread`;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
