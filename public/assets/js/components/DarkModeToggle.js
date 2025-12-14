/**
 * Dark Mode Toggle Component
 * Manages theme switching with localStorage persistence and system preference detection
 */

class DarkModeToggle {
  constructor() {
    this.init();
  }

  init() {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else if (systemPrefersDark) {
      this.setTheme('dark');
    } else {
      this.setTheme('light');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Create toggle button
    this.createToggleButton();
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update button icon if it exists
    const button = document.querySelector('.dark-mode-toggle');
    if (button) {
      this.updateButtonIcon(button, theme);
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  createToggleButton() {
    // Check if button already exists
    if (document.querySelector('.dark-mode-toggle')) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'dark-mode-toggle';
    button.setAttribute('aria-label', 'Toggle dark mode');
    button.setAttribute('title', 'Toggle dark mode');
    
    // Create icons
    const sunIcon = document.createElement('span');
    sunIcon.className = 'icon-sun';
    sunIcon.innerHTML = '☀️';
    
    const moonIcon = document.createElement('span');
    moonIcon.className = 'icon-moon';
    moonIcon.innerHTML = '🌙';
    
    button.appendChild(sunIcon);
    button.appendChild(moonIcon);
    
    // Add click handler
    button.addEventListener('click', () => this.toggleTheme());
    
    // Append to body
    document.body.appendChild(button);
    
    // Update icon based on current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.updateButtonIcon(button, currentTheme);
  }

  updateButtonIcon(button, theme) {
    const sunIcon = button.querySelector('.icon-sun');
    const moonIcon = button.querySelector('.icon-moon');
    
    if (theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }
}

// Initialize dark mode toggle when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.darkModeToggle = new DarkModeToggle();
    });
  } else {
    window.darkModeToggle = new DarkModeToggle();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DarkModeToggle;
}
