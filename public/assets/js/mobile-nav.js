/**
 * Mobile Navigation Menu Toggle
 * Handles hamburger menu functionality for mobile devices
 */

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('main-nav');
  
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function() {
      const isOpen = navLinks.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', isOpen);
    });
    
    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        navLinks.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
});
