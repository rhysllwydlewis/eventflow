/**
 * MessageSupplierPanel Component
 * Panel for messaging suppliers with authentication handling
 */

class MessageSupplierPanel {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`MessageSupplierPanel: Container ${containerId} not found`);
      return;
    }
    this.options = {
      supplierId: null,
      packageId: null,
      supplierName: '',
      ...options,
    };
    this.authGate = window.AuthGate || new AuthGate();
    this.pendingMessage = null;
    this.injectStyles();
    this.render();
    this.loadPendingMessage();
  }

  injectStyles() {
    if (document.getElementById('message-supplier-panel-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'message-supplier-panel-styles';
    style.textContent = `
      .message-supplier-panel {
        background-color: var(--color-card-bg, #ffffff);
        border: 1px solid var(--color-border, #dee2e6);
        border-radius: 12px;
        padding: 24px;
        margin-top: 24px;
      }

      .message-panel-header {
        margin-bottom: 20px;
      }

      .message-panel-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--color-text-primary, #212529);
      }

      .message-panel-subtitle {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6c757d);
        margin: 0;
      }

      .message-panel-textarea {
        width: 100%;
        min-height: 120px;
        padding: 12px;
        border: 1px solid var(--color-border, #dee2e6);
        border-radius: 8px;
        font-size: 1rem;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 16px;
        background-color: var(--color-input-bg, #ffffff);
        color: var(--color-text-primary, #212529);
      }

      .message-panel-textarea:focus {
        outline: none;
        border-color: var(--accent, #13B6A2);
        box-shadow: 0 0 0 3px rgba(19, 182, 162, 0.1);
      }

      .message-panel-textarea:disabled {
        background-color: var(--color-bg-secondary, #f8f9fa);
        cursor: not-allowed;
        opacity: 0.6;
      }

      .message-panel-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .message-panel-send-btn {
        padding: 12px 24px;
        background-color: var(--accent, #13B6A2);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease, opacity 0.2s ease;
      }

      .message-panel-send-btn:hover:not(:disabled) {
        background-color: var(--ink, #0B8073);
      }

      .message-panel-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .message-panel-status {
        font-size: 0.9rem;
        color: var(--color-text-secondary, #6c757d);
      }

      .message-panel-status.success {
        color: var(--success, #28a745);
      }

      .message-panel-status.error {
        color: var(--error, #dc3545);
      }

      .auth-prompt {
        background-color: var(--color-bg-secondary, #f8f9fa);
        border: 1px solid var(--color-border, #dee2e6);
        border-radius: 8px;
        padding: 24px;
        text-align: center;
      }

      .auth-prompt-content p {
        margin: 0 0 20px 0;
        color: var(--color-text-primary, #212529);
      }

      .auth-prompt-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .pending-message-notice {
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        font-size: 0.9rem;
        color: #856404;
      }
    `;
    document.head.appendChild(style);
  }

  loadPendingMessage() {
    if (this.authGate.isAuthenticated()) {
      const pending = this.authGate.getPendingAction('supplier_message');
      if (pending && pending.supplierId === this.options.supplierId) {
        this.pendingMessage = pending.message;
        this.showPendingMessageNotice();
      }
    }
  }

  showPendingMessageNotice() {
    const notice = document.createElement('div');
    notice.className = 'pending-message-notice';
    notice.innerHTML = `
      <p style="margin:0">
        ✓ You're now logged in! Your message is ready to send.
      </p>
    `;

    const panel = this.container.querySelector('.message-supplier-panel');
    if (panel) {
      panel.insertBefore(notice, panel.firstChild);
    }

    // Pre-fill textarea if it exists
    const textarea = this.container.querySelector('.message-panel-textarea');
    if (textarea && this.pendingMessage) {
      textarea.value = this.pendingMessage;
    }
  }

  render() {
    const panel = document.createElement('div');
    panel.className = 'message-supplier-panel';

    if (!this.authGate.isAuthenticated()) {
      // Show auth prompt
      panel.innerHTML = `
        <div class="message-panel-header">
          <h3 class="message-panel-title">Message ${this.options.supplierName}</h3>
          <p class="message-panel-subtitle">Get in touch to discuss this package</p>
        </div>
        <div class="auth-prompt">
          <div class="auth-prompt-content">
            <p>Please create an account or log in to message this supplier</p>
            <div class="auth-prompt-actions">
              <button class="cta" id="auth-create-account">Create Account</button>
              <button class="cta secondary" id="auth-login">Log In</button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Show message form
      panel.innerHTML = `
        <div class="message-panel-header">
          <h3 class="message-panel-title">Message ${this.options.supplierName}</h3>
          <p class="message-panel-subtitle">Get in touch to discuss this package</p>
        </div>
        <textarea 
          class="message-panel-textarea" 
          id="message-textarea"
          placeholder="Hi, I'm interested in learning more about this package..."
        ></textarea>
        <div class="message-panel-actions">
          <button class="message-panel-send-btn" id="send-message-btn">
            Send Message
          </button>
          <span class="message-panel-status" id="message-status"></span>
        </div>
      `;
    }

    this.container.innerHTML = '';
    this.container.appendChild(panel);

    this.attachEventListeners();
  }

  attachEventListeners() {
    const createAccountBtn = document.getElementById('auth-create-account');
    const loginBtn = document.getElementById('auth-login');
    const sendBtn = document.getElementById('send-message-btn');

    if (createAccountBtn) {
      createAccountBtn.onclick = () => {
        this.savePendingMessage();
        window.location.href = `/auth.html?mode=register&return=${encodeURIComponent(window.location.href)}`;
      };
    }

    if (loginBtn) {
      loginBtn.onclick = () => {
        this.savePendingMessage();
        window.location.href = `/auth.html?return=${encodeURIComponent(window.location.href)}`;
      };
    }

    if (sendBtn) {
      sendBtn.onclick = () => this.sendMessage();
    }
  }

  savePendingMessage() {
    // Try to get any text that might be in a textarea (if user started typing before realizing they need to log in)
    const textarea = document.getElementById('message-textarea');
    if (textarea && textarea.value.trim()) {
      this.authGate.storePendingAction('supplier_message', {
        supplierId: this.options.supplierId,
        packageId: this.options.packageId,
        message: textarea.value.trim(),
      });
    }
  }

  async sendMessage() {
    const textarea = document.getElementById('message-textarea');
    const sendBtn = document.getElementById('send-message-btn');
    const statusEl = document.getElementById('message-status');

    if (!textarea || !sendBtn || !statusEl) {
      return;
    }

    const message = textarea.value.trim();
    if (!message) {
      statusEl.textContent = 'Please enter a message';
      statusEl.className = 'message-panel-status error';
      return;
    }

    sendBtn.disabled = true;
    statusEl.textContent = 'Sending...';
    statusEl.className = 'message-panel-status';

    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      // Start thread and send message
      const response = await fetch('/api/threads/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          supplierId: this.options.supplierId,
          packageId: this.options.packageId,
          message: message,
        }),
      });

      if (response.status === 401) {
        statusEl.textContent = 'Please log in to send messages';
        statusEl.className = 'message-panel-status error';
        setTimeout(() => {
          this.authGate.redirectToLogin(window.location.href);
        }, 1500);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      statusEl.textContent = 'Message sent successfully!';
      statusEl.className = 'message-panel-status success';
      textarea.value = '';

      // Clear any pending message
      this.authGate.getPendingAction('supplier_message');

      // Redirect to messages after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard-customer.html?tab=messages';
      }, 2000);
    } catch (error) {
      console.error('Error sending message:', error);
      statusEl.textContent = 'Failed to send message. Please try again.';
      statusEl.className = 'message-panel-status error';
    } finally {
      sendBtn.disabled = false;
    }
  }
}

// Export to window
if (typeof window !== 'undefined') {
  window.MessageSupplierPanel = MessageSupplierPanel;
}
