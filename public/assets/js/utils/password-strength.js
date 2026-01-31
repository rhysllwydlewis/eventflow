/**
 * Password Strength Meter Utility
 * Provides real-time password strength checking with visual feedback
 */

/**
 * Calculate password strength score
 * @param {string} password - Password to check
 * @returns {Object} - { score: number, label: string, color: string, requirements: Object }
 */
function checkPasswordStrength(password) {
  let score = 0;
  const requirements = {
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  };

  if (!password) {
    return {
      score: 0,
      label: 'No password',
      color: '#e0e0e0',
      requirements,
    };
  }

  // Check length (20 points for >=8, 20 more for >=12)
  if (password.length >= 8) {
    score += 20;
    requirements.minLength = true;
  }
  if (password.length >= 12) {
    score += 20;
  }

  // Check for lowercase letters (20 points)
  if (/[a-z]/.test(password)) {
    score += 20;
    requirements.hasLowercase = true;
  }

  // Check for uppercase letters (20 points)
  if (/[A-Z]/.test(password)) {
    score += 20;
    requirements.hasUppercase = true;
  }

  // Check for numbers (10 points)
  if (/[0-9]/.test(password)) {
    score += 10;
    requirements.hasNumber = true;
  }

  // Check for special characters (10 points)
  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 10;
    requirements.hasSpecial = true;
  }

  // Determine label and color based on score
  let label, color;
  if (score < 40) {
    label = 'Weak';
    color = '#ef4444'; // Red
  } else if (score < 70) {
    label = 'Medium';
    color = '#f59e0b'; // Orange/Yellow
  } else {
    label = 'Strong';
    color = '#10b981'; // Green
  }

  return {
    score,
    label,
    color,
    requirements,
  };
}

/**
 * Initialize password strength meter on a password input
 * @param {string} passwordInputId - ID of password input element
 * @param {Object} options - Configuration options
 * @param {string} options.containerId - ID of container to show strength meter
 * @param {string} options.barId - ID of strength bar element
 * @param {string} options.labelId - ID of label element
 * @param {string} options.messageId - ID of message element
 * @param {string} options.requirementsId - ID of requirements list element
 * @param {boolean} options.showRequirements - Whether to show requirements checklist
 * @param {Function} options.onStrengthChange - Callback when strength changes
 */
function initPasswordStrengthMeter(passwordInputId, options = {}) {
  const passwordInput = document.getElementById(passwordInputId);
  if (!passwordInput) {
    console.warn(`Password input ${passwordInputId} not found`);
    return;
  }

  const container = options.containerId ? document.getElementById(options.containerId) : null;
  const bar = options.barId ? document.getElementById(options.barId) : null;
  const label = options.labelId ? document.getElementById(options.labelId) : null;
  const message = options.messageId ? document.getElementById(options.messageId) : null;
  const requirementsList = options.requirementsId
    ? document.getElementById(options.requirementsId)
    : null;

  // Show container and requirements on focus
  passwordInput.addEventListener('focus', () => {
    if (container) {
      container.style.display = 'block';
    }
    if (requirementsList && options.showRequirements !== false) {
      requirementsList.style.display = 'block';
    }
  });

  // Update strength on input
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const strength = checkPasswordStrength(password);

    // Update bar
    if (bar) {
      bar.style.width = `${strength.score}%`;
      bar.style.background = strength.color;
    }

    // Update label
    if (label) {
      label.textContent = strength.label;
      label.style.color = strength.color;
    }

    // Update message
    if (message) {
      if (strength.score < 40 && password.length > 0) {
        message.textContent = 'Password is too weak. Add more characters, numbers, or symbols.';
        message.style.color = strength.color;
        message.style.display = 'block';
      } else if (strength.score >= 40 && strength.score < 70) {
        message.textContent = 'Password strength is acceptable.';
        message.style.color = strength.color;
        message.style.display = 'block';
      } else if (strength.score >= 70) {
        message.textContent = 'Strong password!';
        message.style.color = strength.color;
        message.style.display = 'block';
      } else {
        message.style.display = 'none';
      }
    }

    // Update requirements checklist
    if (requirementsList && options.showRequirements !== false) {
      updateRequirementsList(requirementsList, strength.requirements);
    }

    // Call callback if provided
    if (options.onStrengthChange) {
      options.onStrengthChange(strength);
    }
  });
}

/**
 * Update requirements checklist with checkmarks
 * @param {HTMLElement} requirementsList - UL element containing requirements
 * @param {Object} requirements - Requirements object from checkPasswordStrength
 */
function updateRequirementsList(requirementsList, requirements) {
  const items = requirementsList.querySelectorAll('li');

  items.forEach(item => {
    const requirement = item.dataset.requirement;
    if (requirement && requirements[requirement] !== undefined) {
      if (requirements[requirement]) {
        item.style.color = '#10b981';
        item.innerHTML = item.innerHTML.replace(/^[✗✓]/, '✓');
      } else {
        item.style.color = '#666';
        item.innerHTML = item.innerHTML.replace(/^[✗✓]/, '✗');
      }
    }
  });
}

/**
 * Validate password meets minimum requirements
 * @param {string} password - Password to validate
 * @param {number} minScore - Minimum score required (default: 40)
 * @returns {boolean} - Whether password meets requirements
 */
function validatePasswordStrength(password, minScore = 40) {
  const strength = checkPasswordStrength(password);
  return strength.score >= minScore;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkPasswordStrength,
    initPasswordStrengthMeter,
    updateRequirementsList,
    validatePasswordStrength,
  };
} else {
  // Browser global
  window.PasswordStrength = {
    checkPasswordStrength,
    initPasswordStrengthMeter,
    updateRequirementsList,
    validatePasswordStrength,
  };
}
