/**
 * Supplier Messaging Interface
 * Handles displaying conversations for suppliers
 */

import messagingSystem, { MessagingManager } from './messaging.js';
import { getListItemSkeletons, showEmptyState, showErrorState } from './utils/skeleton-loader.js';
import {
  getLeadQualityBadge,
  calculateLeadQuality,
  filterThreadsByQualityLevel,
} from './utils/lead-quality-helper.js';

// Constants
const MESSAGE_PREVIEW_MAX_LENGTH = 100;

// Initialize messaging manager
const messagingManager = new MessagingManager();

// Get current user
async function getCurrentUser() {
  try {
    const response = await fetch('/api/v1/auth/me', {
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

// Get user's suppliers
async function getUserSuppliers() {
  try {
    const response = await fetch('/api/v1/me/suppliers');
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

// Get supplier profile for quality scoring
async function getSupplierProfile() {
  try {
    const response = await fetch('/api/v1/me/suppliers');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const suppliers = data.items || [];
    return suppliers.length > 0 ? suppliers[0] : null;
  } catch (error) {
    console.error('Error getting supplier profile:', error);
    return null;
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Format message preview with "You:" prefix for outbound messages
function formatMessagePreview(messageText, lastMessageSenderId, currentUserId, maxLength = MESSAGE_PREVIEW_MAX_LENGTH) {
  if (!messageText || messageText === 'No messages yet') {
    return 'No messages yet';
  }
  
  // Trim and clean the text
  const cleanText = messageText.trim();
  
  // Add "You:" prefix if the current user sent the last message
  const prefix = lastMessageSenderId === currentUserId ? 'You: ' : '';
  const fullText = prefix + cleanText;
  
  // Clamp to maxLength with ellipsis
  if (fullText.length > maxLength) {
    return fullText.substring(0, maxLength) + '...';
  }
  
  return fullText;
}

// Render conversations with quality badges, sorting, and filtering
function renderConversations(conversations, supplierProfile = null, currentUser = null) {
  const container = document.getElementById('threads-sup');
  if (!container) {
    return;
  }

  // Ensure badges CSS is loaded
  if (!document.getElementById('badges-css')) {
    const link = document.createElement('link');
    link.id = 'badges-css';
    link.rel = 'stylesheet';
    link.href = '/assets/css/badges.css';
    document.head.appendChild(link);
  }

  if (!conversations || conversations.length === 0) {
    showEmptyState(container, {
      icon: '💬',
      title: 'No messages yet',
      description: 'Conversations will appear here when customers contact you.',
    });
    return;
  }

  // Calculate quality scores for all conversations
  const conversationsWithQuality = conversations.map(conv => {
    const quality = calculateLeadQuality(conv, supplierProfile || {});
    return { ...conv, qualityScore: quality };
  });

  // Get current filter and sort state
  const currentFilter = container.dataset.qualityFilter || 'all';
  const currentSort = container.dataset.qualitySort || 'desc';

  // Filter conversations
  const filteredConversations = filterThreadsByQualityLevel(
    conversationsWithQuality,
    currentFilter
  );

  // Sort by quality score (always by quality now)
  filteredConversations.sort((a, b) => {
    return currentSort === 'desc'
      ? b.qualityScore.score - a.qualityScore.score
      : a.qualityScore.score - b.qualityScore.score;
  });

  let html = `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
      <select id="quality-filter" class="form-control" style="width: auto; padding: 0.5rem; font-size: 0.875rem;">
        <option value="all" ${currentFilter === 'all' ? 'selected' : ''}>All Quality Levels</option>
        <option value="Hot" ${currentFilter === 'Hot' ? 'selected' : ''}>🔥 Hot (80+)</option>
        <option value="High" ${currentFilter === 'High' ? 'selected' : ''}>⭐ High (60-79)</option>
        <option value="Good" ${currentFilter === 'Good' ? 'selected' : ''}>✓ Good (40-59)</option>
        <option value="Low" ${currentFilter === 'Low' ? 'selected' : ''}>◯ Low (&lt;40)</option>
      </select>
      <button id="sort-quality" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;" data-sort="${currentSort}">
        Sort: ${currentSort === 'desc' ? 'Highest First ↓' : 'Lowest First ↑'}
      </button>
    </div>
    <div class="thread-list">
  `;

  filteredConversations.forEach(conversation => {
    const customerName = conversation.customerName || 'Customer';
    
    // Format preview with "You:" prefix if current user sent last message  
    const lastMessageText = conversation.lastMessage || conversation.lastMessageText || '';
    const lastMessageSenderId = conversation.lastMessageSenderId || '';
    const currentUserId = currentUser?.id || '';
    const lastMessage = formatMessagePreview(lastMessageText, lastMessageSenderId, currentUserId, MESSAGE_PREVIEW_MAX_LENGTH);
    
    const lastMessageTime = conversation.lastMessageTime
      ? messagingSystem.formatTimestamp(conversation.lastMessageTime)
      : '';
    const unreadCount = conversation.unreadCount || 0;
    const isUnread = unreadCount > 0;
    // Use new quality badge
    const leadQualityBadge = getLeadQualityBadge(conversation.qualityScore);

    html += `
      <div class="thread-item ${isUnread ? 'unread' : ''}" style="border:1px solid ${isUnread ? '#0B8073' : '#e4e4e7'};padding:1rem;margin-bottom:0.5rem;border-radius:4px;cursor:pointer;transition:background 0.2s;background:${isUnread ? 'rgba(240, 249, 248, 0.95)' : 'white'};" data-conversation-id="${conversation.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <strong>${escapeHtml(customerName)}</strong>
            ${leadQualityBadge}
            ${isUnread && unreadCount > 0 ? `<span class="glass-badge" style="display:inline-flex;align-items:center;background:rgba(11, 128, 115, 0.15);backdrop-filter:blur(4px);border:1px solid rgba(11, 128, 115, 0.25);border-radius:9999px;padding:0.25rem 0.5rem;font-size:0.75rem;font-weight:600;color:#0B8073;">${unreadCount}</span>` : ''}
          </div>
          <span class="small" style="color:#9ca3af;">${lastMessageTime}</span>
        </div>
        <p class="small" style="margin:0;color:${isUnread ? '#1f2937' : '#6b7280'};font-weight:${isUnread ? '500' : '400'};">${escapeHtml(lastMessage)}</p>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Add filter handler
  const filterSelect = document.getElementById('quality-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', e => {
      container.dataset.qualityFilter = e.target.value;
      renderConversations(conversations, supplierProfile, currentUser);
    });
  }

  // Add sort handler
  const sortBtn = document.getElementById('sort-quality');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      const newSort = sortBtn.dataset.sort === 'desc' ? 'asc' : 'desc';
      container.dataset.qualitySort = newSort;
      sortBtn.dataset.sort = newSort;
      renderConversations(conversations, supplierProfile, currentUser);
    });
  }

  // Add click handlers to thread items
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
  modal.className = 'modal-overlay modal-overlay--glass active';
  modal.innerHTML = `
    <div class="modal modal--glass" style="max-width:600px;height:80vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <h3 class="modal-title">Conversation</h3>
        <button class="modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto;padding:1.5rem;">
        <div id="conversationMessages"><p class="small">Loading...</p></div>
        <div id="typingIndicatorContainer" style="min-height:24px;padding:0.5rem 0;"></div>
      </div>
      <div class="modal-footer" style="padding:1.5rem;">
        <form id="sendMessageForm" style="display:flex;gap:0.75rem;width:100%;">
          <textarea id="messageInput" placeholder="Type your message..." rows="2" style="flex:1;resize:none;" required></textarea>
          <button type="submit" class="btn btn-primary" style="align-self:flex-end;padding:0.75rem 1.5rem;">Send</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  let closeModal = () => {
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
      container.innerHTML = '<p class="small" style="text-align:center;color:#6b7280;">No messages yet. Start the conversation!</p>';
      return;
    }

    let html = '<div class="messages-list" style="display:flex;flex-direction:column;gap:1rem;">';

    messages.forEach(message => {
      const timestamp = messagingSystem.formatFullTimestamp(message.timestamp);
      const isFromSupplier = message.senderType === 'supplier';
      const bubbleClass = isFromSupplier ? 'message-bubble--sent' : 'message-bubble--received';
      const alignStyle = isFromSupplier ? 'margin-left:auto;' : 'margin-right:auto;';

      html += `
        <div class="message-bubble ${bubbleClass}" style="${alignStyle}">
          <div class="message-sender">${escapeHtml(message.senderName || 'Unknown')}</div>
          <p style="margin:0;word-wrap:break-word;line-height:1.5;">${escapeHtml(message.message)}</p>
          <div class="message-time">${timestamp}</div>
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

    // Set up typing indicator
    const typingIndicator = messagingManager.createTypingIndicator('#typingIndicatorContainer');

    // Listen for typing status updates
    const handleTyping = event => {
      const { conversationId: typingConvId, userId, isTyping } = event.detail;

      // Only show typing for this conversation and not for current user
      if (typingConvId === conversationId && userId !== user.id) {
        if (isTyping && typingIndicator) {
          messagingManager.showTypingIndicator(typingIndicator, 'Customer');
        } else if (typingIndicator) {
          messagingManager.hideTypingIndicator(typingIndicator);
        }
      }
    };

    window.addEventListener('messaging:typing', handleTyping);

    // Cleanup typing listener when modal closes
    const originalCloseModal = closeModal;
    closeModal = () => {
      window.removeEventListener('messaging:typing', handleTyping);
      originalCloseModal();
    };

    // Mark messages as read
    messagingSystem.markMessagesAsRead(conversationId, user.id).catch(err => {
      console.error('Error marking messages as read:', err);
    });
  });

  // Send message form
  modal.querySelector('#sendMessageForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!currentUser) {
      if (typeof EFToast !== 'undefined') {
        EFToast.error('Please sign in to send messages');
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

      // Stop typing indicator when message sent
      messagingSystem.sendTypingStatus(conversationId, false);
    } catch (error) {
      console.error('Error sending message:', error);
      if (typeof EFToast !== 'undefined') {
        EFToast.error(`Failed to send message: ${error.message}`);
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    }
  });

  // Send typing indicator when user types
  const messageInput = modal.querySelector('#messageInput');
  let typingTimeout = null;

  messageInput.addEventListener('input', () => {
    if (currentUser && conversationId) {
      messagingSystem.sendTypingStatus(conversationId, true);

      // Stop typing after user stops typing for 2 seconds
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        messagingSystem.sendTypingStatus(conversationId, false);
      }, 2000);
    }
  });

  messageInput.addEventListener('blur', () => {
    // Stop typing when input loses focus
    if (currentUser && conversationId) {
      messagingSystem.sendTypingStatus(conversationId, false);
    }
  });
}

// Initialize
async function init() {
  const container = document.getElementById('threads-sup');
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
      description: 'Log in to see your customer conversations.',
      actionText: 'Sign In',
      actionHref: '/auth.html',
    });
    return;
  }

  // Get user's suppliers and profile
  const suppliers = await getUserSuppliers(user.id);
  const supplierProfile = await getSupplierProfile();

  if (!suppliers || suppliers.length === 0) {
    showEmptyState(container, {
      icon: '🏢',
      title: 'No supplier profile yet',
      description: 'Create a supplier profile to receive messages from customers.',
    });
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
          // Sort by last message time initially
          allConversations.sort((a, b) => {
            const timeA = a.lastMessageTime?.seconds || 0;
            const timeB = b.lastMessageTime?.seconds || 0;
            return timeB - timeA;
          });

          renderConversations(allConversations, supplierProfile, user);
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
