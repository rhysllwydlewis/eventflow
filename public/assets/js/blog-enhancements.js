/**
 * Blog Article Enhancements
 * Applies P3 features to blog articles
 */

(function () {
  'use strict';

  /**
   * Add reading time estimate to article
   */
  function addReadingTime() {
    // Find article content
    const article = document.querySelector('article, .article-content, main');
    if (!article) {
      return;
    }

    // Calculate reading time
    const content = article.textContent || '';

    if (typeof calculateReadingTime === 'function') {
      const minutes = calculateReadingTime(content);

      // Create or update reading time display
      let container = document.getElementById('reading-time');
      if (!container) {
        container = document.createElement('div');
        container.id = 'reading-time';
        container.className = 'reading-time';

        // Insert at the beginning of article or after title
        const title = article.querySelector('h1');
        if (title) {
          title.insertAdjacentElement('afterend', container);
        } else {
          article.insertBefore(container, article.firstChild);
        }
      }

      container.textContent = `${minutes} min read`;
      container.setAttribute('aria-label', `Estimated reading time: ${minutes} minutes`);
    }
  }

  /**
   * Add breadcrumbs to article
   */
  function addArticleBreadcrumbs() {
    // Get article title
    const title = document.querySelector('h1')?.textContent || 'Article';

    const breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: 'Guides', url: '/blog' },
      { label: title, url: window.location.pathname },
    ];

    if (typeof renderBreadcrumbs === 'function') {
      // Create container if it doesn't exist
      let container = document.getElementById('breadcrumb-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'breadcrumb-container';

        const main = document.querySelector('main, article, .container');
        if (main) {
          main.insertBefore(container, main.firstChild);
        }
      }

      renderBreadcrumbs(breadcrumbs);
    }
  }

  /**
   * Add print button to article
   */
  function addPrintButton() {
    const article = document.querySelector('article, .article-content, main');
    if (!article) {
      return;
    }

    // Check if print button already exists
    if (document.getElementById('print-article-btn')) {
      return;
    }

    const printBtn = document.createElement('button');
    printBtn.id = 'print-article-btn';
    printBtn.className = 'print-button';
    printBtn.textContent = 'Print Article';
    printBtn.setAttribute('aria-label', 'Print this article');
    printBtn.style.marginTop = '2rem';

    printBtn.addEventListener('click', () => {
      window.print();
    });

    // Add at the end of article
    article.appendChild(printBtn);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addReadingTime();
      addArticleBreadcrumbs();
      addPrintButton();
    });
  } else {
    addReadingTime();
    addArticleBreadcrumbs();
    addPrintButton();
  }
})();
