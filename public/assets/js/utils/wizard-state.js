/**
 * Wizard State Manager
 * Manages the multi-step planning wizard state with localStorage persistence
 * Key: eventflow_plan_builder_v1
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'eventflow_plan_builder_v1';
  const LEGACY_KEY = 'eventflow_start';

  /**
   * Default state structure
   */
  const DEFAULT_STATE = {
    currentStep: 0,
    completed: false,
    eventType: '', // 'Wedding' or 'Other'
    eventName: '',
    location: '',
    date: '',
    guests: null,
    budget: '',
    styles: [],
    notes: '',
    selectedPackages: {}, // { categoryKey: packageId }
    wizardStartedAt: null,
    lastUpdated: null,
  };

  /**
   * Get the current wizard state from localStorage
   * @returns {Object} Current wizard state
   */
  function getState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_STATE, ...JSON.parse(stored) };
      }

      // Check for legacy eventflow_start data and migrate if exists
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const legacyData = JSON.parse(legacy);
        const migrated = {
          ...DEFAULT_STATE,
          eventType: legacyData.type || '',
          eventName: legacyData.name || '',
          location: legacyData.location || '',
          date: legacyData.date || '',
          guests: legacyData.guests || null,
          budget: legacyData.budget || '',
          styles: legacyData.styles || [],
          notes: legacyData.notes || '',
          currentStep: 1, // Start at step 1 since they have some data
          wizardStartedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        saveState(migrated);
        return migrated;
      }

      return { ...DEFAULT_STATE };
    } catch (err) {
      console.error('Error loading wizard state:', err);
      return { ...DEFAULT_STATE };
    }
  }

  /**
   * Save the wizard state to localStorage
   * @param {Object} state - State to save
   */
  function saveState(state) {
    try {
      const updated = {
        ...state,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (err) {
      console.error('Error saving wizard state:', err);
      return false;
    }
  }

  /**
   * Save a specific step's data
   * @param {number} stepIndex - Step index
   * @param {Object} data - Data for this step
   */
  function saveStep(stepIndex, data) {
    const state = getState();
    const updated = {
      ...state,
      ...data,
      currentStep: stepIndex,
      wizardStartedAt: state.wizardStartedAt || new Date().toISOString(),
    };
    return saveState(updated);
  }

  /**
   * Add or update a package selection for a category
   * @param {string} categoryKey - Category key/slug
   * @param {string} packageId - Package ID
   */
  function selectPackage(categoryKey, packageId) {
    const state = getState();
    state.selectedPackages[categoryKey] = packageId;
    return saveState(state);
  }

  /**
   * Remove a package selection for a category
   * @param {string} categoryKey - Category key/slug
   */
  function deselectPackage(categoryKey) {
    const state = getState();
    delete state.selectedPackages[categoryKey];
    return saveState(state);
  }

  /**
   * Get selected packages
   * @returns {Object} Selected packages by category
   */
  function getSelectedPackages() {
    const state = getState();
    return state.selectedPackages || {};
  }

  /**
   * Clear the wizard state
   */
  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (err) {
      console.error('Error clearing wizard state:', err);
      return false;
    }
  }

  /**
   * Mark wizard as completed
   */
  function markCompleted() {
    const state = getState();
    state.completed = true;
    return saveState(state);
  }

  /**
   * Validate step data
   * @param {number} stepIndex - Step to validate
   * @param {Object} data - Data to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  function validateStep(stepIndex, data) {
    const errors = [];

    switch (stepIndex) {
      case 0: // Event type
        if (!data.eventType || (data.eventType !== 'Wedding' && data.eventType !== 'Other')) {
          errors.push('Please select an event type');
        }
        break;

      case 1: // Location (skippable but validate if provided)
        // Location is optional, no validation needed
        break;

      default:
        // Category steps (2+) are all skippable
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get the next step index
   * @param {number} currentStep - Current step index
   * @param {Array} categories - Array of categories for wizard steps
   * @returns {number} Next step index
   */
  function getNextStep(currentStep, categories) {
    const totalSteps = 2 + (categories ? categories.length : 0) + 1; // event type + location + categories + review
    return Math.min(currentStep + 1, totalSteps - 1);
  }

  /**
   * Get the previous step index
   * @param {number} currentStep - Current step index
   * @returns {number} Previous step index
   */
  function getPreviousStep(currentStep) {
    return Math.max(currentStep - 1, 0);
  }

  /**
   * Check if state is ready for plan creation
   * @returns {Object} { ready: boolean, missing: string[] }
   */
  function isReadyForPlanCreation() {
    const state = getState();
    const missing = [];

    if (!state.eventType) {
      missing.push('Event type');
    }

    // Other fields are optional

    return {
      ready: missing.length === 0,
      missing,
    };
  }

  /**
   * Export state for plan creation API
   * @returns {Object} Plan data ready for API
   */
  function exportForPlanCreation() {
    const state = getState();
    return {
      eventType: state.eventType,
      eventName: state.eventName,
      location: state.location,
      date: state.date,
      guests: state.guests,
      budget: state.budget,
      styles: state.styles,
      notes: state.notes,
      packages: Object.values(state.selectedPackages || {}),
    };
  }

  // Expose public API
  window.WizardState = {
    getState,
    saveState,
    saveStep,
    selectPackage,
    deselectPackage,
    getSelectedPackages,
    clearState,
    markCompleted,
    validateStep,
    getNextStep,
    getPreviousStep,
    isReadyForPlanCreation,
    exportForPlanCreation,
  };
})(window);
