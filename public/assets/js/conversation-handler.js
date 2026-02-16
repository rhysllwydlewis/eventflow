/**
 * Conversation Handler
 * Manages individual conversation view with messaging, attachments, reactions
 */

(function () {
  'use strict';

  let threadId = null;
  let thread = null;
  let messages = [];
  let currentUserId = null;
  let currentUser = null;
  let wsClient = null;
  let recipientId = null;
  let currentAttachments = [];

  // Initialize
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    threadId = urlParams.get('id');
    const draftId = urlParams.get('draft');

    if (!threadId) {
      showError('Invalid conversation ID');
      return;
    }

    // Get current user first
    await loadCurrentUser();

    // Initialize WebSocket for real-time updates
    initializeWebSocket();

    setupEventHandlers();
    setupKeyboardShortcuts();
    await loadThread();
    await loadMessages();

    // Load draft if specified
    if (draftId) {
      await loadDraft(draftId);
    }

    // Auto-refresh messages every 30 seconds (WebSocket handles real-time)
    setInterval(loadMessages, 30000);
  }

  function initializeWebSocket() {
    try {
      if (typeof WebSocketClient === 'undefined') {
        console.warn('WebSocket client not available');
        return;
      }

      wsClient = new WebSocketClient({
        autoConnect: true,
        onConnect: () => {
          console.log('✓ Real-time messaging connected');
          showToast('✓ Connected', 'success');
        },
        onMessage: data => {
          if (data.threadId === threadId) {
            messages.push(data.message);
            renderMessages();

            if (document.hidden) {
              showNotification('New message', data.message.text.substring(0, 50));
            }
          }
        },
        onDisconnect: reason => {
          console.warn('WebSocket disconnected:', reason);
        },
      });

      wsClient.joinRoom(`thread:${threadId}`);

      wsClient.socket?.on('reaction:received', data => {
        const msgIndex = messages.findIndex(m => m.id === data.messageId);
        if (msgIndex !== -1) {
          messages[msgIndex].reactions = data.reactions;
          renderMessages();
        }
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      });
    }
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.getElementById('composerForm');
        if (form && document.activeElement === document.getElementById('messageInput')) {
          e.preventDefault();
          form.dispatchEvent(new Event('submit'));
        }
      }

      if (e.key === 'Escape') {
        const textarea = document.getElementById('messageInput');
        if (textarea && document.activeElement === textarea) {
          textarea.blur();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        const draftBtn = document.getElementById('saveDraftBtn');
        if (draftBtn && document.activeElement === document.getElementById('messageInput')) {
          e.preventDefault();
          draftBtn.click();
        }
      }
    });
  }

  async function loadDraft(draftId) {
    try {
      const response = await fetch('/api/v2/messages/drafts', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load drafts');
      }

      const data = await response.json();
      const draft = data.drafts?.find(d => d.id === draftId);

      if (draft) {
        const textarea = document.getElementById('messageInput');
        if (textarea) {
          textarea.value = draft.text;
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;

          const notice = document.createElement('div');
          notice.style.cssText =
            'background: #fffbeb; border: 1px solid #fbbf24; padding: 12px; border-radius: 8px; margin-bottom: 16px; color: #92400e;';
          notice.textContent = '✏️ Draft loaded. Make changes and send when ready.';
          document.querySelector('.messages-area').insertAdjacentElement('beforebegin', notice);
          setTimeout(() => notice.remove(), 5000);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }

  async function loadCurrentUser() {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        currentUser = data.user;
        currentUserId = data.user?.id;
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  }

  function setupEventHandlers() {
    document.getElementById('composerForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      await sendMessage(false);
    });

    document.getElementById('saveDraftBtn')?.addEventListener('click', async () => {
      await sendMessage(true);
    });

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      loadMessages();
    });

    document.getElementById('exportBtn')?.addEventListener('click', () => {
      exportConversation();
    });

    document.getElementById('archiveBtn')?.addEventListener('click', async () => {
      await archiveConversation();
    });

    document.getElementById('attachBtn')?.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput')?.addEventListener('change', handleFileSelect);

    const textarea = document.getElementById('messageInput');
    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) {
      return;
    }

    const preview = document.getElementById('attachmentPreview');
    preview.style.display = 'block';
    preview.innerHTML = '<div style="display: flex; flex-wrap: wrap; gap: 8px;"></div>';
    const container = preview.firstElementChild;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File ${file.name} is too large (max 10MB)`, 'error');
        continue;
      }

      const reader = new FileReader();
      reader.onload = event => {
        const attachment = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: event.target.result,
        };
        currentAttachments.push(attachment);

        const item = document.createElement('div');
        item.style.cssText =
          'display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: white; border-radius: 4px; font-size: 12px;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${file.name} (${(file.size / 1024).toFixed(1)}KB)`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.style.cssText =
          'background: none; border: none; cursor: pointer; color: #ef4444; padding: 2px;';
        removeBtn.onclick = () => removeAttachment(file.name);

        item.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        `;
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        container.appendChild(item);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  }

  function removeAttachment(name) {
    currentAttachments = currentAttachments.filter(a => a.name !== name);

    const preview = document.getElementById('attachmentPreview');
    if (currentAttachments.length === 0) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    } else {
      preview.innerHTML = '<div style="display: flex; flex-wrap: wrap; gap: 8px;"></div>';
      const container = preview.firstElementChild;

      currentAttachments.forEach(att => {
        const item = document.createElement('div');
        item.style.cssText =
          'display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: white; border-radius: 4px; font-size: 12px;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${att.name} (${(att.size / 1024).toFixed(1)}KB)`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.style.cssText =
          'background: none; border: none; cursor: pointer; color: #ef4444; padding: 2px;';
        removeBtn.onclick = () => removeAttachment(att.name);

        item.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        `;
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        container.appendChild(item);
      });
    }
  }

  async function loadThread() {
    try {
      const response = await fetch(`/api/v2/messages/threads/${threadId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If v2 API returns 404 for a v1 thread ID (thd_*), fallback to v1 API
        if (response.status === 404 && threadId.startsWith('thd_')) {
          const v1Response = await fetch(`/api/v1/threads/${threadId}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!v1Response.ok) {
            throw new Error('Failed to load conversation');
          }

          const v1Data = await v1Response.json();
          thread = v1Data.thread;
        } else {
          throw new Error('Failed to load conversation');
        }
      } else {
        const data = await response.json();
        thread = data.thread;
      }

      // Resolve recipient ID with fallback for v1 and v2 threads
      // v2: participants array (find the other participant)
      // v1: customerId/supplierId/recipientId fields
      if (currentUserId && thread.participants) {
        recipientId = thread.participants.find(p => p !== currentUserId) || null;
      } else if (currentUserId) {
        // For v1 threads, prefer recipientId if available (peer-to-peer)
        if (thread.recipientId && thread.recipientId !== currentUserId) {
          recipientId = thread.recipientId;
        } else if (thread.customerId === currentUserId) {
          recipientId = thread.supplierId || thread.recipientId;
        } else {
          recipientId = thread.customerId;
        }
      }

      renderThreadHeader();
    } catch (error) {
      console.error('Error loading thread:', error);
      showError('Failed to load conversation details');
    }
  }

  async function loadMessages() {
    try {
      const response = await fetch(`/api/v2/messages/${threadId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If v2 API returns 404 for a v1 thread ID (thd_*), fallback to v1 API
        if (response.status === 404 && threadId.startsWith('thd_')) {
          const v1Response = await fetch(`/api/v1/threads/${threadId}/messages`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!v1Response.ok) {
            throw new Error('Failed to load messages');
          }

          const v1Data = await v1Response.json();
          // v1 API returns { items: [...] }, normalize to messages array
          messages = v1Data.messages || v1Data.items || [];

          // Normalize v1 field names to v2 format for consistent rendering
          messages = messages.map(msg => ({
            ...msg,
            // Map fromUserId or userId to senderId for v2 compatibility
            senderId: msg.senderId || msg.fromUserId || msg.userId,
            // Ensure both text and content are available
            content: msg.content || msg.text,
            // Ensure sentAt falls back to createdAt
            sentAt: msg.sentAt || msg.createdAt,
          }));
        } else {
          throw new Error('Failed to load messages');
        }
      } else {
        const data = await response.json();
        messages = data.messages || [];
      }

      renderMessages();

      await markAsRead();
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Failed to load messages');
    }
  }

  async function sendMessage(isDraft) {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text && currentAttachments.length === 0) {
      return;
    }

    const sendBtn = document.getElementById('sendBtn');
    const draftBtn = document.getElementById('saveDraftBtn');
    const originalSendText = sendBtn.innerHTML;

    sendBtn.disabled = true;
    draftBtn.disabled = true;
    sendBtn.innerHTML = `<span class="loading-spinner"></span> ${isDraft ? 'Saving...' : 'Sending...'}`;

    try {
      const response = await fetch(`/api/v2/messages/${threadId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        body: JSON.stringify({
          content: text,
          attachments: currentAttachments,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (!isDraft) {
        messages.push(data.message);
        renderMessages();

        if (wsClient && recipientId) {
          wsClient.sendMessage(threadId, recipientId, data.message);
        }
      }

      input.value = '';
      input.style.height = 'auto';
      currentAttachments = [];
      document.getElementById('attachmentPreview').style.display = 'none';

      if (isDraft) {
        showToast('✓ Draft saved', 'success');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Failed to send message');
    } finally {
      sendBtn.disabled = false;
      draftBtn.disabled = false;
      sendBtn.innerHTML = originalSendText;
    }
  }

  async function markAsRead() {
    try {
      await fetch(`/api/v2/messages/threads/${threadId}/read`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  function renderThreadHeader() {
    if (!thread) {
      return;
    }

    // Resolve other party name with fallback for v1 and v2 threads
    // v1: supplierName/customerName/recipientName fields (check user role to pick the right one)
    // v2: metadata.otherPartyName field
    let otherPartyName = 'Unknown';

    if (currentUserId) {
      // For v1 threads, determine which name to show based on current user's role
      if (thread.customerId === currentUserId) {
        // Current user is the customer, show supplier's name or recipient's name (for peer-to-peer)
        otherPartyName =
          thread.supplierName ||
          thread.recipientName ||
          thread.metadata?.otherPartyName ||
          thread.marketplace?.listingTitle ||
          (thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown');
      } else if (thread.supplierId === currentUserId || thread.recipientId === currentUserId) {
        // Current user is the supplier/recipient, show customer's name
        otherPartyName = thread.customerName || thread.metadata?.otherPartyName || 'Unknown';
      } else {
        // Fallback: try all names, prioritizing supplier name
        otherPartyName =
          thread.supplierName ||
          thread.customerName ||
          thread.recipientName ||
          thread.metadata?.otherPartyName ||
          thread.marketplace?.listingTitle ||
          (thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown');
      }
    } else {
      // No current user ID, fallback to original logic
      otherPartyName =
        thread.supplierName ||
        thread.customerName ||
        thread.recipientName ||
        thread.metadata?.otherPartyName ||
        thread.marketplace?.listingTitle ||
        (thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown');
    }

    const initial = otherPartyName.charAt(0).toUpperCase();

    document.getElementById('conversationAvatar').textContent = initial;
    document.getElementById('conversationName').textContent = otherPartyName;

    if (thread.subject) {
      document.getElementById('conversationSubject').textContent = thread.subject;
    }
  }

  function renderMessages() {
    const container = document.getElementById('messagesArea');

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <h3>No messages yet</h3>
          <p>Start the conversation by sending a message below</p>
        </div>
      `;
      return;
    }

    container.innerHTML = messages
      .map(message => {
        const isSent = message.senderId === currentUserId;
        const senderName = isSent
          ? 'You'
          : thread?.supplierName || thread?.customerName || 'Unknown';
        const initial = senderName.charAt(0).toUpperCase();
        const time = formatTime(message.sentAt || message.createdAt);
        const fullDate = formatFullTimestamp(message.sentAt || message.createdAt);

        const isRead = message.readBy && message.readBy.length > 1;
        const readStatus = isSent ? (isRead ? ' ✓✓' : ' ✓') : '';

        let attachmentsHtml = '';
        if (message.attachments && message.attachments.length > 0) {
          attachmentsHtml =
            '<div class="message-attachments" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">';
          message.attachments.forEach(att => {
            const isImage = att.type && att.type.startsWith('image/');
            if (isImage) {
              attachmentsHtml += `
                <a href="${att.data}" target="_blank" style="max-width: 300px;">
                  <img src="${att.data}" alt="${escapeHtml(att.name)}" style="width: 100%; border-radius: 8px; cursor: pointer;">
                </a>
              `;
            } else {
              attachmentsHtml += `
                <a href="${att.data}" download="${escapeHtml(att.name)}" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,0,0,0.05); border-radius: 6px; text-decoration: none; color: inherit; font-size: 13px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  <span>${escapeHtml(att.name)} (${(att.size / 1024).toFixed(1)}KB)</span>
                </a>
              `;
            }
          });
          attachmentsHtml += '</div>';
        }

        let reactionsHtml = '';
        if (message.reactions && message.reactions.length > 0) {
          const reactionCounts = {};
          message.reactions.forEach(r => {
            reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
          });

          reactionsHtml =
            '<div class="message-reactions" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">';
          Object.entries(reactionCounts).forEach(([emoji, count]) => {
            reactionsHtml += `
              <button data-toggle-reaction="${message.id}" data-emoji="${emoji}" style="padding: 2px 8px; background: rgba(11, 128, 115, 0.1); border: 1px solid rgba(11, 128, 115, 0.3); border-radius: 12px; cursor: pointer; font-size: 13px;">
                ${emoji} ${count}
              </button>
            `;
          });
          reactionsHtml += `
            <button data-show-reaction-picker="${message.id}" title="Add reaction" style="padding: 2px 8px; background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; cursor: pointer; font-size: 13px;">
              ➕
            </button>
          `;
          reactionsHtml += '</div>';
        } else {
          reactionsHtml = `
            <div class="message-reactions" style="margin-top: 6px; display: none;">
              <button data-show-reaction-picker="${message.id}" title="Add reaction" style="padding: 2px 8px; background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; cursor: pointer; font-size: 13px;">
                ➕ React
              </button>
            </div>
          `;
        }

        const shouldShowReactions = message.reactions && message.reactions.length > 0;

        return `
          <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}" data-has-reactions="${shouldShowReactions}">
            <div class="message-avatar">${initial}</div>
            <div class="message-content">
              <div class="message-bubble">
                ${message.text || message.content ? `<div class="message-text">${escapeHtml(message.text || message.content)}</div>` : ''}
                ${attachmentsHtml}
              </div>
              ${reactionsHtml}
              <div class="message-time" title="${fullDate}">${time}${readStatus}</div>
            </div>
          </div>
        `;
      })
      .join('');

    container.scrollTop = container.scrollHeight;

    // Add event delegation for reaction buttons
    container.querySelectorAll('[data-show-reaction-picker]').forEach(btn => {
      btn.addEventListener('click', () => {
        const messageId = btn.getAttribute('data-show-reaction-picker');
        showReactionPicker(messageId);
      });
    });

    container.querySelectorAll('[data-toggle-reaction]').forEach(btn => {
      btn.addEventListener('click', () => {
        const messageId = btn.getAttribute('data-toggle-reaction');
        const emoji = btn.getAttribute('data-emoji');
        toggleReaction(messageId, emoji);
      });
    });

    container.querySelectorAll('.message').forEach(messageEl => {
      const hasReactions = messageEl.getAttribute('data-has-reactions') === 'true';
      const reactionsEl = messageEl.querySelector('.message-reactions');

      if (reactionsEl) {
        messageEl.addEventListener('mouseenter', () => {
          reactionsEl.style.display = 'flex';
        });

        messageEl.addEventListener('mouseleave', () => {
          const isHoveringButton = reactionsEl.querySelector('button:hover');
          if (!hasReactions && !isHoveringButton) {
            reactionsEl.style.display = 'none';
          }
        });
      }
    });
  }

  function formatFullTimestamp(timestamp) {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function exportConversation() {
    if (!thread || messages.length === 0) {
      alert('No messages to export');
      return;
    }

    const otherPartyName = thread.supplierName || thread.customerName || 'Unknown';

    const exportData = {
      conversation: {
        id: thread.id,
        subject: thread.subject || 'No subject',
        participants: {
          customer: thread.customerName,
          supplier: thread.supplierName,
        },
        created: thread.createdAt,
        lastUpdated: thread.updatedAt,
      },
      messages: messages.map(msg => ({
        id: msg.id,
        from: msg.senderId === currentUserId ? 'You' : otherPartyName,
        text: msg.text || msg.content,
        timestamp: msg.sentAt || msg.createdAt,
        formattedTimestamp: formatFullTimestamp(msg.sentAt || msg.createdAt),
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.email || currentUser?.name || 'Unknown',
    };

    function escapeCSV(value) {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      if (str.match(/^[=+\-@]/)) {
        return `"'${str.replace(/"/g, '""')}"`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    }

    const csvLines = [
      'Timestamp,From,Message',
      ...messages.map(msg => {
        const from = msg.senderId === currentUserId ? 'You' : otherPartyName;
        const timestamp = formatFullTimestamp(msg.sentAt || msg.createdAt);
        const text = msg.text || msg.content || '';
        return [escapeCSV(timestamp), escapeCSV(from), escapeCSV(text)].join(',');
      }),
    ];
    const csv = csvLines.join('\n');

    const format = prompt(
      'Export format:\n1. JSON (full data)\n2. CSV (simple table)\n\nEnter 1 or 2:',
      '2'
    );

    if (format === '1') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${thread.id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === '2') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${thread.id}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  async function archiveConversation() {
    if (!thread) {
      alert('No conversation to archive');
      return;
    }

    const isArchived = thread.status === 'archived';
    const action = isArchived ? 'unarchive' : 'archive';
    const confirmMsg = isArchived
      ? 'Are you sure you want to unarchive this conversation?'
      : 'Are you sure you want to archive this conversation?';

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const response = await fetch(`/api/v2/messages/threads/${threadId}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} conversation`);
      }

      alert(`Conversation ${isArchived ? 'unarchived' : 'archived'} successfully!`);

      thread.status = isArchived ? 'open' : 'archived';

      const archiveBtn = document.getElementById('archiveBtn');
      if (archiveBtn) {
        archiveBtn.title = isArchived ? 'Archive conversation' : 'Unarchive conversation';
      }

      setTimeout(() => {
        window.location.href = '/messages.html';
      }, 1000);
    } catch (error) {
      console.error(`Error ${action}ing conversation:`, error);
      alert(`Failed to ${action} conversation. Please try again.`);
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) {
      return '';
    }

    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function showReactionPicker(messageId) {
    const picker = document.createElement('div');
    picker.style.cssText =
      'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 10000; display: flex; gap: 8px; flex-wrap: wrap; max-width: 300px;';

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText =
        'font-size: 28px; padding: 8px; background: none; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: transform 0.2s;';
      btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.2)';
      };
      btn.onmouseleave = () => {
        btn.style.transform = 'scale(1)';
      };
      btn.onclick = () => {
        toggleReaction(messageId, emoji);
        picker.remove();
        overlay.remove();
      };
      picker.appendChild(btn);
    });

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 9999;';
    overlay.onclick = () => {
      overlay.remove();
      picker.remove();
    };

    document.body.appendChild(overlay);
    document.body.appendChild(picker);
  }

  async function toggleReaction(messageId, emoji) {
    try {
      const response = await fetch(`/api/v2/messages/${messageId}/reactions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle reaction');
      }

      const data = await response.json();

      const msgIndex = messages.findIndex(m => m.id === messageId);
      if (msgIndex !== -1) {
        messages[msgIndex].reactions = data.reactions;
        renderMessages();
      }

      if (wsClient && recipientId) {
        wsClient.socket?.emit('reaction:updated', {
          threadId,
          messageId,
          reactions: data.reactions,
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      showToast('Failed to add reaction', 'error');
    }
  }

  function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (wsClient) {
      wsClient.disconnect();
    }
  });
})();
