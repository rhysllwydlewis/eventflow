(function (g) {
  'use strict';
  const f = {
      apiBaseUrl: '',
      assistantName: 'Jade',
      greetingText:
        "Hi! 👋 I'm Jade, your event planning assistant. Can I help you plan your special day?",
      avatarUrl: '',
      primaryColor: '#0B8073',
      accentColor: '#13B6A2',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: { bottom: '24px', right: '24px', zIndex: 999999, respectSafeArea: !0 },
    },
    r = {
      STATE: 'jade-widget-state',
      MESSAGES: 'jade-widget-messages',
      CONVERSATION_ID: 'jade-widget-conversation-id',
    };
  class n {
    static saveState(e) {
      try {
        const t = { ...this.loadState(), ...e };
        localStorage.setItem(r.STATE, JSON.stringify(t));
      } catch (a) {
        console.warn('Failed to save widget state:', a);
      }
    }
    static loadState() {
      try {
        const e = localStorage.getItem(r.STATE);
        return e ? JSON.parse(e) : {};
      } catch (e) {
        return (console.warn('Failed to load widget state:', e), {});
      }
    }
    static saveMessages(e) {
      try {
        localStorage.setItem(r.MESSAGES, JSON.stringify(e));
      } catch (a) {
        console.warn('Failed to save messages:', a);
      }
    }
    static loadMessages() {
      try {
        const e = localStorage.getItem(r.MESSAGES);
        return e ? JSON.parse(e) : [];
      } catch (e) {
        return (console.warn('Failed to load messages:', e), []);
      }
    }
    static saveConversationId(e) {
      try {
        localStorage.setItem(r.CONVERSATION_ID, e);
      } catch (a) {
        console.warn('Failed to save conversation ID:', a);
      }
    }
    static loadConversationId() {
      try {
        return localStorage.getItem(r.CONVERSATION_ID);
      } catch (e) {
        return (console.warn('Failed to load conversation ID:', e), null);
      }
    }
    static clearAll() {
      try {
        (localStorage.removeItem(r.STATE),
          localStorage.removeItem(r.MESSAGES),
          localStorage.removeItem(r.CONVERSATION_ID));
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }
    }
  }
  class x {
    constructor(e) {
      ((this.baseUrl = e || ''), (this.demoMode = !e));
    }
    async sendMessage(e, a) {
      var t;
      if (this.demoMode) return this.mockResponse(e);
      try {
        const s = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: e, conversationId: a, userId: 'anonymous' }),
        });
        if (!s.ok) throw new Error(`API error: ${s.status}`);
        const i = await s.json();
        if (!i.success || !i.data)
          throw new Error(((t = i.error) == null ? void 0 : t.message) || 'API request failed');
        return {
          conversationId: i.data.conversationId,
          message: {
            id: i.data.message.id,
            role: 'assistant',
            content: i.data.message.content,
            timestamp: Date.now(),
            quickReplies: i.data.suggestions,
          },
        };
      } catch (s) {
        console.error('API request failed, falling back to demo mode:', s);
        const i = await this.mockResponse(e);
        return ((i.message.content = `⚠️ (Demo Mode) ${i.message.content}`), i);
      }
    }
    async mockResponse(e) {
      await new Promise(d => setTimeout(d, 800));
      const a = 'demo-' + Date.now(),
        t = e.toLowerCase();
      let s = '',
        i;
      return (
        t.includes('yes') && t.includes('please')
          ? ((s =
              "Wonderful! I'd love to help you plan your event. What type of event are you planning? 🎉"),
            (i = ['Wedding', 'Birthday Party', 'Corporate Event', 'Other']))
          : t.includes('wedding')
            ? ((s =
                'Exciting! A wedding is such a special occasion. Do you have a date in mind? 💍'),
              (i = ['Yes, I do', 'Not yet', 'Need help choosing']))
            : t.includes('no') && t.includes('thanks')
              ? (s =
                  "No problem! If you change your mind or need any event planning help, I'm always here. Have a great day! 😊")
              : t.includes('budget')
                ? ((s =
                    "I can help you create a realistic budget! What's your approximate total budget for the event? 💷"),
                  (i = ['Under £5k', '£5k-£10k', '£10k-£20k', '£20k+']))
                : t.includes('venue')
                  ? ((s =
                      'Great question! I can help you find the perfect venue. What region are you looking in? 📍'),
                    (i = ['London', 'Scotland', 'Wales', 'Other UK']))
                  : ((s =
                      "I'm here to help with all aspects of event planning! I can assist with budget planning, venue selection, supplier recommendations, timelines, and more. What would you like to know? 😊"),
                    (i = ['Budget Planning', 'Find Venues', 'Get Timeline', 'Talk to Expert'])),
        {
          conversationId: a,
          message: {
            id: 'msg-' + Date.now(),
            role: 'assistant',
            content: s,
            timestamp: Date.now(),
            quickReplies: i,
          },
        }
      );
    }
  }
  function v(o, e, a, t) {
    var u, m, b;
    const s = (t == null ? void 0 : t.bottom) || '24px',
      i = t == null ? void 0 : t.right,
      d = t == null ? void 0 : t.left,
      j = (t == null ? void 0 : t.zIndex) || 999999,
      k = (t == null ? void 0 : t.respectSafeArea) !== !1,
      c = (u = t == null ? void 0 : t.mobile) == null ? void 0 : u.bottom,
      p = (m = t == null ? void 0 : t.mobile) == null ? void 0 : m.right,
      l = (b = t == null ? void 0 : t.mobile) == null ? void 0 : b.left;
    return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :host {
      all: initial;
      display: block;
      font-family: ${a};
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .jade-widget-container {
      position: fixed;
      bottom: ${s};
      ${i ? `right: ${i};` : ''}
      ${d ? `left: ${d};` : ''}
      z-index: ${j};
    }

    /* Avatar Button */
    .jade-avatar-button {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${o} 0%, ${e} 100%);
      border: 3px solid white;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: float 3s ease-in-out infinite;
    }

    .jade-avatar-button:hover {
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2), 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .jade-avatar-button:active {
      transform: translateY(0) scale(0.98);
    }

    @keyframes float {
      0%, 100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-10px);
      }
    }

    .jade-avatar-icon {
      width: 32px;
      height: 32px;
      color: white;
      font-size: 32px;
    }

    .jade-avatar-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ef4444;
      border: 2px solid white;
    }

    /* Greeting Tooltip */
    .jade-greeting-tooltip {
      position: absolute;
      bottom: 76px;
      right: 0;
      background: white;
      padding: 18px 22px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
      max-width: 300px;
      opacity: 0;
      transform: translateY(10px);
      animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .jade-greeting-tooltip:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2), 0 6px 16px rgba(0, 0, 0, 0.12);
    }

    @keyframes slideUp {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .jade-greeting-tooltip::after {
      content: '';
      position: absolute;
      bottom: -8px;
      right: 24px;
      width: 16px;
      height: 16px;
      background: white;
      transform: rotate(45deg);
      box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.08);
      border-right: 1px solid rgba(0, 0, 0, 0.05);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .jade-greeting-text {
      position: relative;
      z-index: 1;
      font-size: 15px;
      color: #374151;
      line-height: 1.6;
      font-weight: 500;
    }

    .jade-greeting-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      z-index: 2;
    }

    .jade-greeting-close:hover {
      color: #4b5563;
    }

    /* Chat Popup */
    .jade-chat-popup {
      position: absolute;
      bottom: 76px;
      right: 0;
      width: 400px;
      height: 600px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      animation: popupOpen 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      border: 1px solid rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }

    @keyframes popupOpen {
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Header */
    .jade-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      background: linear-gradient(135deg, ${o} 0%, ${e} 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .jade-chat-header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .jade-chat-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .jade-chat-title {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .jade-chat-status {
      font-size: 13px;
      opacity: 0.95;
      font-weight: 400;
    }

    .jade-chat-close {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      transition: background 0.2s ease;
    }

    .jade-chat-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Messages */
    .jade-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #f9fafb;
    }

    .jade-chat-messages::-webkit-scrollbar {
      width: 6px;
    }

    .jade-chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .jade-chat-messages::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .jade-message {
      display: flex;
      gap: 8px;
      animation: messageSlide 0.3s ease;
    }

    @keyframes messageSlide {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .jade-message-user {
      flex-direction: row-reverse;
    }

    .jade-message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .jade-message-avatar.assistant {
      background: linear-gradient(135deg, ${o} 0%, ${e} 100%);
      color: white;
    }

    .jade-message-avatar.user {
      background: #e5e7eb;
      color: #6b7280;
    }

    .jade-message-content {
      max-width: 70%;
    }

    .jade-message-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      word-wrap: break-word;
    }

    .jade-message-assistant .jade-message-bubble {
      background: white;
      color: #1f2937;
      border-bottom-left-radius: 4px;
    }

    .jade-message-user .jade-message-bubble {
      background: ${o};
      color: white;
      border-bottom-right-radius: 4px;
    }

    .jade-message-time {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
      padding: 0 4px;
    }

    /* Quick Replies */
    .jade-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .jade-quick-reply-btn {
      padding: 8px 16px;
      border: 1px solid ${o};
      background: white;
      color: ${o};
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .jade-quick-reply-btn:hover {
      background: ${o};
      color: white;
    }

    /* Input Area */
    .jade-chat-input-area {
      padding: 16px 20px;
      background: white;
      border-top: 1px solid #e5e7eb;
      border-radius: 0 0 16px 16px;
    }

    .jade-chat-input-wrapper {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .jade-chat-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      resize: none;
      max-height: 100px;
      min-height: 40px;
    }

    .jade-chat-input:focus {
      border-color: ${o};
    }

    .jade-chat-send-btn {
      width: 40px;
      height: 40px;
      border: none;
      background: ${o};
      color: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .jade-chat-send-btn:hover:not(:disabled) {
      background: ${e};
      transform: scale(1.05);
    }

    .jade-chat-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Loading indicator */
    .jade-typing-indicator {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
    }

    .jade-typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ca3af;
      animation: typing 1.4s infinite;
    }

    .jade-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .jade-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.7;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .jade-widget-container {
        ${c ? `bottom: ${c};` : 'bottom: 16px;'}
        ${p ? `right: ${p};` : l ? '' : 'right: 16px;'}
        ${l ? `left: ${l};` : ''}
      }

      .jade-chat-popup {
        width: calc(100vw - 32px);
        height: calc(100vh - 120px);
        max-height: 600px;
      }

      .jade-greeting-tooltip {
        max-width: calc(100vw - 120px);
      }
    }

    /* Safe area insets for iOS */
    ${
      k
        ? `
    @supports (padding: env(safe-area-inset-bottom)) {
      .jade-widget-container {
        bottom: calc(${s} + env(safe-area-inset-bottom));
      }

      @media (max-width: 480px) {
        .jade-widget-container {
          bottom: calc(${c || '16px'} + env(safe-area-inset-bottom));
        }
      }
    }
    `
        : ''
    }

    /* Hidden utility */
    .jade-hidden {
      display: none !important;
    }
  `;
  }
  class w {
    constructor(e = {}) {
      ((this.config = { ...f, ...e }), (this.apiClient = new x(this.config.apiBaseUrl)));
      const a = n.loadState(),
        t = n.loadMessages(),
        s = n.loadConversationId();
      ((this.state = {
        isOpen: a.isOpen || !1,
        isMinimized: a.isMinimized || !1,
        showGreeting: !1,
        conversationId: s || void 0,
        messages: t.length > 0 ? t : this.getInitialMessages(),
      }),
        (this.container = document.createElement('div')),
        (this.container.className = 'jade-widget-root'),
        (this.shadowRoot = this.container.attachShadow({ mode: 'open' })),
        this.render(),
        this.attachEventListeners(),
        !this.state.isOpen &&
          t.length === 1 &&
          (this.greetingTimeout = window.setTimeout(() => {
            ((this.state.showGreeting = !0), this.render());
          }, 1e3)));
    }
    getInitialMessages() {
      return [
        {
          id: 'initial',
          role: 'assistant',
          content: this.config.greetingText,
          timestamp: Date.now(),
          quickReplies: ['Yes, please', 'No, thanks'],
        },
      ];
    }
    render() {
      const e = v(
        this.config.primaryColor,
        this.config.accentColor,
        this.config.fontFamily,
        this.config.position
      );
      this.shadowRoot.innerHTML = `
      <style>${e}</style>
      <div class="jade-widget-container">
        ${this.renderAvatar()}
        ${this.state.showGreeting && !this.state.isOpen ? this.renderGreeting() : ''}
        ${this.state.isOpen ? this.renderChatPopup() : ''}
      </div>
    `;
    }
    renderAvatar() {
      return `
      <button class="jade-avatar-button" aria-label="Open chat" data-action="toggle-chat">
        ${this.config.avatarUrl ? `<img src="${this.config.avatarUrl}" alt="Avatar" class="jade-avatar-icon" />` : '<span class="jade-avatar-icon">💬</span>'}
      </button>
    `;
    }
    renderGreeting() {
      return `
      <div class="jade-greeting-tooltip" data-action="open-chat">
        <button class="jade-greeting-close" aria-label="Close greeting" data-action="close-greeting">×</button>
        <div class="jade-greeting-text">${this.config.greetingText}</div>
      </div>
    `;
    }
    renderChatPopup() {
      return `
      <div class="jade-chat-popup" role="dialog" aria-label="Chat">
        ${this.renderHeader()}
        ${this.renderMessages()}
        ${this.renderInputArea()}
      </div>
    `;
    }
    renderHeader() {
      return `
      <div class="jade-chat-header">
        <div class="jade-chat-header-left">
          <div class="jade-chat-avatar">
            ${this.config.avatarUrl ? `<img src="${this.config.avatarUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;" />` : '💬'}
          </div>
          <div>
            <div class="jade-chat-title">${this.config.assistantName}</div>
            <div class="jade-chat-status">Online</div>
          </div>
        </div>
        <button class="jade-chat-close" aria-label="Close chat" data-action="close-chat">×</button>
      </div>
    `;
    }
    renderMessages() {
      return `
      <div class="jade-chat-messages" data-messages-container>
        ${this.state.messages.map(a => this.renderMessage(a)).join('')}
      </div>
    `;
    }
    renderMessage(e) {
      const a = e.role === 'user',
        t = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        s =
          !a && e.quickReplies
            ? `
      <div class="jade-quick-replies">
        ${e.quickReplies.map(i => `<button class="jade-quick-reply-btn" data-action="quick-reply" data-reply="${this.escapeHtml(i)}">${this.escapeHtml(i)}</button>`).join('')}
      </div>
    `
            : '';
      return `
      <div class="jade-message jade-message-${e.role}" data-message-id="${e.id}">
        <div class="jade-message-avatar ${e.role}">
          ${a ? '👤' : '💬'}
        </div>
        <div class="jade-message-content">
          <div class="jade-message-bubble">${this.escapeHtml(e.content)}</div>
          <div class="jade-message-time">${t}</div>
          ${s}
        </div>
      </div>
    `;
    }
    renderInputArea() {
      return `
      <div class="jade-chat-input-area">
        <div class="jade-chat-input-wrapper">
          <textarea 
            class="jade-chat-input" 
            placeholder="Type your message..."
            rows="1"
            aria-label="Message input"
            data-input
          ></textarea>
          <button class="jade-chat-send-btn" aria-label="Send message" data-action="send">
            ➤
          </button>
        </div>
      </div>
    `;
    }
    attachEventListeners() {
      (this.shadowRoot.addEventListener('click', e => {
        const a = e.target,
          t = a.getAttribute('data-action');
        if (t === 'toggle-chat') this.toggleChat();
        else if (t === 'open-chat') this.openChat();
        else if (t === 'close-chat') this.closeChat();
        else if (t === 'close-greeting') (e.stopPropagation(), this.closeGreeting());
        else if (t === 'send') this.handleSend();
        else if (t === 'quick-reply') {
          const s = a.getAttribute('data-reply');
          s && this.handleQuickReply(s);
        }
      }),
        this.shadowRoot.addEventListener('keydown', e => {
          const a = e;
          e.target.hasAttribute('data-input') &&
            a.key === 'Enter' &&
            !a.shiftKey &&
            (e.preventDefault(), this.handleSend());
        }),
        document.addEventListener('keydown', e => {
          e.key === 'Escape' && this.state.isOpen && this.closeChat();
        }),
        this.shadowRoot.addEventListener('input', e => {
          const a = e.target;
          a.hasAttribute('data-input') &&
            ((a.style.height = 'auto'), (a.style.height = Math.min(a.scrollHeight, 100) + 'px'));
        }));
    }
    toggleChat() {
      this.state.isOpen ? this.closeChat() : this.openChat();
    }
    openChat() {
      ((this.state.isOpen = !0),
        (this.state.showGreeting = !1),
        this.greetingTimeout && clearTimeout(this.greetingTimeout),
        n.saveState({ isOpen: !0, showGreeting: !1 }),
        this.render(),
        this.scrollToBottom(),
        this.focusInput());
    }
    closeChat() {
      ((this.state.isOpen = !1), n.saveState({ isOpen: !1 }), this.render());
    }
    closeGreeting() {
      ((this.state.showGreeting = !1), this.render());
    }
    async handleSend() {
      const e = this.shadowRoot.querySelector('[data-input]');
      if (!e) return;
      const a = e.value.trim();
      if (!a) return;
      const t = { id: 'user-' + Date.now(), role: 'user', content: a, timestamp: Date.now() };
      (this.state.messages.push(t),
        n.saveMessages(this.state.messages),
        (e.value = ''),
        (e.style.height = 'auto'),
        this.render(),
        this.scrollToBottom(),
        this.showTypingIndicator());
      try {
        const s = await this.apiClient.sendMessage(a, this.state.conversationId);
        (this.state.conversationId ||
          ((this.state.conversationId = s.conversationId), n.saveConversationId(s.conversationId)),
          this.state.messages.push(s.message),
          n.saveMessages(this.state.messages),
          this.removeTypingIndicator(),
          this.render(),
          this.scrollToBottom(),
          this.focusInput());
      } catch (s) {
        (console.error('Failed to send message:', s), this.removeTypingIndicator());
        const i = {
          id: 'error-' + Date.now(),
          role: 'assistant',
          content: "I'm sorry, I'm having trouble connecting. Please try again.",
          timestamp: Date.now(),
        };
        (this.state.messages.push(i),
          n.saveMessages(this.state.messages),
          this.render(),
          this.scrollToBottom());
      }
    }
    handleQuickReply(e) {
      const a = this.shadowRoot.querySelector('[data-input]');
      a && ((a.value = e), this.handleSend());
    }
    showTypingIndicator() {
      this.removeTypingIndicator();
      const e = this.shadowRoot.querySelector('[data-messages-container]');
      if (e) {
        const a = document.createElement('div');
        ((a.className = 'jade-message jade-message-assistant'),
          a.setAttribute('data-typing-indicator', ''),
          (a.innerHTML = `
        <div class="jade-message-avatar assistant">💬</div>
        <div class="jade-message-content">
          <div class="jade-message-bubble">
            <div class="jade-typing-indicator">
              <div class="jade-typing-dot"></div>
              <div class="jade-typing-dot"></div>
              <div class="jade-typing-dot"></div>
            </div>
          </div>
        </div>
      `),
          e.appendChild(a),
          this.scrollToBottom());
      }
    }
    removeTypingIndicator() {
      const e = this.shadowRoot.querySelector('[data-typing-indicator]');
      e && e.remove();
    }
    scrollToBottom() {
      setTimeout(() => {
        const e = this.shadowRoot.querySelector('[data-messages-container]');
        e && (e.scrollTop = e.scrollHeight);
      }, 100);
    }
    focusInput() {
      setTimeout(() => {
        const e = this.shadowRoot.querySelector('[data-input]');
        e && e.focus();
      }, 100);
    }
    escapeHtml(e) {
      const a = document.createElement('div');
      return ((a.textContent = e), a.innerHTML);
    }
    mount(e) {
      (e || document.body).appendChild(this.container);
    }
    unmount() {
      (this.container.remove(), this.greetingTimeout && clearTimeout(this.greetingTimeout));
    }
    open() {
      this.openChat();
    }
    close() {
      this.closeChat();
    }
    toggle() {
      this.toggleChat();
    }
    reset() {
      (n.clearAll(),
        (this.state = {
          isOpen: !1,
          isMinimized: !1,
          showGreeting: !1,
          messages: this.getInitialMessages(),
        }),
        this.render());
    }
  }
  function y(o) {
    var a;
    (a = window.JadeWidget) != null && a.instance && window.JadeWidget.instance.unmount();
    const e = new w(o);
    (e.mount(), window.JadeWidget && (window.JadeWidget.instance = e));
  }
  const h = { init: y };
  (typeof window < 'u' && (window.JadeWidget = h),
    (g.default = h),
    Object.defineProperties(g, {
      __esModule: { value: !0 },
      [Symbol.toStringTag]: { value: 'Module' },
    }));
})((this.JadeWidget = this.JadeWidget || {}));
