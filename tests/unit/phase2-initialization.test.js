/**
 * Phase 2 Initialization Tests - PR #563
 * Tests for proper initialization of folders, labels, advanced search, and grouping features
 */

describe('Phase 2 Initialization', () => {
  describe('ServiceWorker Cache Error Handling', () => {
    test('should have catch handlers on cache operations', () => {
      const fs = require('fs');
      const swContent = fs.readFileSync('./public/sw.js', 'utf8');

      // Check for .catch() handlers after cache.put()
      expect(swContent).toContain('cache.put(request, responseClone).catch(err =>');
      expect(swContent).toContain('[SW] Cache write failed');

      // Check for .catch() handlers after caches.open()
      expect(swContent).toContain('.catch(err => {');
      expect(swContent).toContain('[SW] Cache open failed');
    });

    test('should log warnings instead of throwing errors', () => {
      const fs = require('fs');
      const swContent = fs.readFileSync('./public/sw.js', 'utf8');

      // Should use console.warn for cache failures
      expect(swContent).toContain("console.warn('[SW] Cache write failed:'");
      expect(swContent).toContain("console.warn('[SW] Cache open failed:'");
    });
  });

  describe('Browser Extension Conflict Handling', () => {
    test('should have error handler for extension conflicts', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      // Check for extension error detection
      expect(messagesContent).toContain('Extension context invalidated');
      expect(messagesContent).toContain('runtime.lastError');
      expect(messagesContent).toContain('Browser extension interference detected');
    });

    test('should suppress extension errors', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('event.preventDefault()');
      expect(messagesContent).toContain("console.warn('Browser extension interference");
    });
  });

  describe('CDN Fallback Detection', () => {
    test('should detect JadeAssist loading failure', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain("typeof window.JadeAssist === 'undefined'");
      expect(messagesContent).toContain('JadeAssist failed to load');
      expect(messagesContent).toContain('tracking prevention likely active');
    });

    test('should hide JadeAssist UI elements on failure', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('[data-requires="jadeassist"]');
      expect(messagesContent).toContain("el.style.display = 'none'");
    });
  });

  describe('Phase 2 Feature Initialization', () => {
    test('should initialize folders feature', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('window.EF_Folders');
      expect(messagesContent).toContain('EF_Folders.init()');
    });

    test('should initialize labels feature', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('window.EF_Labels');
      expect(messagesContent).toContain('EF_Labels.init()');
    });

    test('should initialize advanced search feature', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('window.EF_Search');
      expect(messagesContent).toContain('EF_Search.init()');
      expect(messagesContent).toContain('EF_Search.executeSearch');
    });

    test('should initialize grouping feature', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('window.EF_Grouping');
      expect(messagesContent).toContain('EF_Grouping.init()');
    });

    test('should wire advanced search button', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('advanced-search-btn');
      expect(messagesContent).toContain("addEventListener('click'");
    });

    test('should wire Enter key for search', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('keypress');
      expect(messagesContent).toContain("e.key === 'Enter'");
    });

    test('should have error handling for initialization', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('try {');
      expect(messagesContent).toContain('catch (error)');
      expect(messagesContent).toContain('initialization failed');
    });

    test('should warn if features not loaded', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain('not loaded - feature unavailable');
    });
  });

  describe('Script Loading', () => {
    test('should load Phase 2 scripts with defer', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain(
        '<script src="/assets/js/folders.js?v=18.0.0" defer></script>'
      );
      expect(messagesContent).toContain(
        '<script src="/assets/js/labels.js?v=18.0.0" defer></script>'
      );
      expect(messagesContent).toContain(
        '<script src="/assets/js/advanced-search.js?v=18.0.0" defer></script>'
      );
      expect(messagesContent).toContain(
        '<script src="/assets/js/grouping.js?v=18.0.0" defer></script>'
      );
    });

    test('should have JadeAssist error handler', () => {
      const fs = require('fs');
      const messagesContent = fs.readFileSync('./public/messages.html', 'utf8');

      expect(messagesContent).toContain(
        'onerror="console.warn(\'JadeAssist widget could not be loaded'
      );
    });
  });
});
