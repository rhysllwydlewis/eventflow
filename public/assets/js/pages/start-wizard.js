/**
 * Start Wizard Page Logic
 * Multi-step planning wizard implementation
 */

(function () {
  'use strict';

  // Available categories for wizard steps (in order)
  const CATEGORIES = [
    { key: 'venues', name: 'Venues', icon: '🏛️', step: 3 },
    { key: 'photography', name: 'Photography', icon: '📸', step: 4 },
    { key: 'catering', name: 'Catering', icon: '🍽️', step: 5 },
    { key: 'flowers', name: 'Flowers & Décor', icon: '💐', step: 6 },
  ];

  const WIZARD_DATA_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  const TOTAL_STEPS = 8; // welcome, event type, event basics, 4 categories, review, success

  let currentStep = -1; // Start at -1 for welcome screen
  let wizardState = null;
  const availablePackages = {}; // { categoryKey: [packages] }
  let hasShownWelcome = false;

  /**
   * Initialize the wizard
   */
  function init() {
    // Load wizard state
    if (typeof window.WizardState === 'undefined') {
      console.error('WizardState not loaded');
      return;
    }

    // Check if we need to restore from localStorage
    restoreWizardState();

    wizardState = window.WizardState.getState();
    
    // Set up autosave callback
    window.WizardState.setAutosaveCallback(handleAutosave);
    
    // Check if user has started wizard before
    const timeSinceUpdate = window.WizardState.getTimeSinceLastUpdate();
    hasShownWelcome = timeSinceUpdate < WIZARD_DATA_EXPIRY_MS && wizardState.wizardStartedAt;
    
    // Determine starting step
    if (hasShownWelcome && wizardState.currentStep >= 0) {
      currentStep = wizardState.currentStep;
    } else {
      currentStep = -1; // Show welcome screen
    }

    // Parse URL params and prefill wizard state if present
    const urlParams = new URLSearchParams(window.location.search);
    const hasParams = Array.from(urlParams.keys()).length > 0;

    if (hasParams) {
      // Prefill step 0 (event type) if provided
      const eventType = urlParams.get('eventType');
      if (eventType && (eventType === 'Wedding' || eventType === 'Other')) {
        window.WizardState.saveStep(0, { eventType });
      }

      // Prefill step 1 (location, guests, budget) if provided
      const prefillData = {};
      const location = urlParams.get('location');
      const guests = urlParams.get('guests');
      const budget = urlParams.get('budget');

      if (location) {
        prefillData.location = location;
      }
      if (guests && !isNaN(parseInt(guests, 10))) {
        prefillData.guests = parseInt(guests, 10);
      }
      if (budget) {
        prefillData.budget = budget;
      }

      // Only save if we have data to prefill
      if (Object.keys(prefillData).length > 0) {
        window.WizardState.saveStep(1, prefillData);
      }

      // Reload state after prefilling
      wizardState = window.WizardState.getState();
    }

    // Load categories and packages
    loadCategories();

    // Render initial step
    renderStep(currentStep);

    // Render plan summary
    renderPlanSummary();
  }

  /**
   * Handle autosave callback
   */
  function handleAutosave(state) {
    showAutosaveIndicator();
  }

  /**
   * Show autosave indicator briefly
   */
  function showAutosaveIndicator() {
    const summary = document.getElementById('plan-summary');
    if (!summary) return;

    // Check if indicator already exists
    let indicator = summary.querySelector('.wizard-autosave');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'wizard-autosave';
      indicator.innerHTML = `
        <span class="wizard-autosave-icon">✓</span>
        <span class="wizard-autosave-text">All changes saved</span>
      `;
      summary.appendChild(indicator);
    }

    // Show indicator
    indicator.style.display = 'flex';

    // Hide after 3 seconds
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
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
      // Special handling for venues - use proximity filtering if location is set
      if (categoryKey === 'venues') {
        const state = window.WizardState.getState();
        if (state.location) {
          // Use venue proximity endpoint
          const params = new URLSearchParams({
            location: state.location,
            radiusMiles: '10',
          });

          const response = await fetch(`/api/venues/near?${params}`);
          const data = await response.json();

          // Convert venues to package format for display
          const venues = (data.venues || []).map(venue => ({
            id: venue.id,
            title: venue.name,
            supplierId: venue.id,
            supplierName: venue.name,
            description: venue.description_short || '',
            price: venue.price_display || 'POA',
            image: venue.photos && venue.photos[0] ? venue.photos[0] : null,
            category: venue.category,
            distance: venue.distance,
            _isVenue: true,
          }));

          availablePackages[categoryKey] = venues;
          return venues;
        }
      }

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

    // Step-specific rendering
    if (stepIndex === -1) {
      // Welcome screen (no progress indicator)
      html += renderWelcomeScreen();
    } else {
      // Add progress indicator for all other steps
      html += renderProgressIndicator(stepIndex);

      // Render step content
      if (stepIndex === 0) {
        html += renderEventTypeStep();
      } else if (stepIndex === 1) {
        html += renderEventBasicsStep();
      } else if (stepIndex >= 2 && stepIndex < 2 + CATEGORIES.length) {
        const categoryIndex = stepIndex - 2;
        html += renderCategoryStep(CATEGORIES[categoryIndex]);
      } else if (stepIndex === 2 + CATEGORIES.length) {
        html += renderReviewStep();
      } else if (stepIndex === 2 + CATEGORIES.length + 1) {
        html += renderSuccessScreen();
      }
    }

    container.innerHTML = html;

    // Attach event listeners
    attachStepListeners(stepIndex);
  }

  /**
   * Render welcome screen
   */
  function renderWelcomeScreen() {
    return `
      <div class="wizard-card wizard-welcome">
        <h1>Plan Your Perfect Event</h1>
        <p class="wizard-welcome-subtitle">Let us help you create an amazing event in just a few minutes</p>
        
        <div class="wizard-welcome-benefits">
          <div class="wizard-benefit">
            <div class="wizard-benefit-icon">⏱️</div>
            <div class="wizard-benefit-text">Takes about 5 minutes to complete</div>
          </div>
          <div class="wizard-benefit">
            <div class="wizard-benefit-icon">📝</div>
            <div class="wizard-benefit-text">We'll ask 6 simple questions about your event</div>
          </div>
          <div class="wizard-benefit">
            <div class="wizard-benefit-icon">💾</div>
            <div class="wizard-benefit-text">Your progress is automatically saved</div>
          </div>
          <div class="wizard-benefit">
            <div class="wizard-benefit-icon">⏭️</div>
            <div class="wizard-benefit-text">Skip any step you're unsure about</div>
          </div>
        </div>

        <div class="wizard-welcome-actions">
          <button class="cta wizard-get-started" type="button">Get Started</button>
        </div>
      </div>
    `;
  }

  /**
   * Render progress indicator with step circles
   * @param {number} stepIndex - Current step (0-based)
   */
  function renderProgressIndicator(stepIndex) {
    const totalSteps = TOTAL_STEPS - 2; // Exclude welcome and success
    const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);
    
    // Step titles
    const stepTitles = [
      'Event Type',
      'Event Basics',
      'Venues',
      'Photography',
      'Catering',
      'Flowers & Décor',
      'Review',
    ];

    const currentTitle = stepTitles[stepIndex] || 'Planning';

    // Generate step circles (show max 7 circles for cleaner UI)
    let circlesHTML = '';
    const maxCircles = Math.min(7, totalSteps);
    
    for (let i = 0; i < maxCircles; i++) {
      const isCompleted = i < stepIndex;
      const isCurrent = i === stepIndex;
      const isUpcoming = i > stepIndex;
      
      let circleClass = 'wizard-step-circle';
      if (isCompleted) circleClass += ' completed';
      if (isCurrent) circleClass += ' current';
      if (isUpcoming) circleClass += ' upcoming';
      
      circlesHTML += `<div class="${circleClass}">${isCompleted ? '✓' : i + 1}</div>`;
      
      // Add connector between circles (except after last)
      if (i < maxCircles - 1) {
        const connectorClass = isCompleted ? 'wizard-step-connector completed' : 'wizard-step-connector';
        circlesHTML += `<div class="${connectorClass}"></div>`;
      }
    }

    return `
      <div class="wizard-progress-container">
        <div class="wizard-progress-info">
          <span class="wizard-progress-percentage">${progressPercent}% Complete</span>
          <span class="wizard-step-indicator">Step ${stepIndex + 1} of ${totalSteps}</span>
        </div>
        <div class="wizard-progress">
          <div class="wizard-progress-bar" style="width: ${progressPercent}%"></div>
        </div>
        <div class="wizard-step-title">${currentTitle}</div>
      </div>
    `;
  }

  /**
   * Render event type selection step
   */
  function renderEventTypeStep() {
    const state = window.WizardState.getState();
    return `
      <div class="wizard-card">
        <h2>What type of event are you planning?</h2>
        <p class="small">This helps us show you the most relevant suppliers and packages.</p>
        
        <div class="wizard-options">
          <button class="wizard-option ${state.eventType === 'Wedding' ? 'selected' : ''}" 
                  data-value="Wedding" type="button" id="event-type-wedding">
            <div class="wizard-option-image-container">
              <img class="wizard-option-image" id="wedding-image" alt="Wedding" />
            </div>
            <span class="wizard-option-label">Wedding</span>
          </button>
          <button class="wizard-option ${state.eventType === 'Corporate' ? 'selected' : ''}" 
                  data-value="Corporate" type="button" id="event-type-corporate">
            <div class="wizard-option-image-container">
              <img class="wizard-option-image" id="corporate-image" alt="Corporate Event" />
            </div>
            <span class="wizard-option-label">Corporate Event</span>
          </button>
          <button class="wizard-option ${state.eventType === 'Birthday' ? 'selected' : ''}" 
                  data-value="Birthday" type="button" id="event-type-birthday">
            <div class="wizard-option-image-container">
              <img class="wizard-option-image" id="birthday-image" alt="Birthday Party" />
            </div>
            <span class="wizard-option-label">Birthday Party</span>
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
          <button class="cta secondary wizard-back" type="button">Back</button>
          <button class="cta wizard-next" type="button" ${!state.eventType ? 'disabled' : ''}>Continue</button>
        </div>
      </div>
    `;
  }

  /**
   * Load event type images from Pexels CDN
   */
  async function loadEventTypeImages() {
    const images = {
      wedding: document.getElementById('wedding-image'),
      corporate: document.getElementById('corporate-image'),
      birthday: document.getElementById('birthday-image'),
      other: document.getElementById('other-event-image'),
    };

    if (images.wedding) {
      images.wedding.src = 'https://images.pexels.com/photos/265885/pexels-photo-265885.jpeg?auto=compress&cs=tinysrgb&w=600';
      images.wedding.alt = 'Wedding couple getting married';
    }

    if (images.corporate) {
      images.corporate.src = 'https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg?auto=compress&cs=tinysrgb&w=600';
      images.corporate.alt = 'Corporate business event';
    }

    if (images.birthday) {
      images.birthday.src = 'https://images.pexels.com/photos/1543762/pexels-photo-1543762.jpeg?auto=compress&cs=tinysrgb&w=600';
      images.birthday.alt = 'Birthday celebration';
    }

    if (images.other) {
      images.other.src = 'https://images.pexels.com/photos/2306281/pexels-photo-2306281.jpeg?auto=compress&cs=tinysrgb&w=600';
      images.other.alt = 'Elegant gala dinner party';
    }
  }

  /**
   * Render event basics step (name, date, location, guests, budget)
   */
  function renderEventBasicsStep() {
    const state = window.WizardState.getState();
    return `
      <div class="wizard-card">
        <h2>Let's start with the basics</h2>
        <p class="small">Tell us about your ${state.eventType || 'event'}. Don't worry, you can skip any field you're not sure about yet.</p>
        
        <div class="form-row">
          <label for="wizard-event-name">What's your event called? <span class="small">(optional)</span></label>
          <input type="text" id="wizard-event-name" placeholder="e.g., Sarah & John's Wedding" 
                 value="${escapeHtml(state.eventName || '')}">
          <span class="helper-text">Give your event a memorable name</span>
        </div>

        <div class="form-row">
          <label for="wizard-date">When are you planning your event? <span class="small">(optional)</span></label>
          <input type="date" id="wizard-date" value="${state.date || ''}">
          <span class="helper-text">This helps us check supplier availability</span>
        </div>

        <div class="form-row">
          <label for="wizard-location">Where will it take place?</label>
          <input type="text" id="wizard-location" placeholder="Town, city or postcode" 
                 value="${escapeHtml(state.location || '')}">
          <span class="helper-text">Helps us find local suppliers near you</span>
        </div>

        <div class="form-row">
          <label for="wizard-guests">How many guests? <span class="small">(approximate)</span></label>
          <input type="number" id="wizard-guests" min="1" placeholder="e.g., 60" 
                 value="${state.guests || ''}">
          <span class="helper-text">Just an estimate is fine</span>
        </div>

        <div class="form-row">
          <label for="wizard-budget">What's your budget?</label>
          <select id="wizard-budget">
            <option value="">Not sure yet</option>
            <option ${state.budget === 'Up to £1,000' ? 'selected' : ''}>Up to £1,000</option>
            <option ${state.budget === '£1,000–£3,000' ? 'selected' : ''}>£1,000–£3,000</option>
            <option ${state.budget === '£3,000–£5,000' ? 'selected' : ''}>£3,000–£5,000</option>
            <option ${state.budget === '£5,000–£10,000' ? 'selected' : ''}>£5,000–£10,000</option>
            <option ${state.budget === '£10,000–£20,000' ? 'selected' : ''}>£10,000–£20,000</option>
            <option ${state.budget === '£20,000+' ? 'selected' : ''}>£20,000+</option>
          </select>
          <span class="helper-text">Helps us recommend packages within your range</span>
        </div>

        <div class="wizard-actions">
          <button class="cta secondary wizard-back" type="button">Back</button>
          <button class="cta wizard-next" type="button">Continue</button>
          <button class="wizard-skip" type="button">Skip for now</button>
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

    // Add proximity indicator for venues if location is set
    let proximityInfo = '';
    if (category.key === 'venues' && state.location) {
      proximityInfo = `
        <div class="wizard-proximity-info" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p class="small" style="margin: 0; color: #0369a1;">
            📍 Showing venues within 10 miles of <strong>${escapeHtml(state.location)}</strong>
          </p>
        </div>
      `;
    }

    return `
      <div class="wizard-card">
        <h2>${category.icon} ${category.name}</h2>
        <p class="small">Browse packages for ${category.name.toLowerCase()}. You can skip this and come back later.</p>
        ${proximityInfo}
        
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
        <h2>Review Your Event Plan</h2>
        <p class="small">Here's what you've chosen. Ready to create your plan?</p>
        
        <div class="wizard-review">
          <div class="wizard-review-section">
            <h3>📋 Event Details</h3>
            <p><strong>Type:</strong> ${escapeHtml(state.eventType || 'Not specified')}</p>
            ${state.eventName ? `<p><strong>Name:</strong> ${escapeHtml(state.eventName)}</p>` : ''}
            ${state.location ? `<p><strong>Location:</strong> ${escapeHtml(state.location)}</p>` : ''}
            ${state.date ? `<p><strong>Date:</strong> ${formatDate(state.date)}</p>` : ''}
            ${state.guests ? `<p><strong>Guests:</strong> ${state.guests}</p>` : ''}
            ${state.budget ? `<p><strong>Budget:</strong> ${escapeHtml(state.budget)}</p>` : ''}
            <a href="#" class="wizard-review-edit" data-step="1">✏️ Edit details</a>
          </div>

          <div class="wizard-review-section">
            <h3>🎯 Selected Services</h3>
            ${
              selectedPackages.length > 0
                ? `<p>You've selected <strong>${selectedPackages.length} package(s)</strong> for your event.</p>
                   <p class="small">These will be added to your event plan for easy reference.</p>`
                : '<p class="small">No packages selected yet. You can browse suppliers after creating your plan.</p>'
            }
          </div>
        </div>

        <div class="wizard-actions">
          <button class="cta secondary wizard-back" type="button">Back</button>
          <button class="cta wizard-create-plan" type="button">Create My Plan 🎉</button>
        </div>
      </div>
    `;
  }

  /**
   * Render success screen
   */
  function renderSuccessScreen() {
    const state = window.WizardState.getState();
    
    return `
      <div class="wizard-card wizard-success">
        <span class="wizard-success-icon">🎉</span>
        <h2>Congratulations!</h2>
        <p class="wizard-success-message">Your event plan has been created successfully. You're all set to start organizing your ${state.eventType || 'event'}!</p>
        
        <div class="wizard-success-summary">
          <h3>What's Next?</h3>
          <p>Browse suppliers, invite guests, or download your plan summary to get started.</p>
        </div>

        <div class="wizard-success-actions">
          <button class="cta" type="button" onclick="location.href='/suppliers'">Browse Suppliers</button>
          <button class="cta secondary" type="button" onclick="location.href='/dashboard-customer.html'">Go to Dashboard</button>
        </div>
      </div>
    `;
  }

  /**
   * Format date for display
   */
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
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
    // Welcome screen
    if (stepIndex === -1) {
      const getStartedBtn = document.querySelector('.wizard-get-started');
      if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
          hasShownWelcome = true;
          currentStep = 0;
          window.WizardState.saveStep(0, { wizardStartedAt: new Date().toISOString() });
          renderStep(currentStep);
          renderPlanSummary();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      return;
    }

    // Event type selection
    if (stepIndex === 0) {
      // Load event type images from Pexels
      loadEventTypeImages();

      const options = document.querySelectorAll('.wizard-option');
      const nextBtn = document.querySelector('.wizard-next');
      
      options.forEach(opt => {
        opt.addEventListener('click', function () {
          options.forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          const value = this.getAttribute('data-value');
          window.WizardState.saveStep(0, { eventType: value });
          if (nextBtn) nextBtn.disabled = false;
          renderPlanSummary();
        });
      });
    }

    // Event basics - setup validation
    if (stepIndex === 1) {
      if (window.WizardValidation) {
        const eventNameField = document.getElementById('wizard-event-name');
        const locationField = document.getElementById('wizard-location');
        const dateField = document.getElementById('wizard-date');
        const guestsField = document.getElementById('wizard-guests');

        if (eventNameField) window.WizardValidation.setupFieldValidation(eventNameField, 'eventName');
        if (locationField) window.WizardValidation.setupFieldValidation(locationField, 'location');
        if (dateField) window.WizardValidation.setupFieldValidation(dateField, 'date');
        if (guestsField) window.WizardValidation.setupFieldValidation(guestsField, 'guests');
      }
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

    // Review step - edit links
    if (stepIndex === 2 + CATEGORIES.length) {
      const editLinks = document.querySelectorAll('.wizard-review-edit');
      editLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetStep = parseInt(link.getAttribute('data-step'), 10);
          if (!isNaN(targetStep)) {
            currentStep = targetStep;
            renderStep(currentStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      });
    }

    // Success screen - no listeners needed (uses inline onclick)
    if (stepIndex === 2 + CATEGORIES.length + 1) {
      // Trigger confetti or celebration animation
      triggerCelebration();
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
   * Trigger celebration animation
   */
  function triggerCelebration() {
    // Simple confetti effect (can be enhanced)
    const colors = ['#0B8073', '#13B6A2', '#10b981', '#34d399'];
    
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'wizard-confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.3 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 4000);
      }, i * 50);
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
      const distanceInfo =
        pkg.distance !== undefined && pkg.distance !== null && typeof pkg.distance === 'number'
          ? `<p class="small" style="color: #0369a1; font-weight: 500;">📍 ${pkg.distance.toFixed(1)} miles away</p>`
          : '';

      html += `
        <div class="wizard-package-card ${isSelected ? 'selected' : ''}" 
             data-package-id="${pkg.id}" data-category="${categoryKey}">
          ${pkg.image ? `<img src="${pkg.image}" alt="${escapeHtml(pkg.title)}">` : ''}
          <h4>${escapeHtml(pkg.title)}</h4>
          ${distanceInfo}
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
      const eventName = document.getElementById('wizard-event-name')?.value || '';
      const location = document.getElementById('wizard-location')?.value || '';
      const date = document.getElementById('wizard-date')?.value || '';
      const guests = document.getElementById('wizard-guests')?.value || null;
      const budget = document.getElementById('wizard-budget')?.value || '';

      window.WizardState.saveStep(1, {
        eventName,
        location,
        date,
        guests: guests ? parseInt(guests, 10) : null,
        budget,
      });
    }

    // Move to next step
    const maxStep = 2 + CATEGORIES.length; // Review step
    currentStep = Math.min(currentStep + 1, maxStep);
    
    renderStep(currentStep);
    renderPlanSummary();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Check if wizard has any user-entered data
   */
  function hasFormData() {
    const state = window.WizardState.getState();
    return !!(
      state.eventType ||
      state.location ||
      state.date ||
      state.guests ||
      state.budget ||
      Object.keys(state.selectedPackages || {}).length > 0
    );
  }

  /**
   * Handle back button
   */
  function handleBack() {
    // Special handling for going back from first step
    if (currentStep === 0) {
      // Check if user has entered any data
      if (hasFormData()) {
        const confirmed = confirm('Leave wizard? Your progress will be saved for later.');
        if (!confirmed) {
          return;
        }
      }
      // Go back to welcome screen or homepage
      if (hasShownWelcome) {
        currentStep = -1;
        renderStep(currentStep);
      } else {
        window.location.href = '/';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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
    createBtn.innerHTML = '<span class="wizard-loading"></span> Creating...';

    try {
      // Check authentication using AuthState if available
      let user = null;
      let isLoggedIn = false;

      if (window.AuthState && typeof window.AuthState.getUser === 'function') {
        user = window.AuthState.getUser();
        isLoggedIn = !!user;
      }

      if (!isLoggedIn) {
        const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
        isLoggedIn = authResponse.ok;
        if (isLoggedIn) {
          const authData = await authResponse.json();
          user = authData.user || authData;
        }
      }

      const planData = window.WizardState.exportForPlanCreation();

      if (!isLoggedIn) {
        // Save to localStorage for restoration after auth
        try {
          localStorage.setItem('eventflow_wizard_pending', JSON.stringify(planData));
          localStorage.setItem('eventflow_wizard_timestamp', Date.now().toString());
        } catch (e) {
          console.error('Failed to save to localStorage:', e);
        }

        // Redirect to auth with return URL
        const returnUrl = encodeURIComponent('/start.html?restore=true');
        location.href = `/auth.html?returnTo=${returnUrl}`;
        return;
      }

      // User is authenticated - save to backend
      await savePlanToBackend(planData);

      // Mark wizard as completed
      window.WizardState.markCompleted();

      // Show success screen
      currentStep = 2 + CATEGORIES.length + 1;
      renderStep(currentStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Clear wizard state after showing success (delayed)
      setTimeout(() => {
        window.WizardState.clearState();
        try {
          localStorage.removeItem('eventflow_wizard_pending');
          localStorage.removeItem('eventflow_wizard_timestamp');
        } catch (e) {
          console.error('Failed to clear localStorage:', e);
        }
      }, 3000);
      
    } catch (err) {
      console.error('Error creating plan:', err);

      if (window.showNotification) {
        window.showNotification(err.message || 'Failed to create plan. Please try again.', 'error');
      } else {
        alert('There was an error creating your plan. Please try again.');
      }

      createBtn.disabled = false;
      createBtn.textContent = 'Create My Plan 🎉';
    }
  }

  /**
   * Save plan to backend
   * @param {Object} planData - Plan data to save
   */
  async function savePlanToBackend(planData) {
    const csrfToken = await getCsrfToken();

    const response = await fetch('/api/me/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(planData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to save plan');
    }

    return await response.json();
  }

  /**
   * Restore wizard state from localStorage after authentication
   */
  function restoreWizardState() {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldRestore = urlParams.get('restore') === 'true';

    if (!shouldRestore) {
      return;
    }

    try {
      const pendingData = localStorage.getItem('eventflow_wizard_pending');
      const timestamp = localStorage.getItem('eventflow_wizard_timestamp');

      if (!pendingData || !timestamp) {
        return;
      }

      const age = Date.now() - parseInt(timestamp, 10);

      if (age > WIZARD_DATA_EXPIRY_MS) {
        localStorage.removeItem('eventflow_wizard_pending');
        localStorage.removeItem('eventflow_wizard_timestamp');
        return;
      }

      const planData = JSON.parse(pendingData);

      if (window.AuthState && window.AuthState.getUser && window.AuthState.getUser()) {
        savePlanToBackend(planData)
          .then(() => {
            localStorage.removeItem('eventflow_wizard_pending');
            localStorage.removeItem('eventflow_wizard_timestamp');

            if (window.showNotification) {
              window.showNotification('Your event plan has been saved!', 'success');
            }

            setTimeout(() => {
              location.href = '/dashboard-customer.html';
            }, 1500);
          })
          .catch(err => {
            console.error('Failed to save restored plan:', err);
          });
      }
    } catch (e) {
      console.error('Failed to restore wizard state:', e);
      localStorage.removeItem('eventflow_wizard_pending');
      localStorage.removeItem('eventflow_wizard_timestamp');
    }
  }

  /**
   * Get CSRF token from meta tag, cookie, or API
   */
  async function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
      return meta.getAttribute('content');
    }
    // Try cookie
    const match = document.cookie.match(/csrfToken=([^;]+)/);
    if (match) {
      return match[1];
    }

    // Fetch from API as last resort
    try {
      const response = await fetch('/api/csrf-token', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        return data.csrfToken || '';
      }
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
    }

    return '';
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
