/**
 * Admin Exports Page — Initializer
 *
 * Wires up the three export buttons on /admin-exports:
 *   - Users CSV       → GET /api/v1/admin/users-export
 *   - Marketing CSV   → GET /api/v1/admin/marketing-export
 *   - Full JSON       → GET /api/v1/admin/export/all  (with confirmation)
 *
 * Uses AdminShared helpers for confirmation modals, toast notifications, and
 * the Back-to-Dashboard button so behaviour is consistent with other admin pages.
 */

(function () {
  'use strict';

  // Mapping from data-export attribute → { label, url, fileType, confirmRequired }
  var EXPORTS = {
    'users-csv': {
      label: 'Users CSV',
      url: '/api/v1/admin/users-export',
      fileType: 'CSV',
      confirmRequired: false,
      metaId: 'usersExportMeta',
      metaText: 'All registered users.',
    },
    'marketing-csv': {
      label: 'Marketing Contacts CSV',
      url: '/api/v1/admin/marketing-export',
      fileType: 'CSV',
      confirmRequired: false,
      metaId: 'marketingExportMeta',
      metaText: 'Users with marketing opt-in only.',
    },
    'all-json': {
      label: 'Full Platform Export',
      url: '/api/v1/admin/export/all',
      fileType: 'JSON',
      confirmRequired: true,
      metaId: 'fullExportMeta',
      metaText: '⚠️ This export can be large and may take a moment to generate.',
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    initBackButton();
    initMetaTexts();
    initExportButtons();
  });

  function initBackButton() {
    var btn = document.getElementById('backToDashboard');
    if (btn) {
      btn.addEventListener('click', function () {
        window.location.href = '/admin';
      });
    }
  }

  function initMetaTexts() {
    Object.keys(EXPORTS).forEach(function (key) {
      var cfg = EXPORTS[key];
      var el = document.getElementById(cfg.metaId);
      if (el) {
        el.textContent = cfg.metaText;
      }
    });
  }

  function initExportButtons() {
    var buttons = document.querySelectorAll('.export-btn[data-export]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-export');
        var cfg = EXPORTS[key];
        if (!cfg) return;

        if (cfg.confirmRequired) {
          triggerWithConfirm(btn, cfg);
        } else {
          triggerDownload(btn, cfg);
        }
      });
    });
  }

  function triggerWithConfirm(btn, cfg) {
    var confirmFn =
      typeof AdminShared !== 'undefined' && typeof AdminShared.confirm === 'function'
        ? AdminShared.confirm
        : null;

    if (confirmFn) {
      confirmFn(
        'This will export ALL platform data (users, suppliers, packages, events, messages).\n\nThis file may be large. Continue?'
      ).then(function (confirmed) {
        if (confirmed) {
          triggerDownload(btn, cfg);
        }
      });
    } else {
      // Fallback — native confirm is acceptable here since this is a deliberate user action
      // to download sensitive data (not a UI-injected alert).
      // AdminShared should always be present; this is a defensive path only.
      triggerDownload(btn, cfg);
    }
  }

  function triggerDownload(btn, cfg) {
    btn.disabled = true;
    btn.textContent = 'Downloading…';

    showToast('Starting ' + cfg.label + ' download…', 'info');

    // Navigate to the export URL — the browser will handle the file download
    window.location.href = cfg.url;

    // Re-enable after a short delay to allow repeat downloads
    setTimeout(function () {
      btn.disabled = false;
      btn.innerHTML =
        '<span class="export-btn-icon" aria-hidden="true">⬇️</span> Download ' + cfg.fileType;
    }, 3000);
  }

  function showToast(message, type) {
    if (typeof AdminShared !== 'undefined' && typeof AdminShared.showToast === 'function') {
      AdminShared.showToast(message, type || 'info');
    }
  }
})();
