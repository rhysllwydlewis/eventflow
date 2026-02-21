/**
 * conversation-handler.js
 * Client-side handler for legacy v1 conversation/thread pages.
 *
 * Supports a graceful v1→v4 migration:
 *  - Legacy "thd_*" thread IDs fall back to the v1 REST API.
 *  - New conversation IDs use the v4 Messenger API.
 *  - Participants array is normalised from v1 customerId/recipientId fields.
 *  - Messages are normalised from v1 field names to v2-compatible names.
 */

'use strict';

(function () {
  const params = new URLSearchParams(window.location.search);
  const threadId = params.get('id') || '';
  const currentUserId = window.__CURRENT_USER_ID__ || null;

  let thread = null;
  let messages = [];

  // ---------------------------------------------------------------------------
  // Thread loading
  // ---------------------------------------------------------------------------

  async function loadThread() {
    try {
      let data;

      if (threadId.startsWith('thd_')) {
        // Legacy v1 thread – fall back to v1 API
        const res = await fetch(`/api/v1/threads/${threadId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`Failed to load thread: ${res.status}`);
        }
        data = await res.json();
      } else {
        // Modern v4 thread
        const res = await fetch(`/api/v4/messenger/conversations/${threadId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`Failed to load conversation: ${res.status}`);
        }
        data = await res.json();
      }

      thread = data.thread || data.conversation || data;

      // Normalize participants array for v1 threads
      if (!thread.participants || !Array.isArray(thread.participants)) {
        const participants = [];
        if (thread.customerId) {
          participants.push(thread.customerId);
        }
        if (thread.recipientId && thread.recipientId !== thread.customerId) {
          participants.push(thread.recipientId);
        }
        thread.participants = participants.filter(Boolean);
      }

      // For peer-to-peer threads, track the other party's userId
      if (thread.recipientId && thread.recipientId !== currentUserId) {
        const recipientId = thread.recipientId;
        thread._peerRecipientId = recipientId;
      }

      renderThreadHeader();
    } catch (err) {
      console.error('[conversation-handler] loadThread error:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Message loading
  // ---------------------------------------------------------------------------

  async function loadMessages() {
    try {
      let data;

      if (threadId.startsWith('thd_')) {
        // Legacy v1 messages – fall back to v1 API
        const res = await fetch(`/api/v1/threads/${threadId}/messages`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`Failed to load messages: ${res.status}`);
        }
        const v1Data = await res.json();
        messages = v1Data.messages || v1Data.items || [];

        // Normalize v1 message fields to v2-compatible format
        messages = messages.map(msg => ({
          ...msg,
          senderId: msg.senderId || msg.fromUserId || msg.userId,
          content: msg.content || msg.text,
          sentAt: msg.sentAt || msg.createdAt,
        }));
      } else {
        // Modern v4 messages
        const res = await fetch(`/api/v4/messenger/conversations/${threadId}/messages`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`Failed to load messages: ${res.status}`);
        }
        data = await res.json();
        messages = data.messages || data || [];

        // If v4 returns empty array but thread ID looks like a legacy thread,
        // fall back to v1 to check for migrated messages
        if (messages.length === 0 && threadId.startsWith('thd_')) {
          try {
            const v1Response = await fetch(`/api/v1/threads/${threadId}/messages`, {
              credentials: 'include',
            });
            // If v1 also fails or returns empty, we simply keep the empty array
            if (v1Response.ok) {
              const v1Data = await v1Response.json();
              messages = v1Data.messages || v1Data.items || [];
              if (messages.length > 0) {
                messages = messages.map(msg => ({
                  ...msg,
                  senderId: msg.senderId || msg.fromUserId || msg.userId,
                  content: msg.content || msg.text,
                  sentAt: msg.sentAt || msg.createdAt,
                }));
              }
            }
          } catch (fallbackErr) {
            console.warn('[conversation-handler] v1 message fallback failed:', fallbackErr.message);
          }
        }
      }

      renderMessages();
    } catch (err) {
      console.error('[conversation-handler] loadMessages error:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  function resolveOtherPartyName() {
    if (!thread) {
      return 'Unknown';
    }

    if (!currentUserId) {
      // No current user ID, fallback to original logic
      return (
        thread.supplierName ||
        thread.recipientName ||
        thread.marketplace?.listingTitle ||
        (thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown')
      );
    }

    // For peer-to-peer: recipientId is the other party's userId
    // (Do NOT use thread.supplierId – that's a supplier DB record ID, not a user ID)
    if (thread.customerId === currentUserId) {
      // Current user is the customer; other party is the supplier/recipient
      return (
        thread.supplierName ||
        thread.recipientName ||
        thread.metadata?.otherPartyName ||
        thread.marketplace?.listingTitle ||
        (thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown')
      );
    } else if (thread.recipientId === currentUserId) {
      // Current user is the recipient; other party is the customer
      return thread.customerName || thread.metadata?.otherPartyName || 'Customer';
    } else {
      // Fallback: try all names
      return (
        thread.supplierName ||
        thread.customerName ||
        thread.recipientName ||
        thread.metadata?.otherPartyName ||
        thread.marketplace?.listingTitle ||
        (thread.marketplace?.isPeerToPeer ? 'Seller' : 'Unknown')
      );
    }
  }

  function renderThreadHeader() {
    const header = document.getElementById('conversation-header');
    if (!header || !thread) {
      return;
    }

    const otherName = resolveOtherPartyName();
    header.textContent = `Conversation with ${otherName}`;
  }

  function renderMessages() {
    const container = document.getElementById('messages-container');
    if (!container) {
      return;
    }

    const otherPartyName = resolveOtherPartyName();

    container.innerHTML = messages
      .map(message => {
        const isSent = message.senderId === currentUserId;
        const text = (message.content || message.text || '')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const time = message.sentAt || message.createdAt || new Date();
        const timeStr = new Date(time).toLocaleTimeString();

        // Determine delivery/read status
        let statusHtml = '';
        if (isSent) {
          const isRead = Array.isArray(message.deliveredTo) && message.deliveredTo.length > 0;
          statusHtml = `<span class="message-status">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              ${
                isRead
                  ? '<path d="M1 5l4 4 10-8" stroke="currentColor"/><path d="M5 5l4 4 6-8" stroke="currentColor"/>'
                  : '<path d="M1 5l4 4 10-8" stroke="currentColor"/>'
              }
            </svg>
          </span>`;
        }

        return `<div class="message ${isSent ? 'message-sent' : 'message-received'}">
          <div class="message-content">${text}</div>
          <div class="message-meta">
            <span class="message-sender">${isSent ? 'You' : otherPartyName}</span>
            <span class="message-time">${timeStr}</span>
            ${statusHtml}
          </div>
        </div>`;
      })
      .join('');
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    if (!threadId) {
      return;
    }
    loadThread();
    loadMessages();
  });
})();
