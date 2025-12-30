/**
 * Customer Messaging Interface
 * Handles displaying conversations for customers
 */

import messagingSystem from './messaging.js';
import { getListItemSkeletons, showEmptyState, showErrorState } from './utils/skeleton-loader.js';

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });
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
      description: 'Start a conversation by contacting a supplier.',
      actionText: 'Browse Suppliers',
      actionHref: '/suppliers.html',
    });
    return;
  }

  let html = '<div class="thread-list" style="display:flex;flex-direction:column;gap:0.75rem;">';

  conversations.forEach(conversation => {
    const supplierName = conversation.supplierName || 'Supplier';
    const lastMessage = conversation.lastMessage || 'No messages yet';
    const lastMessageTime = conversation.lastMessageTime
      ? messagingSystem.formatTimestamp(conversation.lastMessageTime)
      : '';
    const unreadCount = conversation.unreadCount || 0;
    const unreadBadge =
      unreadCount > 0
        ? `<span class="badge badge-info" style="background:#DBEAFE;color:#1E40AF;padding:4px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">${unreadCount} unread</span>`
        : '';

    html += `
      <div class="thread-item" style="border:1px solid #E7EAF0;padding:1.25rem;border-radius:12px;cursor:pointer;transition:all 0.2s;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.05);" data-conversation-id="${conversation.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.75rem;gap:1rem;">
          <strong style="font-size:1.05rem;color:#0B1220;flex:1;">${escapeHtml(supplierName)}</strong>
          <div style="display:flex;gap:0.75rem;align-items:center;flex-shrink:0;">
            ${unreadBadge}
            <span class="small" style="color:#9ca3af;font-size:0.85rem;white-space:nowrap;">${lastMessageTime}</span>
          </div>
        </div>
        <p class="small" style="margin:0;color:#6b7280;line-height:1.5;font-size:0.9rem;">${escapeHtml(lastMessage.substring(0, 100))}${lastMessage.length > 100 ? '...' : ''}</p>
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
      this.style.background = '#F9FAFB';
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    });
    item.addEventListener('mouseleave', function () {
      this.style.background = '#fff';
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    });
  });
}

// Open conversation modal
function openConversation(conversationId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal" style="max-width:600px;height:80vh;display:flex;flex-direction:column;background:#fff;color:#0B1220;">
      <div class="modal-header" style="background:#fff;color:#0B1220;border-bottom:1px solid #E7EAF0;">
        <h3 class="modal-title" style="color:#0B1220;">Conversation</h3>
        <button class="modal-close" type="button" aria-label="Close" style="color:#667085;">&times;</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto;padding:1.5rem;background:#fff;">
        <div id="conversationMessages"><p class="small" style="color:#667085;">Loading...</p></div>
      </div>
      <div class="modal-footer" style="padding:1.5rem;border-top:1px solid #E7EAF0;background:#fff;">
        <form id="sendMessageForm" style="display:flex;gap:0.75rem;width:100%;">
          <textarea id="messageInput" placeholder="Type your message..." rows="2" style="flex:1;padding:0.75rem;border:1px solid #E7EAF0;border-radius:8px;resize:none;font-family:inherit;font-size:0.95rem;background:#fff;color:#0B1220;" required></textarea>
          <button type="submit" class="cta" style="align-self:flex-end;white-space:nowrap;">Send</button>
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
      container.innerHTML =
        '<p class="small" style="color:#667085;">No messages yet. Start the conversation!</p>';
      return;
    }

    let html =
      '<div class="messages-list" style="display:flex;flex-direction:column;gap:0.75rem;">';

    messages.forEach(message => {
      const timestamp = messagingSystem.formatFullTimestamp(message.timestamp);
      const isFromCustomer = message.senderType === 'customer';
      const bgColor = isFromCustomer ? '#0B8073' : '#F3F4F6';
      const textColor = isFromCustomer ? '#fff' : '#1F2937';

      html += `
        <div style="display:flex;justify-content:${isFromCustomer ? 'flex-end' : 'flex-start'};margin-bottom:0.5rem;">
          <div style="max-width:75%;padding:0.875rem 1rem;background:${bgColor};color:${textColor};border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight:600;margin-bottom:0.375rem;font-size:0.8rem;opacity:0.9;">${escapeHtml(message.senderName || 'Unknown')}</div>
            <p style="margin:0;word-wrap:break-word;line-height:1.5;">${escapeHtml(message.message)}</p>
            <div style="margin-top:0.375rem;font-size:0.75rem;opacity:0.8;">${timestamp}</div>
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

  // Listen to conversations for the customer
  try {
    messagingSystem.listenToUserConversations(user.id, 'customer', conversations => {
      renderConversations(conversations);
    });

    // Listen to unread count with error handling
    try {
      messagingSystem.listenToUnreadCount(user.id, 'customer', unreadCount => {
        updateUnreadBadge(unreadCount);
      });
    } catch (unreadError) {
      console.error('Error setting up unread count listener:', unreadError);
      // Non-critical - badge won't update but messages still work
    }
  } catch (error) {
    console.error('Error listening to conversations:', error);
    showErrorState(container, {
      title: 'Unable to load messages',
      description: 'Please try refreshing the page.',
      actionText: 'Refresh',
      onAction: () => window.location.reload(),
    });
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
