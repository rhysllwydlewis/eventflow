/**
 * Simple Burger Menu Implementation - Built from scratch
 * Minimal, focused, and reliable mobile menu toggle
 */

(function () {
  'use strict';

  // Prevent double initialization
  if (window.__burgerMenuInitialized) {
    console.log('🍔 Burger menu already initialized, skipping...');
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBurgerMenu);
  } else {
    initBurgerMenu();
  }

  function initBurgerMenu() {
    console.log('🍔 Initializing burger menu...');

    // Get DOM elements
    const mobileToggle = document.getElementById('ef-mobile-toggle');
    const mobileMenu = document.getElementById('ef-mobile-menu');
    const bottomMenuBtn = document.getElementById('ef-bottom-menu');

    if (!mobileToggle || !mobileMenu) {
      console.warn('Burger menu elements not found');
      return;
    }

    console.log('✅ Burger menu elements found');

    // Mark as initialized
    window.__burgerMenuInitialized = true;

    // State
    let isOpen = false;

    // Toggle function
    function toggleMenu(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      isOpen = !isOpen;

      console.log(`🔄 Menu ${isOpen ? 'opening' : 'closing'}...`);

      if (isOpen) {
        // Open menu
        mobileMenu.classList.add('open');
        mobileToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('ef-menu-open');
        if (bottomMenuBtn) {
          bottomMenuBtn.setAttribute('aria-expanded', 'true');
        }
      } else {
        // Close menu
        mobileMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('ef-menu-open');
        if (bottomMenuBtn) {
          bottomMenuBtn.setAttribute('aria-expanded', 'false');
        }
      }
    }

    // Attach click handlers
    mobileToggle.addEventListener('click', toggleMenu);
    console.log('✅ Click handler attached to mobile toggle');

    if (bottomMenuBtn) {
      bottomMenuBtn.addEventListener('click', toggleMenu);
      console.log('✅ Click handler attached to bottom menu button');
    }

    // Close menu when clicking on links
    const menuLinks = mobileMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (isOpen && link.getAttribute('href') && link.getAttribute('href') !== '#') {
          console.log('📍 Closing menu after link click');
          toggleMenu();
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) {
        console.log('⎋ Closing menu with Escape key');
        toggleMenu();
        mobileToggle.focus();
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
        console.log('🖱️ Closing menu - clicked outside');
        toggleMenu();
      }
    });

    console.log('🎉 Burger menu initialization complete!');
  }
})();
