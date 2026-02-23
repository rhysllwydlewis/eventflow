/**
 * Event Templates
 * Pre-defined templates for common event types
 */

(function () {
  'use strict';

  const TEMPLATES = {
    wedding: {
      id: 'wedding',
      name: 'Wedding',
      icon: '💒',
      description: 'Plan a beautiful wedding celebration',
      eventType: 'wedding',
      budget: 15000,
      guestCount: 100,
      duration: 8,
      categories: [
        { name: 'Venue', priority: 1, budget: 5000 },
        { name: 'Catering', priority: 1, budget: 3500 },
        { name: 'Photography', priority: 2, budget: 1500 },
        { name: 'Flowers', priority: 2, budget: 800 },
        { name: 'Entertainment', priority: 3, budget: 1200 },
        { name: 'Decorations', priority: 3, budget: 1000 },
      ],
      checklist: [
        'Book venue',
        'Hire caterer',
        'Book photographer',
        'Order flowers',
        'Arrange entertainment',
        'Send invitations',
      ],
    },
    birthday: {
      id: 'birthday',
      name: 'Birthday Party',
      icon: '🎂',
      description: 'Celebrate a special birthday',
      eventType: 'birthday',
      budget: 2000,
      guestCount: 30,
      duration: 4,
      categories: [
        { name: 'Venue', priority: 1, budget: 500 },
        { name: 'Catering', priority: 1, budget: 600 },
        { name: 'Entertainment', priority: 2, budget: 400 },
        { name: 'Decorations', priority: 2, budget: 300 },
        { name: 'Photography', priority: 3, budget: 200 },
      ],
      checklist: [
        'Book venue',
        'Order food and drinks',
        'Arrange entertainment',
        'Get decorations',
        'Send invitations',
      ],
    },
    corporate: {
      id: 'corporate',
      name: 'Corporate Event',
      icon: '💼',
      description: 'Host a professional corporate event',
      eventType: 'corporate',
      budget: 8000,
      guestCount: 75,
      duration: 6,
      categories: [
        { name: 'Venue', priority: 1, budget: 2500 },
        { name: 'Catering', priority: 1, budget: 2500 },
        { name: 'AV Equipment', priority: 2, budget: 1500 },
        { name: 'Photography', priority: 2, budget: 800 },
        { name: 'Transportation', priority: 3, budget: 700 },
      ],
      checklist: [
        'Book venue',
        'Arrange catering',
        'Set up AV equipment',
        'Book photographer',
        'Arrange transportation',
        'Send invitations',
      ],
    },
    conference: {
      id: 'conference',
      name: 'Conference',
      icon: '🎤',
      description: 'Organize a professional conference',
      eventType: 'conference',
      budget: 20000,
      guestCount: 200,
      duration: 12,
      categories: [
        { name: 'Venue', priority: 1, budget: 8000 },
        { name: 'Catering', priority: 1, budget: 5000 },
        { name: 'AV Equipment', priority: 1, budget: 3000 },
        { name: 'Signage', priority: 2, budget: 1500 },
        { name: 'Photography', priority: 2, budget: 1200 },
        { name: 'Transportation', priority: 3, budget: 1300 },
      ],
      checklist: [
        'Book conference venue',
        'Arrange catering for all days',
        'Set up AV and tech',
        'Order signage and materials',
        'Book photographer/videographer',
        'Arrange accommodation',
        'Send invitations and manage registrations',
      ],
    },
  };

  /**
   * Get all templates
   * @returns {Array} Array of template objects
   */
  function getAllTemplates() {
    return Object.values(TEMPLATES);
  }

  /**
   * Get template by ID
   * @param {string} id - Template ID
   * @returns {Object|null} Template object or null
   */
  function getTemplate(id) {
    return TEMPLATES[id] || null;
  }

  /**
   * Render template selector UI
   * @param {string} containerId - Container element ID
   * @param {Function} onSelect - Callback when template is selected
   */
  function renderTemplateSelector(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Template container #${containerId} not found`);
      return;
    }

    const templates = getAllTemplates();

    let html = `
      <div class="template-selector">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Choose a template to get started</h3>
        <p class="small" style="color: #6b7280; margin-bottom: 1.5rem;">Or skip and start from scratch</p>
        <div class="template-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
    `;

    templates.forEach(template => {
      html += `
        <div class="template-card" data-template-id="${template.id}" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; cursor: pointer; transition: all 0.2s; background: white;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">${template.icon}</div>
          <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${escapeHtml(template.name)}</h4>
          <p class="small" style="color: #6b7280; margin-bottom: 1rem;">${escapeHtml(template.description)}</p>
          <div class="small" style="color: #9ca3af;">
            <div>💰 Budget: £${template.budget.toLocaleString()}</div>
            <div>👥 Guests: ${template.guestCount}</div>
            <div>⏱️ Duration: ${template.duration}h</div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
        <button class="btn btn-secondary" id="skip-template-btn" style="width: 100%;">Skip and start from scratch</button>
      </div>
    `;

    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const templateId = card.getAttribute('data-template-id');
        const template = getTemplate(templateId);
        if (template && onSelect) {
          onSelect(template);
        }
      });

      // Hover effect
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#0B8073';
        card.style.boxShadow = '0 4px 12px rgba(11, 128, 115, 0.15)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#e5e7eb';
        card.style.boxShadow = 'none';
      });
    });

    const skipBtn = document.getElementById('skip-template-btn');
    if (skipBtn && onSelect) {
      skipBtn.addEventListener('click', () => {
        onSelect(null);
      });
    }
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Export for use in other scripts
  window.EventTemplates = {
    getAll: getAllTemplates,
    getTemplate: getTemplate,
    renderSelector: renderTemplateSelector,
  };
})();
