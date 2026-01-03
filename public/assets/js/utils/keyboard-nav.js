/**
 * Keyboard Navigation Helper
 * Improves keyboard accessibility throughout the application
 */

class KeyboardNavigationHelper {
  constructor(options = {}) {
    this.options = {
      enableFocusTrap: true,
      enableSkipLinks: false, // Disabled - skip links removed per user request
      enableShortcuts: true,
      focusRingClass: 'focus-visible',
      ...options,
    };

    this.shortcuts = new Map();
    this.focusTrapStack = [];
    this.init();
  }

  init() {
    // Only show focus rings for keyboard navigation, not mouse clicks
    this.setupFocusVisible();

    // Setup skip links
    if (this.options.enableSkipLinks) {
      this.setupSkipLinks();
    }

    // Setup keyboard shortcuts
    if (this.options.enableShortcuts) {
      this.setupKeyboardShortcuts();
    }

    // Trap focus in modals
    if (this.options.enableFocusTrap) {
      this.observeModals();
    }
  }

  /**
   * Only show focus rings for keyboard navigation
   */
  setupFocusVisible() {
    let isUsingKeyboard = false;

    // Detect keyboard usage
    document.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        isUsingKeyboard = true;
        document.body.classList.add('using-keyboard');
      }
    });

    // Detect mouse usage
    document.addEventListener('mousedown', () => {
      isUsingKeyboard = false;
      document.body.classList.remove('using-keyboard');
    });

    // Add CSS for focus-visible
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('keyboard-nav-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'keyboard-nav-styles';
    style.textContent = `
      /* Hide focus rings by default */
      body:not(.using-keyboard) *:focus {
        outline: none;
      }

      /* Show focus rings when using keyboard */
      body.using-keyboard *:focus {
        outline: 2px solid var(--ink, #0B8073);
        outline-offset: 2px;
      }

      /* Skip links */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--ink, #0B8073);
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        z-index: 10000;
        border-radius: 0 0 4px 0;
        font-weight: 600;
      }

      .skip-link:focus {
        top: 0;
      }

      /* Focusable elements styling */
      [tabindex="0"],
      [tabindex="-1"]:focus {
        position: relative;
      }

      /* Focus trap active indicator */
      body.focus-trapped {
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup skip links for accessibility
   */
  setupSkipLinks() {
    // Check if skip links already exist
    if (document.querySelector('.skip-link')) {
      return;
    }

    const skipLinks = [
      { text: 'Skip to main content', target: 'main' },
      { text: 'Skip to navigation', target: 'nav' },
    ];

    const container = document.createElement('div');
    container.className = 'skip-links';
    container.setAttribute('aria-label', 'Skip links');

    skipLinks.forEach(({ text, target }) => {
      const targetElement = document.querySelector(target);
      if (!targetElement) {
        return;
      }

      // Ensure target has an ID
      if (!targetElement.id) {
        targetElement.id = `skip-target-${target}`;
      }

      const link = document.createElement('a');
      link.href = `#${targetElement.id}`;
      link.className = 'skip-link';
      link.textContent = text;

      link.addEventListener('click', e => {
        e.preventDefault();
        targetElement.tabIndex = -1;
        targetElement.focus();
        targetElement.addEventListener(
          'blur',
          () => {
            targetElement.removeAttribute('tabindex');
          },
          { once: true }
        );
      });

      container.appendChild(link);
    });

    document.body.insertBefore(container, document.body.firstChild);
  }

  /**
   * Register a keyboard shortcut
   * @param {string} key - Key combination (e.g., 'ctrl+k', 'alt+s')
   * @param {Function} handler - Handler function
   * @param {string} description - Description for help menu
   */
  registerShortcut(key, handler, description = '') {
    const normalizedKey = this.normalizeKey(key);
    this.shortcuts.set(normalizedKey, { handler, description });
  }

  /**
   * Setup default keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      const key = this.getKeyCombo(e);
      const shortcut = this.shortcuts.get(key);

      if (shortcut && this.shouldHandleShortcut(e)) {
        e.preventDefault();
        shortcut.handler(e);
      }
    });

    // Register default shortcuts
    this.registerShortcut(
      '/',
      () => {
        const searchInput = document.querySelector('input[type="search"], input[name="search"]');
        if (searchInput) {
          searchInput.focus();
        }
      },
      'Focus search'
    );

    this.registerShortcut(
      'escape',
      () => {
        // Close modals, dialogs, or clear focus
        const activeModal = document.querySelector('.modal[style*="display: block"]');
        if (activeModal) {
          const closeButton = activeModal.querySelector('[data-dismiss], .modal-close');
          if (closeButton) {
            closeButton.click();
          }
        } else {
          document.activeElement?.blur();
        }
      },
      'Close modal or clear focus'
    );

    this.registerShortcut(
      '?',
      () => {
        this.showShortcutsHelp();
      },
      'Show keyboard shortcuts'
    );
  }

  /**
   * Get key combination from event
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {string} - Key combination
   */
  getKeyCombo(e) {
    const parts = [];

    if (e.ctrlKey) {
      parts.push('ctrl');
    }
    if (e.altKey) {
      parts.push('alt');
    }
    if (e.shiftKey) {
      parts.push('shift');
    }
    if (e.metaKey) {
      parts.push('meta');
    }

    // Guard against undefined key
    const key = e.key ? e.key.toLowerCase() : '';
    if (key && !['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Normalize key combination (sort modifiers in consistent order)
   * @param {string} key - Key combination
   * @returns {string} - Normalized key
   */
  normalizeKey(key) {
    // Guard against undefined or null key
    if (!key) {
      return '';
    }

    const parts = key.toLowerCase().split('+');
    const modifiers = ['ctrl', 'alt', 'shift', 'meta'];
    const sorted = [];
    const nonModifiers = [];

    parts.forEach(part => {
      if (modifiers.includes(part)) {
        sorted.push(part);
      } else {
        nonModifiers.push(part);
      }
    });

    // Sort modifiers in standard order
    sorted.sort((a, b) => modifiers.indexOf(a) - modifiers.indexOf(b));

    // Append non-modifier keys
    return [...sorted, ...nonModifiers].join('+');
  }

  /**
   * Check if shortcut should be handled
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {boolean}
   */
  shouldHandleShortcut(e) {
    // Guard against undefined target
    const target = e.target;
    if (!target) {
      return false;
    }

    const tagName = target.tagName ? target.tagName.toLowerCase() : '';

    // Don't handle shortcuts in input fields (except for specific keys like Escape)
    if (['input', 'textarea', 'select'].includes(tagName) && e.key !== 'Escape') {
      return false;
    }

    // Don't handle shortcuts in contentEditable elements
    if (target.isContentEditable) {
      return false;
    }

    return true;
  }

  /**
   * Show keyboard shortcuts help
   */
  showShortcutsHelp() {
    const existing = document.getElementById('keyboard-shortcuts-help');
    if (existing) {
      existing.style.display = 'block';
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'keyboard-shortcuts-help';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'shortcuts-title');
    modal.innerHTML = `
      <div class="modal-backdrop" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
          <h2 id="shortcuts-title" style="margin-top: 0;">Keyboard Shortcuts</h2>
          <div class="shortcuts-list"></div>
          <button class="cta" onclick="this.closest('#keyboard-shortcuts-help').remove()">Close</button>
        </div>
      </div>
    `;

    const list = modal.querySelector('.shortcuts-list');
    this.shortcuts.forEach(({ description }, key) => {
      if (description) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.marginBottom = '8px';
        item.innerHTML = `
          <span>${description}</span>
          <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${key}</kbd>
        `;
        list.appendChild(item);
      }
    });

    document.body.appendChild(modal);

    // Focus first button
    modal.querySelector('button').focus();

    // Close on backdrop click
    modal.querySelector('.modal-backdrop').addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        modal.remove();
      }
    });
  }

  /**
   * Trap focus within an element (for modals)
   * @param {HTMLElement} element - Element to trap focus in
   */
  trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = e => {
      if (e.key !== 'Tab') {
        return;
      }

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTab);

    // Store for later cleanup
    this.focusTrapStack.push({ element, handleTab });

    // Focus first element
    firstElement.focus();

    // Mark body as having focus trap
    document.body.classList.add('focus-trapped');
  }

  /**
   * Release focus trap
   * @param {HTMLElement} element - Element to release focus trap from
   */
  releaseFocusTrap(element) {
    const index = this.focusTrapStack.findIndex(trap => trap.element === element);
    if (index === -1) {
      return;
    }

    const { handleTab } = this.focusTrapStack[index];
    element.removeEventListener('keydown', handleTab);

    this.focusTrapStack.splice(index, 1);

    if (this.focusTrapStack.length === 0) {
      document.body.classList.remove('focus-trapped');
    }
  }

  /**
   * Observe modals and automatically trap focus
   */
  observeModals() {
    if (!window.MutationObserver) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a modal
            if (
              node.classList?.contains('modal') ||
              node.getAttribute('role') === 'dialog' ||
              node.getAttribute('role') === 'alertdialog'
            ) {
              this.trapFocus(node);
            }
          }
        });

        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.releaseFocusTrap(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.keyboardNav = new KeyboardNavigationHelper();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyboardNavigationHelper;
}
