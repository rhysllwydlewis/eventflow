/**
 * Simple Burger Menu Implementation - Built from scratch
 * Minimal, focused, and reliable mobile menu toggle
 * With accessibility features: focus trap, ARIA attributes, and inert background
 */

(function () {
  'use strict';

  // Debug flag - set to false to disable console logs
  const DEBUG = false;

  // Prevent double initialization
  if (window.__burgerMenuInitialized) {
    if (DEBUG) console.log('🍔 Burger menu already initialized, skipping...');
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBurgerMenu);
  } else {
    initBurgerMenu();
  }

  function initBurgerMenu() {
    if (DEBUG) console.log('🍔 Initializing burger menu...');

    // Get DOM elements
    const mobileToggle = document.getElementById('ef-mobile-toggle');
    const mobileMenu = document.getElementById('ef-mobile-menu');
    const bottomMenuBtn = document.getElementById('ef-bottom-menu');
    const mainContent = document.querySelector('main');

    if (!mobileToggle || !mobileMenu) {
      if (DEBUG) console.warn('Burger menu elements not found');
      return;
    }

    if (DEBUG) console.log('✅ Burger menu elements found');

    // Mark as initialized
    window.__burgerMenuInitialized = true;

    // State
    let isOpen = false;
    let lastFocusedElement = null;

    // Get all focusable elements within the menu
    function getFocusableElements() {
      return mobileMenu.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
    }

    // Focus trap handler
    function handleFocusTrap(event) {
      if (!isOpen) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Tab key
      if (event.key === 'Tab') {
        // Shift + Tab (backwards)
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } 
        // Tab (forwards)
        else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    // Toggle function
    function toggleMenu(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      isOpen = !isOpen;

      if (DEBUG) console.log(`🔄 Menu ${isOpen ? 'opening' : 'closing'}...`);

      if (isOpen) {
        // Store the element that had focus before opening
        lastFocusedElement = document.activeElement;

        // Open menu
        mobileMenu.classList.add('open');
        mobileToggle.setAttribute('aria-expanded', 'true');
        mobileMenu.setAttribute('aria-hidden', 'false');
        document.body.classList.add('ef-menu-open');
        
        if (bottomMenuBtn) {
          bottomMenuBtn.setAttribute('aria-expanded', 'true');
        }

        // Make background inert (or use aria-hidden as fallback)
        if (mainContent) {
          if ('inert' in mainContent) {
            mainContent.inert = true;
          } else {
            mainContent.setAttribute('aria-hidden', 'true');
          }
        }

        // Focus first menu link
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          // Small delay to ensure menu is visible
          setTimeout(() => {
            focusableElements[0].focus();
          }, 100);
        }

        // Add focus trap listener
        document.addEventListener('keydown', handleFocusTrap);
      } else {
        // Close menu
        mobileMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('ef-menu-open');
        
        if (bottomMenuBtn) {
          bottomMenuBtn.setAttribute('aria-expanded', 'false');
        }

        // Restore background
        if (mainContent) {
          if ('inert' in mainContent) {
            mainContent.inert = false;
          } else {
            mainContent.removeAttribute('aria-hidden');
          }
        }

        // Remove focus trap listener
        document.removeEventListener('keydown', handleFocusTrap);

        // Return focus to the button that opened the menu
        if (lastFocusedElement) {
          lastFocusedElement.focus();
        } else {
          mobileToggle.focus();
        }
      }
    }

    // Attach click handlers
    mobileToggle.addEventListener('click', toggleMenu);
    if (DEBUG) console.log('✅ Click handler attached to mobile toggle');

    if (bottomMenuBtn) {
      bottomMenuBtn.addEventListener('click', toggleMenu);
      if (DEBUG) console.log('✅ Click handler attached to bottom menu button');
    }

    // Close menu when clicking on links
    const menuLinks = mobileMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (isOpen && link.getAttribute('href') && link.getAttribute('href') !== '#') {
          if (DEBUG) console.log('📍 Closing menu after link click');
          toggleMenu();
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) {
        if (DEBUG) console.log('⎋ Closing menu with Escape key');
        toggleMenu();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (
        isOpen &&
        !mobileMenu.contains(e.target) &&
        !mobileToggle.contains(e.target) &&
        (!bottomMenuBtn || !bottomMenuBtn.contains(e.target))
      ) {
        if (DEBUG) console.log('🖱️ Closing menu - clicked outside');
        toggleMenu();
      }
    });

    if (DEBUG) console.log('🎉 Burger menu initialization complete!');
  }
})();
