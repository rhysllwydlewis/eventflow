/**
 * Supplier Messaging Interface
 * Handles displaying conversations for suppliers
 */

import messagingSystem from './messaging.js';

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

// Get user's suppliers
async function getUserSuppliers(userId) {
  try {
    const response = await fetch('/api/me/suppliers');
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error getting user suppliers:', error);
    return [];
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
  const container = document.getElementById('threads-sup');
  if (!container) {
    return;
  }

  if (!conversations || conversations.length === 0) {
    container.innerHTML =
      '<p class="small">No messages yet. Conversations will appear here when customers contact you.</p>';
    return;
  }

  let html = '<div class="thread-list">';

  conversations.forEach(conversation => {
    const customerName = conversation.customerName || 'Customer';
    const lastMessage = conversation.lastMessage || 'No messages yet';
    const lastMessageTime = conversation.lastMessageTime
      ? messagingSystem.formatTimestamp(conversation.lastMessageTime)
      : '';

    html += `
      <div class="thread-item" style="border:1px solid #e4e4e7;padding:1rem;margin-bottom:0.5rem;border-radius:4px;cursor:pointer;transition:background 0.2s;" data-conversation-id="${conversation.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <strong>${escapeHtml(customerName)}</strong>
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
  modal.className = 'modal-overlay';
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
      const isFromSupplier = message.senderType === 'supplier';
      const alignment = isFromSupplier ? 'right' : 'left';
      const bgColor = isFromSupplier ? '#3b82f6' : '#e4e4e7';
      const textColor = isFromSupplier ? '#fff' : '#1a1a1a';

      html += `
        <div style="display:flex;justify-content:${isFromSupplier ? 'flex-end' : 'flex-start'};margin-bottom:1rem;">
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
        senderType: 'supplier',
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
  const user = await getCurrentUser();
  if (!user) {
    const container = document.getElementById('threads-sup');
    if (container) {
      container.innerHTML = '<p class="small">Sign in to view your messages.</p>';
    }
    return;
  }

  // Get user's suppliers
  const suppliers = await getUserSuppliers(user.id);

  if (!suppliers || suppliers.length === 0) {
    const container = document.getElementById('threads-sup');
    if (container) {
      container.innerHTML =
        '<p class="small">Create a supplier profile to receive messages from customers.</p>';
    }
    return;
  }

  // Listen to conversations for all supplier IDs
  const allConversations = [];
  let loadedCount = 0;

  try {
    suppliers.forEach(supplier => {
      messagingSystem.listenToUserConversations(supplier.id, 'supplier', conversations => {
        // Merge conversations
        conversations.forEach(conv => {
          const existingIndex = allConversations.findIndex(c => c.id === conv.id);
          if (existingIndex >= 0) {
            allConversations[existingIndex] = conv;
          } else {
            allConversations.push(conv);
          }
        });

        loadedCount++;

        // Render when all suppliers loaded
        if (loadedCount >= suppliers.length) {
          // Sort by last message time
          allConversations.sort((a, b) => {
            const timeA = a.lastMessageTime?.seconds || 0;
            const timeB = b.lastMessageTime?.seconds || 0;
            return timeB - timeA;
          });

          renderConversations(allConversations);
        }
      });

      // Listen to unread count for this supplier
      messagingSystem.listenToUnreadCount(supplier.id, 'supplier', unreadCount => {
        updateUnreadBadge(unreadCount);
      });
    });
  } catch (error) {
    console.error('Error listening to conversations:', error);
    const container = document.getElementById('threads-sup');
    if (container) {
      container.innerHTML =
        '<p class="small">Unable to load messages. Please try refreshing the page.</p>';
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
