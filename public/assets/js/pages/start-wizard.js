/**
 * Start Wizard Page Logic
 * Multi-step planning wizard implementation
 */

(function () {
  'use strict';

  // Available categories for wizard steps (in order)
  const CATEGORIES = [
    { key: 'venues', name: 'Venues', icon: '🏛️' },
    { key: 'photography', name: 'Photography', icon: '📸' },
    { key: 'catering', name: 'Catering', icon: '🍽️' },
    { key: 'flowers', name: 'Flowers & Décor', icon: '💐' },
    { key: 'hair-makeup', name: 'Hair & Makeup', icon: '💄' },
    { key: 'entertainment', name: 'Entertainment', icon: '🎵' },
    { key: 'transport', name: 'Transport', icon: '🚗' },
  ];

  let currentStep = 0;
  let wizardState = null;
  const availablePackages = {}; // { categoryKey: [packages] }

  /**
   * Initialize the wizard
   */
  function init() {
    // Load wizard state
    if (typeof window.WizardState === 'undefined') {
      console.error('WizardState not loaded');
      return;
    }

    wizardState = window.WizardState.getState();
    currentStep = wizardState.currentStep || 0;

    // Load categories and packages
    loadCategories();

    // Render initial step
    renderStep(currentStep);

    // Render plan summary
    renderPlanSummary();
  }

  /**
   * Load categories from API
   */
  async function loadCategories() {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      // Categories loaded successfully
      console.log('Categories loaded:', data.items.length);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }

  /**
   * Load packages for a category
   * @param {string} categoryKey - Category key
   * @param {string} eventType - Event type filter
   */
  async function loadPackagesForCategory(categoryKey, eventType) {
    try {
      const params = new URLSearchParams({
        category: categoryKey,
        eventType: eventType || 'Other',
        approved: 'true',
      });

      const response = await fetch(`/api/packages/search?${params}`);
      const data = await response.json();
      availablePackages[categoryKey] = data.items || [];
      return data.items || [];
    } catch (err) {
      console.error('Error loading packages:', err);
      return [];
    }
  }

  /**
   * Render a wizard step
   * @param {number} stepIndex - Step to render
   */
  function renderStep(stepIndex) {
    const container = document.getElementById('wizard-container');
    if (!container) {
      return;
    }

    let html = '';

    // Progress indicator
    const totalSteps = 2 + CATEGORIES.length + 1; // event type + location + categories + review
    const progressPercent = Math.round((stepIndex / (totalSteps - 1)) * 100);

    html += `
      <div class="wizard-progress">
        <div class="wizard-progress-bar" style="width: ${progressPercent}%"></div>
      </div>
      <div class="wizard-step-indicator">Step ${stepIndex + 1} of ${totalSteps}</div>
    `;

    // Step content
    if (stepIndex === 0) {
      html += renderEventTypeStep();
    } else if (stepIndex === 1) {
      html += renderLocationStep();
    } else if (stepIndex >= 2 && stepIndex < totalSteps - 1) {
      const categoryIndex = stepIndex - 2;
      html += renderCategoryStep(CATEGORIES[categoryIndex]);
    } else {
      html += renderReviewStep();
    }

    container.innerHTML = html;

    // Attach event listeners
    attachStepListeners(stepIndex);
  }

  /**
   * Render event type selection step
   */
  function renderEventTypeStep() {
    const state = window.WizardState.getState();
    return `
      <div class="wizard-card">
        <h2>What type of event are you planning?</h2>
        <p class="small">This helps us show you the most relevant suppliers.</p>
        
        <div class="wizard-options">
          <button class="wizard-option ${state.eventType === 'Wedding' ? 'selected' : ''}" 
                  data-value="Wedding" type="button" id="event-type-wedding">
            <div class="wizard-option-image-container">
              <img class="wizard-option-image" id="wedding-image" alt="Wedding" />
            </div>
            <span class="wizard-option-label">Wedding</span>
          </button>
          <button class="wizard-option ${state.eventType === 'Other' ? 'selected' : ''}" 
                  data-value="Other" type="button" id="event-type-other">
            <div class="wizard-option-image-container">
              <img class="wizard-option-image" id="other-event-image" alt="Other Event" />
            </div>
            <span class="wizard-option-label">Other Event</span>
          </button>
        </div>

        <div class="wizard-actions">
          <button class="cta wizard-next" disabled>Continue</button>
        </div>
      </div>
    `;
  }

  /**
   * Load event type images - using local assets
   */
  async function loadEventTypeImages() {
    const weddingImg = document.getElementById('wedding-image');
    const otherImg = document.getElementById('other-event-image');

    if (weddingImg) {
      // Use venue image for wedding (elegant wedding venue)
      weddingImg.src = '/assets/images/collage-venue.webp';
      weddingImg.alt = 'Wedding venue';
    }

    if (otherImg) {
      // Use entertainment/party image for other events
      otherImg.src = '/assets/images/collage-entertainment.webp';
      otherImg.alt = 'Party and events';
    }
  }

  /**
   * Render location & details step
   */
  function renderLocationStep() {
    const state = window.WizardState.getState();
    return `
      <div class="wizard-card">
        <h2>Where will your ${state.eventType || 'event'} be?</h2>
        <p class="small">Location helps us find local suppliers. You can skip this step if you're not sure yet.</p>
        
        <div class="form-row">
          <label>Location</label>
          <input type="text" id="wizard-location" placeholder="Town, city or postcode" 
                 value="${escapeHtml(state.location || '')}">
        </div>

        <div class="form-row">
          <label>Event Date <span class="small">(optional)</span></label>
          <input type="date" id="wizard-date" value="${state.date || ''}">
        </div>

        <div class="form-row">
          <label>Guest Count <span class="small">(approximate)</span></label>
          <input type="number" id="wizard-guests" min="1" placeholder="e.g. 60" 
                 value="${state.guests || ''}">
        </div>

        <div class="form-row">
          <label>Budget</label>
          <select id="wizard-budget">
            <option value="">Not sure yet</option>
            <option ${state.budget === 'Up to £1,000' ? 'selected' : ''}>Up to £1,000</option>
            <option ${state.budget === '£1,000–£3,000' ? 'selected' : ''}>£1,000–£3,000</option>
            <option ${state.budget === '£3,000–£10,000' ? 'selected' : ''}>£3,000–£10,000</option>
            <option ${state.budget === '£10,000+' ? 'selected' : ''}>£10,000+</option>
          </select>
        </div>

        <div class="wizard-actions">
          <button class="cta secondary wizard-back">Back</button>
          <button class="cta wizard-next">Continue</button>
          <button class="wizard-skip">Skip</button>
        </div>
      </div>
    `;
  }

  /**
   * Render category package selection step
   * @param {Object} category - Category object
   */
  function renderCategoryStep(category) {
    const state = window.WizardState.getState();
    const selectedPackageId = state.selectedPackages[category.key];

    return `
      <div class="wizard-card">
        <h2>${category.icon} ${category.name}</h2>
        <p class="small">Browse packages for ${category.name.toLowerCase()}. You can skip this and come back later.</p>
        
        <div id="wizard-packages-${category.key}" class="wizard-packages">
          <p class="small">Loading packages...</p>
        </div>

        <div class="wizard-actions">
          <button class="cta secondary wizard-back">Back</button>
          <button class="cta wizard-next">Continue</button>
          <button class="wizard-skip">Skip for now</button>
        </div>
      </div>
    `;
  }

  /**
   * Render review & create plan step
   */
  function renderReviewStep() {
    const state = window.WizardState.getState();
    const selectedPackages = Object.keys(state.selectedPackages || {});

    return `
      <div class="wizard-card">
        <h2>Review Your Selections</h2>
        <p class="small">Here's what you've chosen. Ready to create your plan?</p>
        
        <div class="wizard-review">
          <div class="wizard-review-section">
            <h3>Event Details</h3>
            <p><strong>Type:</strong> ${escapeHtml(state.eventType || 'Not specified')}</p>
            ${state.location ? `<p><strong>Location:</strong> ${escapeHtml(state.location)}</p>` : ''}
            ${state.date ? `<p><strong>Date:</strong> ${state.date}</p>` : ''}
            ${state.guests ? `<p><strong>Guests:</strong> ${state.guests}</p>` : ''}
            ${state.budget ? `<p><strong>Budget:</strong> ${escapeHtml(state.budget)}</p>` : ''}
          </div>

          <div class="wizard-review-section">
            <h3>Selected Packages</h3>
            ${
              selectedPackages.length > 0
                ? `<p>${selectedPackages.length} package(s) selected</p>`
                : '<p class="small">No packages selected yet</p>'
            }
          </div>
        </div>

        <div class="wizard-actions">
          <button class="cta secondary wizard-back">Back</button>
          <button class="cta wizard-create-plan">Create My Plan</button>
        </div>
      </div>
    `;
  }

  /**
   * Render plan summary sidebar/drawer
   */
  function renderPlanSummary() {
    const container = document.getElementById('plan-summary');
    if (!container) {
      return;
    }

    const state = window.WizardState.getState();
    const selectedCount = Object.keys(state.selectedPackages || {}).length;

    let html = `
      <h3>Your Plan</h3>
      <div class="plan-summary-item">
        <span class="small">Event Type:</span>
        <span>${escapeHtml(state.eventType || 'Not selected')}</span>
      </div>
    `;

    if (state.location) {
      html += `
        <div class="plan-summary-item">
          <span class="small">Location:</span>
          <span>${escapeHtml(state.location)}</span>
        </div>
      `;
    }

    html += `
      <div class="plan-summary-item">
        <span class="small">Packages:</span>
        <span>${selectedCount} selected</span>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Attach event listeners for current step
   * @param {number} stepIndex - Current step
   */
  function attachStepListeners(stepIndex) {
    // Event type selection
    if (stepIndex === 0) {
      // Load event type images from Pexels
      loadEventTypeImages();

      const options = document.querySelectorAll('.wizard-option');
      options.forEach(opt => {
        opt.addEventListener('click', function () {
          options.forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          const value = this.getAttribute('data-value');
          window.WizardState.saveStep(0, { eventType: value });
          document.querySelector('.wizard-next').disabled = false;
        });
      });
    }

    // Category step - load packages
    if (stepIndex >= 2 && stepIndex < 2 + CATEGORIES.length) {
      const categoryIndex = stepIndex - 2;
      const category = CATEGORIES[categoryIndex];
      const state = window.WizardState.getState();
      loadPackagesForCategory(category.key, state.eventType).then(packages => {
        renderPackageList(category.key, packages);
      });
    }

    // Next button
    const nextBtn = document.querySelector('.wizard-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', handleNext);
    }

    // Back button
    const backBtn = document.querySelector('.wizard-back');
    if (backBtn) {
      backBtn.addEventListener('click', handleBack);
    }

    // Skip button
    const skipBtn = document.querySelector('.wizard-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', handleNext);
    }

    // Create plan button
    const createBtn = document.querySelector('.wizard-create-plan');
    if (createBtn) {
      createBtn.addEventListener('click', handleCreatePlan);
    }
  }

  /**
   * Render package list for category
   * @param {string} categoryKey - Category key
   * @param {Array} packages - Packages array
   */
  function renderPackageList(categoryKey, packages) {
    const container = document.getElementById(`wizard-packages-${categoryKey}`);
    if (!container) {
      return;
    }

    if (packages.length === 0) {
      container.innerHTML = '<p class="small">No packages available for this category yet.</p>';
      return;
    }

    const state = window.WizardState.getState();
    const selectedId = state.selectedPackages[categoryKey];

    let html = '<div class="wizard-package-grid">';
    packages.slice(0, 6).forEach(pkg => {
      const isSelected = pkg.id === selectedId;
      html += `
        <div class="wizard-package-card ${isSelected ? 'selected' : ''}" 
             data-package-id="${pkg.id}" data-category="${categoryKey}">
          ${pkg.image ? `<img src="${pkg.image}" alt="${escapeHtml(pkg.title)}">` : ''}
          <h4>${escapeHtml(pkg.title)}</h4>
          <p class="small">${escapeHtml(pkg.price_display || pkg.price || 'Contact for pricing')}</p>
          ${isSelected ? '<div class="wizard-package-selected">✓ Selected</div>' : ''}
        </div>
      `;
    });
    html += '</div>';

    if (packages.length > 6) {
      html += `<p class="small">Showing 6 of ${packages.length} packages. <a href="/suppliers.html?category=${categoryKey}">View all</a></p>`;
    }

    container.innerHTML = html;

    // Attach click handlers
    const cards = container.querySelectorAll('.wizard-package-card');
    cards.forEach(card => {
      card.addEventListener('click', function () {
        const packageId = this.getAttribute('data-package-id');
        const catKey = this.getAttribute('data-category');
        const wasSelected = this.classList.contains('selected');

        // Deselect all in category
        cards.forEach(c => c.classList.remove('selected'));

        if (!wasSelected) {
          this.classList.add('selected');
          window.WizardState.selectPackage(catKey, packageId);
        } else {
          window.WizardState.deselectPackage(catKey);
        }

        renderPlanSummary();
      });
    });
  }

  /**
   * Handle next button
   */
  function handleNext() {
    // Save current step data
    if (currentStep === 1) {
      const location = document.getElementById('wizard-location')?.value || '';
      const date = document.getElementById('wizard-date')?.value || '';
      const guests = document.getElementById('wizard-guests')?.value || null;
      const budget = document.getElementById('wizard-budget')?.value || '';

      window.WizardState.saveStep(1, {
        location,
        date,
        guests: guests ? parseInt(guests, 10) : null,
        budget,
      });
    }

    // Move to next step
    const totalSteps = 2 + CATEGORIES.length + 1;
    currentStep = Math.min(currentStep + 1, totalSteps - 1);
    renderStep(currentStep);
    renderPlanSummary();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Handle back button
   */
  function handleBack() {
    currentStep = Math.max(currentStep - 1, 0);
    renderStep(currentStep);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Handle create plan button
   */
  async function handleCreatePlan() {
    const createBtn = document.querySelector('.wizard-create-plan');
    if (!createBtn) {
      return;
    }

    // Disable button
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
      // Check if user is logged in
      const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
      const isLoggedIn = authResponse.ok;

      if (!isLoggedIn) {
        // Store draft and redirect to auth
        window.WizardState.markCompleted();
        alert('Please log in to save your plan. Your selections will be preserved.');
        location.href = '/auth.html?redirect=/start.html';
        return;
      }

      // Create plan via API
      const planData = window.WizardState.exportForPlanCreation();
      const response = await fetch('/api/me/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify(planData),
      });

      if (!response.ok) {
        throw new Error('Failed to create plan');
      }

      // Success!
      window.WizardState.clearState();
      alert('Your plan has been created!');
      location.href = '/dashboard-customer.html';
    } catch (err) {
      console.error('Error creating plan:', err);
      alert('There was an error creating your plan. Please try again.');
      createBtn.disabled = false;
      createBtn.textContent = 'Create My Plan';
    }
  }

  /**
   * Get CSRF token from meta tag or cookie
   */
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
      return meta.getAttribute('content');
    }
    // Try cookie
    const match = document.cookie.match(/csrfToken=([^;]+)/);
    return match ? match[1] : '';
  }

  /**
   * HTML escape utility
   */
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
      return '';
    }
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
