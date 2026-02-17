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
import { logMessageState } from './utils/dashboard-logger.js';

// Constants
const MESSAGE_PREVIEW_MAX_LENGTH = 100;

// Helper function to extract message text from various field names
function extractMessageText(message) {
  if (!message) {
    return '';
  }
  // Try all possible field names in order of likelihood
  return (
    message.message ||
    message.content ||
    message.text ||
    message.body ||
    message.value ||
    (typeof message === 'string' ? message : '') ||
    '[No message content]'
  );
}

// Helper function to extract message timestamp from various field names
function extractMessageTimestamp(message) {
  if (!message) {
    return null;
  }
  return (
    message.timestamp || message.sentAt || message.createdAt || message.updatedAt || message.date
  );
}

// Helper function to extract sender ID from various field names
function extractSenderId(message) {
  if (!message) {
    return 'unknown';
  }
  return (
    message.senderId || message.userId || message.fromUserId || message.sender?.id || 'unknown'
  );
}

// HTTP fallback for loading messages when real-time fails
async function loadMessagesHTTPFallback(conversationId) {
  try {
    logMessageState('HTTP_FALLBACK_ATTEMPT', { conversationId });

    // Try v2 API first
    let response = await fetch(`/api/v2/messages/${conversationId}`, {
      credentials: 'include',
    });

    // Try v1 API for legacy thread IDs
    if (!response.ok && conversationId.startsWith('thd_')) {
      logMessageState('HTTP_FALLBACK_V1_ATTEMPT', { conversationId });
      response = await fetch(`/api/v1/threads/${conversationId}/messages`, {
        credentials: 'include',
      });
    }

    if (!response.ok) {
      logMessageState('HTTP_FALLBACK_FAILED', {
        conversationId,
        status: response.status,
      });
      return null;
    }

    const data = await response.json();
    const messages = data.messages || data.items || [];
    logMessageState('HTTP_FALLBACK_SUCCESS', {
      conversationId,
      messageCount: messages.length,
    });
    return messages;
  } catch (error) {
    logMessageState('HTTP_FALLBACK_ERROR', { conversationId, error: error.message });
    console.error('HTTP fallback failed:', error);
    return null;
  }
}

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
function formatMessagePreview(
  messageText,
  lastMessageSenderId,
  currentUserId,
  maxLength = MESSAGE_PREVIEW_MAX_LENGTH
) {
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
    return `${fullText.substring(0, maxLength)}...`;
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
    // Defensive: Skip invalid conversation objects
    if (!conversation || typeof conversation !== 'object') {
      console.warn('Skipping invalid conversation:', conversation);
      return;
    }

    // Defensive: Skip conversations without IDs
    if (!conversation.id) {
      console.warn('Skipping conversation without ID:', conversation);
      return;
    }

    const customerName = conversation.customerName || 'Customer';

    // Format preview with "You:" prefix if current user sent last message
    const lastMessageText = conversation.lastMessage || conversation.lastMessageText || '';
    const lastMessageSenderId = conversation.lastMessageSenderId || '';
    const currentUserId = currentUser?.id || '';
    const lastMessage = formatMessagePreview(
      lastMessageText,
      lastMessageSenderId,
      currentUserId,
      MESSAGE_PREVIEW_MAX_LENGTH
    );

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
  // Validate conversationId
  if (!conversationId) {
    console.error('Cannot open conversation: conversationId is missing');
    if (typeof EFToast !== 'undefined') {
      EFToast.error('Unable to open conversation. Please try again.');
    }
    return;
  }

  console.log('Opening conversation:', conversationId);

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
        <form id="sendMessageForm" style="display:flex;gap:0.75rem;width:100%;flex-wrap:wrap;">
          <textarea id="messageInput" placeholder="Type your message..." rows="2" style="flex:1;resize:none;min-width:0;"></textarea>
          
          <!-- File input (hidden) -->
          <input type="file" id="attachmentInput" multiple style="display:none;" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"/>
          
          <!-- Attachment button -->
          <button type="button" id="attachmentBtn" class="btn btn-secondary" style="align-self:flex-end;padding:0.75rem;border:none;background:#f3f4f6;color:#6b7280;cursor:pointer;transition:background-color 0.2s,color 0.2s;" title="Attach files" aria-label="Attach files">
            📎
          </button>
          
          <!-- Send button -->
          <button type="submit" class="btn btn-primary" style="align-self:flex-end;padding:0.75rem 1.5rem;">Send</button>
        </form>
        
        <!-- Selected attachments preview -->
        <div id="attachmentsPreview" style="display:none;margin-top:0.75rem;padding:0.75rem;background:#f9fafb;border-radius:6px;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Store the element that opened the modal for focus restoration
  const previouslyFocusedElement = document.activeElement;

  // Load messages with real-time updates
  let messagesUnsubscribe = null;
  let currentUser = null;
  const cleanupCallbacks = []; // Array to store cleanup functions

  // Close handler with cleanup support
  const closeModal = () => {
    // Run all cleanup callbacks
    cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    });

    // Cleanup message subscription
    if (messagesUnsubscribe) {
      messagesUnsubscribe();
    }

    // Remove modal from DOM
    modal.remove();

    // Restore focus to the element that opened the modal
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
    }
  };

  // Attach close button handler with defensive check
  const closeButton = modal.querySelector('.modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', e => {
      e.stopPropagation(); // Prevent event from bubbling to overlay
      closeModal();
    });
  } else {
    console.error('Modal close button not found');
  }

  // Close when clicking outside the modal
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close modal with Escape key
  const handleEscapeKey = e => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeModal();
    }
  };
  document.addEventListener('keydown', handleEscapeKey);

  // Register cleanup for escape key listener
  cleanupCallbacks.push(() => {
    document.removeEventListener('keydown', handleEscapeKey);
  });

  // Set initial focus to message input for better UX
  setTimeout(() => {
    const messageInput = modal.querySelector('#messageInput');
    if (messageInput) {
      messageInput.focus();
    }
  }, 100);

  const renderMessages = messages => {
    try {
      const container = document.getElementById('conversationMessages');
      if (!container) {
        console.warn('conversationMessages container not found');
        return;
      }

      if (!messages || messages.length === 0) {
        container.innerHTML =
          '<p class="small" style="text-align:center;color:#6b7280;">No messages yet. Start the conversation!</p>';
        return;
      }

      let html = '<div class="messages-list" style="display:flex;flex-direction:column;gap:1rem;">';
      let renderedCount = 0;

      messages.forEach((message, index) => {
        try {
          // Defensive handling for message data
          if (!message || typeof message !== 'object') {
            console.warn(`Skipping invalid message at index ${index}:`, message);
            return;
          }

          const messageId = message.id || message._id || `msg-${index}`;
          const messageContent = extractMessageText(message);

          if (!messageContent) {
            console.warn(`Message ${messageId} has no content`, message);
            return;
          }

          const timestamp = extractMessageTimestamp(message);
          const formattedTime = timestamp
            ? messagingSystem.formatFullTimestamp(timestamp)
            : 'Unknown time';

          const senderId = extractSenderId(message);
          const isFromSupplier = message.senderType === 'supplier' || senderId === currentUser?.id;
          const bubbleClass = isFromSupplier ? 'message-bubble--sent' : 'message-bubble--received';
          const alignStyle = isFromSupplier ? 'margin-left:auto;' : 'margin-right:auto;';
          const senderName = isFromSupplier ? 'You' : message.senderName || 'Other';

          html += `
            <div class="message-bubble ${bubbleClass}" style="${alignStyle}" data-message-id="${messageId}">
              <div class="message-sender">${escapeHtml(senderName)}</div>
              <p style="margin:0;word-wrap:break-word;line-height:1.5;">${escapeHtml(messageContent)}</p>
              <div class="message-time">${formattedTime}</div>
            </div>
          `;

          renderedCount++;
        } catch (msgError) {
          console.warn(`Error rendering message ${index}:`, msgError, message);
          // Continue with next message - individual errors won't stop rendering
        }
      });

      if (renderedCount === 0) {
        container.innerHTML =
          '<p class="small" style="text-align:center;color:#6b7280;">No valid messages to display.</p>';
        return;
      }

      html += '</div>';
      container.innerHTML = html;

      logMessageState('RENDER_COMPLETE', {
        count: renderedCount,
        htmlLength: html.length,
      });

      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error('Critical error in renderMessages:', error);
      logMessageState('RENDER_ERROR', { error: error.message });
      const container = document.getElementById('conversationMessages');
      if (container) {
        container.innerHTML =
          '<p style="color:#ef4444;text-align:center;">Error displaying messages. Please try refreshing.</p>';
      }
    }
  };

  // Get current user and set up listener
  getCurrentUser().then(async user => {
    if (!user) {
      const container = document.getElementById('conversationMessages');
      if (container) {
        container.innerHTML =
          '<p class="small" style="text-align:center;color:#ef4444;">Please sign in to view messages.</p>';
      }
      console.error('User not authenticated when opening conversation');
      return;
    }
    currentUser = user;

    logMessageState('INIT', { conversationId, userId: currentUser.id });

    let messagesLoaded = false;
    let retryCount = 0;
    const maxRetries = 2;
    let timeoutId = null;

    // Listen to messages with error handling
    try {
      logMessageState('LISTENER_SETUP', { conversationId });

      messagesUnsubscribe = messagingSystem.listenToMessages(conversationId, messages => {
        if (messages && messages.length > 0) {
          messagesLoaded = true;
          retryCount = 0; // Reset retry on success
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          logMessageState('MESSAGES_RECEIVED', {
            count: messages.length,
            firstMessage: messages[0],
          });
          renderMessages(messages);
        }
      });

      // Set 3-second timeout to trigger fallback if real-time doesn't deliver
      timeoutId = setTimeout(async () => {
        if (!messagesLoaded && retryCount < maxRetries) {
          retryCount++;
          logMessageState('FALLBACK_TRIGGERED', {
            reason: 'real-time timeout',
            conversationId,
            attempt: retryCount,
          });
          console.log(`Real-time timeout (attempt ${retryCount}), trying HTTP fallback...`);

          const httpMessages = await loadMessagesHTTPFallback(conversationId);
          if (httpMessages && httpMessages.length > 0) {
            messagesLoaded = true;
            renderMessages(httpMessages);
          } else if (retryCount >= maxRetries) {
            // Final fallback: show error
            logMessageState('ALL_FALLBACKS_FAILED', { conversationId, retryCount });
            const container = document.getElementById('conversationMessages');
            if (container) {
              container.innerHTML =
                '<p style="color:#ef4444;text-align:center;">Unable to load messages. Please refresh and try again.</p>';
            }
          }
        }
      }, 3000);
    } catch (error) {
      console.error('Error setting up message listener:', error);
      logMessageState('LISTENER_ERROR', { conversationId, error: error.message });

      // Immediately try HTTP fallback on error
      const httpMessages = await loadMessagesHTTPFallback(conversationId);
      if (httpMessages && httpMessages.length > 0) {
        renderMessages(httpMessages);
      } else {
        const container = document.getElementById('conversationMessages');
        if (container) {
          container.innerHTML =
            '<p class="small" style="text-align:center;color:#ef4444;">Unable to load messages. Please try again.</p>';
        }
      }
      if (typeof EFToast !== 'undefined') {
        EFToast.error('Failed to load conversation');
      }
      return;
    }

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

    // Register cleanup for typing listener
    cleanupCallbacks.push(() => {
      window.removeEventListener('messaging:typing', handleTyping);
    });

    // Mark messages as read
    messagingSystem.markMessagesAsRead(conversationId, user.id).catch(err => {
      console.error('Error marking messages as read:', err);
    });
  });

  // File attachment handling
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
  const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total
  let selectedFiles = [];

  const attachmentBtn = modal.querySelector('#attachmentBtn');
  const attachmentInput = modal.querySelector('#attachmentInput');
  const previewContainer = modal.querySelector('#attachmentsPreview');

  // Click button to open file picker
  if (attachmentBtn && attachmentInput) {
    // Add hover effect
    attachmentBtn.addEventListener('mouseenter', () => {
      attachmentBtn.style.background = '#e5e7eb';
      attachmentBtn.style.color = '#374151';
    });
    attachmentBtn.addEventListener('mouseleave', () => {
      attachmentBtn.style.background = '#f3f4f6';
      attachmentBtn.style.color = '#6b7280';
    });

    attachmentBtn.addEventListener('click', () => attachmentInput.click());

    // Handle file selection
    attachmentInput.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      const validFiles = [];
      let totalSize = 0;

      // Note: This replaces previous selection (standard file input behavior)
      // Users can remove individual files from preview and reselect if needed
      // Validate each file and calculate total size
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          if (typeof EFToast !== 'undefined') {
            EFToast.warning(`File ${file.name} is too large (max 10MB)`);
          }
          continue;
        }

        const newTotal = totalSize + file.size;
        if (newTotal > MAX_TOTAL_SIZE) {
          if (typeof EFToast !== 'undefined') {
            EFToast.warning(
              `Adding ${file.name} would exceed 25MB total limit. Some files were not added.`
            );
          }
          break; // Stop adding more files
        }

        validFiles.push(file);
        totalSize = newTotal;
      }

      // Replace selectedFiles with valid files from this selection
      selectedFiles = validFiles;
      updateAttachmentsPreview();

      // Reset input to allow selecting the same file again if needed
      attachmentInput.value = '';
    });
  }

  function updateAttachmentsPreview() {
    if (!previewContainer) {
      return;
    }

    if (selectedFiles.length === 0) {
      previewContainer.style.display = 'none';
      return;
    }

    previewContainer.style.display = 'block';
    previewContainer.innerHTML = selectedFiles
      .map(
        (file, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;background:white;border-radius:6px;margin-bottom:0.5rem;border:1px solid #e5e7eb;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);">
        <span style="font-size:0.875rem;color:#374151;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:0.5rem;">${escapeHtml(file.name)}</span>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
          <span style="font-size:0.75rem;color:#6b7280;white-space:nowrap;">${(file.size / 1024 / 1024).toFixed(1)}MB</span>
          <button type="button" class="remove-attachment-btn" data-index="${idx}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.25rem;line-height:1;padding:0.25rem;transition:color 0.2s;" title="Remove file" aria-label="Remove ${escapeHtml(file.name)}">✕</button>
        </div>
      </div>
    `
      )
      .join('');

    // Add event listeners for remove buttons
    previewContainer.querySelectorAll('.remove-attachment-btn').forEach(btn => {
      // Add hover effect
      btn.addEventListener('mouseenter', () => {
        btn.style.color = '#dc2626';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.color = '#ef4444';
      });

      btn.addEventListener('click', e => {
        const index = parseInt(e.target.getAttribute('data-index'));
        selectedFiles.splice(index, 1);
        updateAttachmentsPreview();
        if (attachmentInput) {
          attachmentInput.value = '';
        }
      });
    });
  }

  // Send message form
  modal.querySelector('#sendMessageForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!currentUser) {
      if (typeof EFToast !== 'undefined') {
        EFToast.error('Please sign in to send messages');
      }
      return;
    }

    const messageInput = modal.querySelector('#messageInput');
    const messageText = messageInput.value.trim();

    if (!messageText && selectedFiles.length === 0) {
      return;
    }

    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      // If there are attachments, use FormData
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append('conversationId', conversationId);
        formData.append('senderId', currentUser.id);
        formData.append('senderType', 'supplier');
        formData.append('senderName', currentUser.name || currentUser.email);

        // Only append message if there is text content
        if (messageText) {
          formData.append('message', messageText);
        }

        selectedFiles.forEach(file => {
          formData.append('attachments', file);
        });

        const response = await fetch('/api/v2/messages', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
          },
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        }

        selectedFiles = [];
        updateAttachmentsPreview();
        if (attachmentInput) {
          attachmentInput.value = '';
        }
      } else {
        // No attachments, use regular sendMessage
        await messagingSystem.sendMessage(conversationId, {
          senderId: currentUser.id,
          senderType: 'supplier',
          senderName: currentUser.name || currentUser.email,
          message: messageText,
        });
      }

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

  // Register cleanup for typing timeout
  cleanupCallbacks.push(() => {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
  });
}

// Initialize
async function init() {
  const container = document.getElementById('threads-sup');
  if (!container) {
    return;
  }

  // Validate MessagingSystem is ready (check module-scoped import, not window)
  if (!messagingSystem || typeof messagingSystem.listenToMessages !== 'function') {
    logMessageState('SYSTEM_NOT_READY', {
      hasMessagingSystem: !!messagingSystem,
      hasListenToMessages: typeof messagingSystem?.listenToMessages === 'function',
    });
    showErrorState(container, {
      icon: '⚠️',
      title: 'System not ready',
      description: 'Messaging system initialization failed. Please refresh the page.',
      actionText: 'Refresh',
      actionHref: window.location.href,
    });
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
