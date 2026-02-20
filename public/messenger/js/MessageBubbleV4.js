/**
 * MessageBubbleV4
 * Static factory class for rendering message bubble HTML.
 * Handles attachments, reply previews, reactions, context menus, and read receipts.
 * BEM prefix: messenger-v4__
 */

'use strict';

class MessageBubbleV4 {
  // ---------------------------------------------------------------------------
  // Public static renderers
  // ---------------------------------------------------------------------------

  /**
   * Render a complete message bubble.
   * @param {Object} message - Message data
   * @param {string} currentUserId - Logged-in user's ID
   * @returns {string} HTML string
   */
  static render(message, currentUserId) {
    const isSent = message.senderId === currentUserId;
    const side = isSent ? 'sent' : 'received';
    const time = MessageBubbleV4._formatTime(message.createdAt || message.timestamp);
    const editedLabel = message.isEdited
      ? '<span class="messenger-v4__edited-label" aria-label="Edited">(edited)</span>'
      : '';
    const canEdit = isSent && MessageBubbleV4._withinEditWindow(message.createdAt);

    return `
      <div class="messenger-v4__message messenger-v4__message--${MessageBubbleV4.escape(side)}"
           data-id="${MessageBubbleV4.escape(message._id)}"
           data-sender="${MessageBubbleV4.escape(message.senderId)}">
        ${!isSent ? `<div class="messenger-v4__message-avatar" aria-hidden="true">${MessageBubbleV4.escape((message.senderName || 'U').charAt(0).toUpperCase())}</div>` : ''}
        <div class="messenger-v4__message-content">
          ${!isSent && message.senderName ? `<span class="messenger-v4__message-sender">${MessageBubbleV4.escape(message.senderName)}</span>` : ''}
          ${message.replyTo ? MessageBubbleV4.renderReplyTo(message.replyTo) : ''}
          <div class="messenger-v4__message-bubble" role="article">
            ${message.attachments?.length ? message.attachments.map(a => MessageBubbleV4.renderAttachment(a)).join('') : ''}
            ${message.content ? `<p class="messenger-v4__message-text">${MessageBubbleV4.escape(message.content)}</p>` : ''}
            ${editedLabel}
          </div>
          <div class="messenger-v4__message-meta">
            <time class="messenger-v4__message-time" datetime="${MessageBubbleV4.escape(message.createdAt || '')}">${MessageBubbleV4.escape(time)}</time>
            ${isSent ? MessageBubbleV4.renderReadReceipt(message.status) : ''}
          </div>
          ${message.reactions?.length ? MessageBubbleV4.renderReactions(message.reactions, message._id) : ''}
        </div>
        <button class="messenger-v4__context-menu-btn"
                aria-label="Message options"
                aria-haspopup="true"
                data-message-id="${MessageBubbleV4.escape(message._id)}"
                data-can-edit="${canEdit}"
                data-is-own="${isSent}">⋮</button>
      </div>`;
  }

  /**
   * Render the reactions bar below a bubble.
   * @param {Array} reactions - Array of { emoji, userId, count } objects
   * @param {string} messageId
   * @returns {string}
   */
  static renderReactions(reactions, messageId) {
    if (!reactions || !reactions.length) return '';

    // Group by emoji
    const grouped = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
    });

    const items = Object.values(grouped).map(g => {
      return `<button class="messenger-v4__reaction"
                      aria-label="React with ${MessageBubbleV4.escape(g.emoji)}, ${g.count} reaction${g.count !== 1 ? 's' : ''}"
                      data-emoji="${MessageBubbleV4.escape(g.emoji)}"
                      data-message-id="${MessageBubbleV4.escape(messageId)}">
                ${MessageBubbleV4.escape(g.emoji)} <span class="messenger-v4__reaction-count">${g.count}</span>
              </button>`;
    }).join('');

    return `<div class="messenger-v4__reactions-bar" aria-label="Reactions">${items}</div>`;
  }

  /**
   * Render an attachment (image shown inline; files as a card).
   * @param {Object} attachment - { url, type, name, size }
   * @returns {string}
   */
  static renderAttachment(attachment) {
    if (!attachment || !attachment.url) return '';

    // Backend stores mimeType (not type) and filename (not name)
    const mimeType = attachment.mimeType || attachment.type || '';
    const fileName = attachment.filename || attachment.name || '';
    const isImage = mimeType.startsWith('image/');

    if (isImage) {
      return `
        <div class="messenger-v4__attachment messenger-v4__attachment--image">
          <img src="${MessageBubbleV4.escape(attachment.url)}"
               alt="${MessageBubbleV4.escape(fileName || 'Image attachment')}"
               loading="lazy"
               class="messenger-v4__attachment-image"
               onerror="this.onerror=null;this.classList.add('messenger-v4__attachment-error');if(this.parentNode){var l=document.createElement('span');l.className='messenger-v4__attachment-error-label';l.textContent='Image unavailable';this.parentNode.appendChild(l);}" />
        </div>`;
    }

    const sizeLabel = attachment.size ? MessageBubbleV4._formatFileSize(attachment.size) : '';
    return `
      <div class="messenger-v4__attachment messenger-v4__attachment--file">
        <span class="messenger-v4__attachment-icon" aria-hidden="true">📎</span>
        <div class="messenger-v4__attachment-info">
          <a href="${MessageBubbleV4.safeUrl(attachment.url)}"
             target="_blank"
             rel="noopener noreferrer"
             class="messenger-v4__attachment-name"
             download="${MessageBubbleV4.escape(fileName || 'file')}">
            ${MessageBubbleV4.escape(fileName || 'File')}
          </a>
          ${sizeLabel ? `<span class="messenger-v4__attachment-size">${MessageBubbleV4.escape(sizeLabel)}</span>` : ''}
        </div>
      </div>`;
  }

  /**
   * Render the quoted reply-to preview shown above the bubble.
   * @param {Object} replyTo - { senderName, content, attachments }
   * @returns {string}
   */
  static renderReplyTo(replyTo) {
    if (!replyTo) return '';
    const preview = replyTo.content
      ? MessageBubbleV4.escape(replyTo.content.substring(0, 80))
      : replyTo.attachments?.length ? '📎 Attachment' : '';

    return `
      <div class="messenger-v4__reply-preview" aria-label="Reply to ${MessageBubbleV4.escape(replyTo.senderName || 'message')}">
        <span class="messenger-v4__reply-preview-sender">${MessageBubbleV4.escape(replyTo.senderName || 'Unknown')}</span>
        <span class="messenger-v4__reply-preview-text">${preview}</span>
      </div>`;
  }

  /**
   * Render the read receipt icon.
   * @param {string} status - 'sent' | 'delivered' | 'read'
   * @returns {string}
   */
  static renderReadReceipt(status) {
    let icon = '✓';
    let label = 'Sent';
    let cls = 'messenger-v4__read-receipt';

    if (status === 'delivered') { icon = '✓✓'; label = 'Delivered'; }
    if (status === 'read') { icon = '✓✓'; label = 'Read'; cls += ' messenger-v4__read-receipt--read'; }

    return `<span class="${cls}" aria-label="${label}" title="${label}">${icon}</span>`;
  }

  /**
   * Render the context menu for a message (positioned absolutely via CSS).
   * @param {Object} message
   * @param {boolean} isOwn
   * @param {boolean} canEdit - true if within 15-minute edit window
   * @returns {string}
   */
  static renderContextMenu(message, isOwn, canEdit) {
    const msgId = MessageBubbleV4.escape(message._id);
    let items = `
      <button class="messenger-v4__context-menu-item" data-action="reply" data-id="${msgId}">↩ Reply</button>
      <button class="messenger-v4__context-menu-item" data-action="react" data-id="${msgId}">😊 React</button>
      <button class="messenger-v4__context-menu-item" data-action="copy" data-id="${msgId}">📋 Copy</button>`;

    if (isOwn && canEdit) {
      items += `<button class="messenger-v4__context-menu-item" data-action="edit" data-id="${msgId}">✏️ Edit</button>`;
    }
    if (isOwn) {
      items += `<button class="messenger-v4__context-menu-item messenger-v4__context-menu-item--danger" data-action="delete" data-id="${msgId}">🗑️ Delete</button>`;
    }

    return `<div class="messenger-v4__context-menu" role="menu" aria-label="Message options">${items}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  static _formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /** Returns true if message was created within the 15-minute edit window. */
  static _withinEditWindow(createdAt) {
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() < 15 * 60 * 1000;
  }

  static _formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Escape a value for safe HTML insertion.
   * @param {*} str
   * @returns {string}
   */
  static escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Return a safe URL string for use in href/src attributes.
   * Blocks javascript:, data:, and vbscript: schemes to prevent XSS.
   * Returns '#' for any disallowed or blank URL.
   * @param {string} url
   * @returns {string}
   */
  static safeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    // Block dangerous schemes (case-insensitive, handles encoding tricks)
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
    return MessageBubbleV4.escape(trimmed);
  }
}

if (typeof window !== 'undefined') {
  window.MessageBubbleV4 = MessageBubbleV4;
}
