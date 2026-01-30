/**
 * EventFlow Unified Search Bar
 * Handles form submission and quick tag clicks
 */

class EFSearchBar {
  constructor() {
    this.form = document.querySelector('.ef-search-bar__form');
    this.input = document.querySelector('.ef-search-bar__input');
    this.select = document.querySelector('.ef-search-bar__select');
    this.quickTags = document.querySelectorAll('.ef-quick-tags__tag');

    if (this.form) {
      this.init();
    }
  }

  init() {
    // Form submission
    this.form.addEventListener('submit', e => this.handleSubmit(e));

    // Quick tag clicks
    this.quickTags.forEach(tag => {
      tag.addEventListener('click', e => this.handleTagClick(e));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => this.handleKeydown(e));
  }

  handleSubmit(e) {
    const query = this.input.value.trim();
    const category = this.select ? this.select.value : '';

    // Allow submission with either query or category
    // If neither is provided, prevent empty search
    if (!query && !category) {
      e.preventDefault();
      this.input.focus();
      return;
    }

    // Track search event (don't block submission if it fails)
    this.trackSearch(query, category).catch(err => {
      console.debug('Analytics tracking failed:', err);
    });

    // Form will submit naturally with query and/or category parameters
  }

  async trackSearch(query, category) {
    try {
      // Get CSRF token from cookie
      const token = this.getCsrfToken();

      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'X-CSRF-Token': token }),
        },
        body: JSON.stringify({
          event: 'search_performed',
          properties: {
            query: query || '',
            category: category || '',
            source: 'homepage',
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      // Fail silently - analytics should never block UX
      console.debug('Analytics tracking error:', error);
    }
  }

  getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf') {
        return value;
      }
    }
    return null;
  }

  handleTagClick(e) {
    const tag = e.currentTarget;
    const searchTerm = tag.dataset.search;

    if (searchTerm) {
      this.input.value = searchTerm;
      this.form.submit();
    }
  }

  handleKeydown(e) {
    // Cmd/Ctrl + K to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.input.focus();
      this.input.select();
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new EFSearchBar();
});
