/**
 * Supplier Dashboard Enhancements
 * Adds export buttons and other P3 features
 */

(function () {
  'use strict';

  /**
   * Utility: time-based theme class for welcome card
   */
  function applyTimeBasedGreeting() {
    const card = document.querySelector('.supplier-welcome-card');
    const greetingEl = document.getElementById('welcome-greeting');
    if (!card || !greetingEl) return;

    const NIGHT_THEME_HOUR = 21;

    const hour = new Date().getHours();
    let variant = 'afternoon';
    let greeting = 'Good day,';
    if (hour < 12) {
      variant = 'morning';
      greeting = 'Good morning,';
    } else if (hour < 18) {
      variant = 'afternoon';
      greeting = 'Good afternoon,';
    } else {
      variant = hour < NIGHT_THEME_HOUR ? 'evening' : 'night';
      greeting = 'Good evening,';
    }

    card.classList.add(`supplier-welcome-card--${variant}`);
    greetingEl.textContent = greeting;
  }

  /**
   * Utility: animate stat counters when visible
   */
  function setupStatCounters() {
    const counters = document.querySelectorAll('.welcome-stat-value[data-target]');
    if (!counters.length) return;

    const animate = (el) => {
      const target = parseInt(el.getAttribute('data-target'), 10) || 0;
      const duration = 900;
      const start = performance.now();
      const initial = 0;

      function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.floor(initial + (target - initial) * progress);
        el.textContent = value.toLocaleString();
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach((c) => observer.observe(c));
  }

  /**
   * Mobile nav indicator + snap scrolling
   */
  function setupMobileNav() {
    const nav = document.querySelector('.mobile-nav-pills');
    if (!nav) return;
    const pills = nav.querySelectorAll('.mobile-nav-pill');
    if (!pills.length) return;

    let indicator = nav.querySelector('.mobile-nav-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'mobile-nav-indicator';
      nav.appendChild(indicator);
    }

    const moveIndicator = (pill) => {
      const rect = pill.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const width = rect.width;
      const offset = rect.left - navRect.left + nav.scrollLeft;
      indicator.style.width = `${width}px`;
      indicator.style.transform = `translateX(${offset}px)`;
    };

    const setActive = (pill) => {
      pills.forEach((p) => p.classList.toggle('active', p === pill));
      moveIndicator(pill);
    };

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        setActive(pill);
        const targetId = pill.getAttribute('data-section');
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    const LAYOUT_PAINT_DELAY = 50; // Wait for browser layout/paint to measure pill widths
    setTimeout(() => setActive(pills[0]), LAYOUT_PAINT_DELAY);
  }

  /**
   * Quick actions horizontal scroll on mobile
   */
  function setupQuickActionsCarousel() {
    const container = document.querySelector('.supplier-actions-primary');
    if (!container) return;
    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('pointerdown', (e) => {
      if (window.innerWidth > 768) return;
      isDown = true;
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });
    container.addEventListener('pointerleave', () => (isDown = false));
    container.addEventListener('pointerup', () => (isDown = false));
    container.addEventListener('pointermove', (e) => {
      if (!isDown || window.innerWidth > 768) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = x - startX;
      container.scrollLeft = scrollLeft - walk;
    });
  }

  /**
   * Add CSV export button to enquiries section
   */
  function addExportButton() {
    // Check if export button already exists first
    if (document.getElementById('export-enquiries-btn')) {
      return;
    }

    // Wait for dashboard to load
    const observer = new MutationObserver(() => {
      // Look for enquiries section or stats
      const statsSection = document.querySelector('.stats-grid, .dashboard-stats, #stats-section');
      
      if (statsSection) {
        // Double-check button doesn't exist
        if (document.getElementById('export-enquiries-btn')) {
          observer.disconnect();
          return;
        }

        // Create export button
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-enquiries-btn';
        exportBtn.className = 'btn btn-secondary';
        exportBtn.innerHTML = '📥 Export Enquiries';
        exportBtn.style.marginTop = '1rem';
        
        exportBtn.addEventListener('click', async () => {
          try {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Exporting...';
            
            const response = await fetch('/api/supplier/enquiries/export', {
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error('Export failed');
            }
            
            // Download the CSV file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `enquiries-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            exportBtn.disabled = false;
            exportBtn.innerHTML = '📥 Export Enquiries';
            
            // Show success message
            alert('Enquiries exported successfully!');
          } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export enquiries. Please try again.');
            exportBtn.disabled = false;
            exportBtn.innerHTML = '📥 Export Enquiries';
          }
        });

        // Add button after stats section
        statsSection.insertAdjacentElement('afterend', exportBtn);
        
        observer.disconnect();
      }
    });

    // Start observing
    const main = document.querySelector('main, #main-content');
    if (main) {
      observer.observe(main, { childList: true, subtree: true });
    }
  }

  /**
   * Trigger confetti on trial activation success
   */
  function setupTrialConfetti() {
    // Listen for trial activation
    const trialBtn = document.querySelector('#activate-trial-btn, [data-action="activate-trial"]');
    if (trialBtn) {
      trialBtn.addEventListener('click', () => {
        // Wait a bit for the success response
        setTimeout(() => {
          if (typeof triggerSuccessConfetti === 'function') {
            triggerSuccessConfetti();
          }
        }, 1000);
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyTimeBasedGreeting();
      setupStatCounters();
      setupMobileNav();
      setupQuickActionsCarousel();
      addExportButton();
      setupTrialConfetti();
    });
  } else {
    applyTimeBasedGreeting();
    setupStatCounters();
    setupMobileNav();
    setupQuickActionsCarousel();
    addExportButton();
    setupTrialConfetti();
  }
})();
