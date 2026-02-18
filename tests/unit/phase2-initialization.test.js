/**
 * Phase 2 Initialization Tests - PR #563
 * Tests for proper initialization of folders, labels, advanced search, and grouping features
 */

const fs = require('fs');

describe('Phase 2 Initialization', () => {
  let swContent;
  let messagesContent;

  // Read files once before all tests for better performance
  beforeAll(() => {
    swContent = fs.readFileSync('./public/sw.js', 'utf8');
    messagesContent = fs.readFileSync('./public/messages.html', 'utf8');
  });

  describe('ServiceWorker Cache Error Handling', () => {
    test('should have catch handlers on cache operations', () => {
      // Check for .catch() handlers after cache.put()
      expect(swContent).toContain('cache.put(request, responseClone).catch(err =>');
      expect(swContent).toContain('[SW] Cache write failed');

      // Check for .catch() handlers after caches.open()
      expect(swContent).toContain('.catch(err => {');
      expect(swContent).toContain('[SW] Cache open failed');
    });

    test('should log warnings instead of throwing errors', () => {
      // Should use console.warn for cache failures
      expect(swContent).toContain("console.warn('[SW] Cache write failed:'");
      expect(swContent).toContain("console.warn('[SW] Cache open failed:'");
    });
  });

  describe('Browser Extension Conflict Handling', () => {
    test('should have error handler for extension conflicts', () => {
      // Check for extension error detection
      expect(messagesContent).toContain('Extension context invalidated');
      expect(messagesContent).toContain('runtime.lastError');
      expect(messagesContent).toContain('Browser extension interference detected');
    });

    test('should suppress extension errors', () => {
      expect(messagesContent).toContain('event.preventDefault()');
      expect(messagesContent).toContain("console.warn('Browser extension interference");
    });
  });

  describe('CDN Fallback Detection', () => {
    test('should detect JadeAssist loading failure', () => {
      expect(messagesContent).toContain("typeof window.JadeAssist === 'undefined'");
      expect(messagesContent).toContain('JadeAssist failed to load');
      expect(messagesContent).toContain('tracking prevention likely active');
    });

    test('should hide JadeAssist UI elements on failure', () => {
      expect(messagesContent).toContain('[data-requires="jadeassist"]');
      expect(messagesContent).toContain("el.style.display = 'none'");
    });

    test('should use named constant for timeout', () => {
      expect(messagesContent).toContain('JADEASSIST_LOAD_TIMEOUT');
      expect(messagesContent).toContain('JADEASSIST_LOAD_TIMEOUT = 3000');
    });
  });

  describe('Phase 2 Feature Initialization', () => {
    test('should initialize folders feature', () => {
      expect(messagesContent).toContain('window.EF_Folders');
      expect(messagesContent).toContain('EF_Folders.init()');
    });

    test('should initialize labels feature', () => {
      expect(messagesContent).toContain('window.EF_Labels');
      expect(messagesContent).toContain('EF_Labels.init()');
    });

    test('should initialize advanced search feature', () => {
      expect(messagesContent).toContain('window.EF_Search');
      expect(messagesContent).toContain('EF_Search.init()');
      expect(messagesContent).toContain('EF_Search.executeSearch');
    });

    test('should initialize grouping feature', () => {
      expect(messagesContent).toContain('window.EF_Grouping');
      expect(messagesContent).toContain('EF_Grouping.init()');
    });

    test('should wire advanced search button', () => {
      expect(messagesContent).toContain('advanced-search-btn');
      expect(messagesContent).toContain("addEventListener('click'");
    });

    test('should wire Enter key for search', () => {
      expect(messagesContent).toContain('keypress');
      expect(messagesContent).toContain("e.key === 'Enter'");
    });

    test('should have error handling for initialization', () => {
      expect(messagesContent).toContain('try {');
      expect(messagesContent).toContain('catch (error)');
      expect(messagesContent).toContain('initialization failed');
    });

    test('should warn if features not loaded', () => {
      expect(messagesContent).toContain('not loaded - feature unavailable');
    });

    test('should use load event instead of timeout', () => {
      // Should use 'load' event which fires after defer scripts
      expect(messagesContent).toContain("window.addEventListener('load'");
      // Should NOT use DOMContentLoaded with setTimeout for Phase 2 init
      const phase2InitSection = messagesContent.substring(
        messagesContent.indexOf('Phase 2 Initialization'),
        messagesContent.indexOf('JadeAssist Chat Widget')
      );
      expect(phase2InitSection).not.toContain('setTimeout');
    });
  });

  describe('Script Loading', () => {
    test('should load Phase 2 scripts with defer', () => {
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
      expect(messagesContent).toContain(
        'onerror="console.warn(\'JadeAssist widget could not be loaded'
      );
    });
  });
});
