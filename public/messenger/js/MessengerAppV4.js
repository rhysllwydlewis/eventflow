/**
 * MessengerAppV4 - Main Orchestrator
 * Wires together all v4 components via window CustomEvents.
 * Handles deep links, keyboard shortcuts, mobile panel switching,
 * and WebSocket event routing.
 */

'use strict';

class MessengerAppV4 {
  constructor() {
    // Core services (rely on global classes from existing scripts)
    this.api = null;
    this.state = null;
    this.socket = null;
    this.currentUser = null;

    // Component references
    this.conversationList = null;
    this.chatView = null;
    this.composer = null;
    this.contactPicker = null;
    this.contextBanner = null;
    this.typingIndicator = null;
    this.notificationBridge = null;

    // Track selected conversation
    this._activeConversationId = null;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  async init() {
    try {
      // Instantiate core services
      this.api = new MessengerAPI();
      this.state = new MessengerState();

      // 1. Load current user
      this.currentUser = await this._loadCurrentUser();
      if (!this.currentUser) {
        window.location.href = '/login.html';
        return;
      }
      this.state.setCurrentUser(this.currentUser);

      // 2. Initialize all components
      this._initComponents();

      // 3. Connect WebSocket
      if (window.MessengerSocket) {
        this.socket = new MessengerSocket(this.state);
        this.socket.connect(this.currentUser.id || this.currentUser._id);
      }

      // 4. Load initial conversation list
      await this._loadConversations();

      // 5. Handle deep links (?conversation=X, ?new=1, ?contact=userId)
      this.handleDeepLink();

      // 6. Keyboard shortcuts
      this._setupKeyboardShortcuts();

      // 7. Responsive mode handling
      this._setupResponsive();

      // 8. Request notification permission (non-blocking)
      this.notificationBridge?.requestPermission();

    } catch (err) {
      console.error('[MessengerAppV4] init failed:', err);
      this._showGlobalError('Failed to load messenger. Please refresh the page.');
    }
  }

  // ---------------------------------------------------------------------------
  // Component initialization
  // ---------------------------------------------------------------------------

  _initComponents() {
    // Conversation list (sidebar)
    const listContainer = document.querySelector('[data-v4="conversation-list"]');
    if (listContainer && window.ConversationListV4) {
      this.conversationList = new ConversationListV4(listContainer, this.state, this.api);
    }

    // Chat view (main panel)
    const chatContainer = document.querySelector('[data-v4="chat-view"]');
    if (chatContainer && window.ChatViewV4) {
      this.chatView = new ChatViewV4(chatContainer, this.state, this.api);
    }

    // Message composer
    const composerContainer = document.querySelector('[data-v4="composer"]');
    if (composerContainer && window.MessageComposerV4) {
      const uid = this.currentUser.id || this.currentUser._id;
      this.composer = new MessageComposerV4(composerContainer, {
        onTyping: isTyping => this._broadcastTyping(isTyping),
        maxLength: 5000,
      });
    }

    // Contact picker
    const pickerContainer = document.querySelector('[data-v4="contact-picker"]');
    if (pickerContainer && window.ContactPickerV4) {
      this.contactPicker = new ContactPickerV4(pickerContainer, this.api, {
        currentUserId: this.currentUser.id || this.currentUser._id,
      });
    }

    // Context banner
    const bannerContainer = document.querySelector('[data-v4="context-banner"]');
    if (bannerContainer && window.ContextBannerV4) {
      this.contextBanner = new ContextBannerV4(bannerContainer);
    }

    // Typing indicator
    const typingContainer = document.querySelector('[data-v4="typing-indicator"]');
    if (typingContainer && window.TypingIndicatorV4) {
      this.typingIndicator = new TypingIndicatorV4(typingContainer);
    }

    // Notification bridge
    if (window.NotificationBridgeV4) {
      this.notificationBridge = new NotificationBridgeV4({ titlePrefix: 'EventFlow' });
    }

    // Wire up global event bus
    this._setupEventBus();
  }

  // ---------------------------------------------------------------------------
  // Event bus (window CustomEvents)
  // ---------------------------------------------------------------------------

  _setupEventBus() {
    // Conversation selected (from list or deep link)
    window.addEventListener('messenger:conversation-selected', e => {
      const { id } = e.detail || {};
      if (id) this.selectConversation(id);
    });

    // New message from socket
    window.addEventListener('messenger:new-message', e => {
      const { message, conversationId } = e.detail || {};
      if (!message) return;

      // Update state
      this.state.addMessage(conversationId, message);

      // Update conversation list (bubble last message to top)
      const conv = this.state.conversations.find(c => c._id === conversationId);
      if (conv) {
        conv.lastMessage = message;
        conv.updatedAt = message.createdAt || new Date().toISOString();
        this.state.updateConversation(conv);
      }

      // Desktop notification if conversation is not currently open
      if (conversationId !== this._activeConversationId) {
        const unread = this.state.conversations.reduce((sum, c) => {
          const me = c.participants?.find(p => p.userId === (this.currentUser.id || this.currentUser._id));
          return sum + (me?.unreadCount || 0);
        }, 0);
        this.state.setUnreadCount(unread);
        window.dispatchEvent(new CustomEvent('messenger:unread-count', { detail: { count: unread } }));

        this.notificationBridge?.notify(
          message.senderName || 'New message',
          message.content || '📎 Attachment',
          { conversationId, tag: `msg-${conversationId}` }
        );
      }
    });

    // Composer send
    window.addEventListener('composer:send', async e => {
      const { message, files, replyTo, conversationId } = e.detail || {};
      await this._sendMessage({ message, files, replyTo, conversationId: conversationId || this._activeConversationId });
    });

    // Contact picker selected → create conversation
    window.addEventListener('contactpicker:selected', async e => {
      const { contact, context } = e.detail || {};
      if (contact) await this.createConversation([contact._id || contact.id], context);
    });

    // Typing events
    window.addEventListener('messenger:typing', e => {
      const { conversationId, isTyping, userName } = e.detail || {};
      if (conversationId !== this._activeConversationId) return;
      if (isTyping) {
        this.typingIndicator?.show(userName || '');
        this.chatView?.showTyping(userName || '');
      } else {
        this.typingIndicator?.hide();
        this.chatView?.hideTyping();
      }
    });

    // Pin/archive from list or chat header
    window.addEventListener('messenger:pin-conversation', async e => {
      const { id } = e.detail || {};
      if (id) await this._togglePin(id);
    });
    window.addEventListener('messenger:archive-conversation', async e => {
      const { id } = e.detail || {};
      if (id) await this._toggleArchive(id);
    });

    // Open contact picker
    window.addEventListener('messenger:open-contact-picker', () => this.contactPicker?.open());

    // Mobile back
    window.addEventListener('messenger:mobile-back', () => this.handleMobilePanel('sidebar'));

    // Unread count → notification bridge
    window.addEventListener('messenger:unread-count', e => {
      const count = e.detail?.count ?? e.detail ?? 0;
      this.notificationBridge?.setUnreadCount(count);
    });
  }

  // ---------------------------------------------------------------------------
  // Public actions
  // ---------------------------------------------------------------------------

  /**
   * Select a conversation: update state, load chat, wire composer.
   * @param {string} id - Conversation ID
   */
  async selectConversation(id) {
    if (this._activeConversationId === id) return;
    this._activeConversationId = id;
    this.state.setActiveConversation(id);

    // Update composer's conversationId
    if (this.composer) this.composer.options.conversationId = id;

    // Load chat
    if (this.chatView) await this.chatView.loadConversation(id);

    // Show context banner if applicable
    const conv = this.state.conversations.find(c => c._id === id);
    if (conv?.context?.type && this.contextBanner) {
      this.contextBanner.show(conv.context);
    } else {
      this.contextBanner?.hide();
    }

    // On mobile, switch to chat panel
    if (window.innerWidth <= 768) this.handleMobilePanel('chat');

    // Focus composer
    this.composer?.focus();

    // Mark as read via API (non-blocking)
    this.api.request(`/conversations/${encodeURIComponent(id)}/read`, { method: 'POST' }).catch(() => {});
  }

  /**
   * Create a new conversation with given participant IDs.
   * @param {string[]} participantIds
   * @param {string} context - 'direct' | 'package' | 'marketplace'
   */
  async createConversation(participantIds, context = 'direct') {
    try {
      const data = await this.api.request('/conversations', {
        method: 'POST',
        body: JSON.stringify({ participantIds, context }),
      });
      const conv = data.conversation || data;
      if (conv?._id) {
        this.state.updateConversation(conv);
        await this.selectConversation(conv._id);
      }
    } catch (err) {
      console.error('[MessengerAppV4] createConversation failed:', err);
    }
  }

  /**
   * Switch visible panel in single-column mobile layout.
   * @param {'sidebar'|'chat'} panel
   */
  handleMobilePanel(panel) {
    const sidebar = document.querySelector('[data-v4="sidebar"]');
    const chat = document.querySelector('[data-v4="chat-panel"]');
    if (!sidebar || !chat) return;

    if (panel === 'chat') {
      sidebar.style.display = 'none';
      chat.style.display = '';
    } else {
      sidebar.style.display = '';
      chat.style.display = 'none';
    }
  }

  /**
   * Parse URL parameters and act on them.
   * Supports: ?conversation=ID, ?new=1, ?contact=userId
   */
  handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get('conversation');
    const openNew = params.get('new');
    const contactId = params.get('contact');

    if (conversationId) {
      this.selectConversation(conversationId);
    } else if (openNew === '1' || contactId) {
      this.contactPicker?.open();
    }
  }

  /** Clean up all components and listeners. */
  destroy() {
    this.conversationList?.destroy();
    this.chatView?.destroy();
    this.composer?.destroy();
    this.contactPicker?.destroy();
    this.notificationBridge?.destroy();
    this.socket?.disconnect?.();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  async _loadCurrentUser() {
    // Try existing AuthState first (already logged in)
    if (window.AuthState?.getUser) {
      const user = AuthState.getUser();
      if (user) return user;
    }

    // Fallback to API
    try {
      const data = await fetch('/api/v1/auth/me', { credentials: 'include' }).then(r => r.json());
      return data.user || data || null;
    } catch {
      return null;
    }
  }

  async _loadConversations() {
    try {
      const data = await this.api.getConversations();
      const conversations = data.conversations || data || [];
      this.state.setConversations(conversations);

      // Set global unread count
      const uid = this.currentUser.id || this.currentUser._id;
      const unread = conversations.reduce((sum, c) => {
        const me = c.participants?.find(p => p.userId === uid);
        return sum + (me?.unreadCount || 0);
      }, 0);
      this.state.setUnreadCount(unread);
      window.dispatchEvent(new CustomEvent('messenger:unread-count', { detail: { count: unread } }));
    } catch (err) {
      console.error('[MessengerAppV4] Failed to load conversations:', err);
    }
  }

  async _sendMessage({ message, files, replyTo, conversationId }) {
    if (!conversationId) return;
    try {
      let sentMsg;
      if (files?.length) {
        // Multipart upload
        const form = new FormData();
        if (message) form.append('content', message);
        if (replyTo?._id) form.append('replyToId', replyTo._id);
        files.forEach(f => form.append('files', f));
        const res = await fetch(`${this.api.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': this.api.csrfToken },
          body: form,
        });
        const data = await res.json();
        sentMsg = data.message || data;
      } else {
        const data = await this.api.sendMessage(conversationId, {
          content: message,
          replyToId: replyTo?._id,
        });
        sentMsg = data.message || data;
      }

      if (sentMsg) {
        this.state.addMessage(conversationId, sentMsg);
        this.chatView?.appendMessage(sentMsg);
      }
    } catch (err) {
      console.error('[MessengerAppV4] Failed to send message:', err);
    }
  }

  async _togglePin(conversationId) {
    try {
      await this.api.request(`/conversations/${encodeURIComponent(conversationId)}/pin`, { method: 'POST' });
      await this._loadConversations();
    } catch (err) {
      console.error('[MessengerAppV4] Pin failed:', err);
    }
  }

  async _toggleArchive(conversationId) {
    try {
      await this.api.request(`/conversations/${encodeURIComponent(conversationId)}/archive`, { method: 'POST' });
      await this._loadConversations();
    } catch (err) {
      console.error('[MessengerAppV4] Archive failed:', err);
    }
  }

  _broadcastTyping(isTyping) {
    if (!this._activeConversationId || !this.socket) return;
    try {
      this.socket.emit?.('typing', { conversationId: this._activeConversationId, isTyping });
    } catch {
      // Socket may not be connected
    }
  }

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Escape: close contact picker or mobile chat panel
      if (e.key === 'Escape') {
        if (this.contactPicker?.modalEl?.style.display !== 'none') {
          this.contactPicker.close();
          return;
        }
        if (window.innerWidth <= 768 && this._activeConversationId) {
          this.handleMobilePanel('sidebar');
        }
        return;
      }

      // Ignore shortcuts when typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      // ArrowDown / ArrowUp: navigate conversations
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this._navigateConversations(e.key === 'ArrowDown' ? 1 : -1);
      }
    });
  }

  _navigateConversations(direction) {
    const convs = this.state.getFilteredConversations();
    if (!convs.length) return;
    const idx = convs.findIndex(c => c._id === this._activeConversationId);
    const next = idx + direction;
    if (next >= 0 && next < convs.length) {
      this.selectConversation(convs[next]._id);
    }
  }

  _setupResponsive() {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = e => {
      if (!e.matches && this._activeConversationId) {
        // Restore both panels on desktop
        const sidebar = document.querySelector('[data-v4="sidebar"]');
        const chat = document.querySelector('[data-v4="chat-panel"]');
        if (sidebar) sidebar.style.display = '';
        if (chat) chat.style.display = '';
      }
    };
    mq.addEventListener('change', handler);
  }

  _showGlobalError(msg) {
    const el = document.querySelector('[data-v4="global-error"]');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
    else console.error('[MessengerAppV4]', msg);
  }
}

// Auto-boot on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.messengerAppV4 = new MessengerAppV4();
  window.messengerAppV4.init();
});
