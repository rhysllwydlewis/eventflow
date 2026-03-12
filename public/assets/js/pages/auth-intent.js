/**
 * Auth Intent Notice
 * Reads `intent` and `redirect` query params on the auth page and displays
 * a contextual notice explaining why the user was redirected to sign in.
 */
(function () {
  const MESSAGES = {
    save: {
      title: 'Log in to save suppliers',
      body: "Create an account or log in to save suppliers to your shortlist. After you sign in, we'll take you back to where you were.",
    },
    message: {
      title: 'Log in to message suppliers',
      body: "Create an account or log in to message this supplier. After you sign in, we'll take you back to where you were.",
    },
    plan: {
      title: 'Log in to add packages to your plan',
      body: "Create an account or log in to add packages to your event plan. After you sign in, we'll take you back to where you were.",
    },
  };

  function init() {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('intent');
    const redirect = params.get('redirect');

    // Only show when both intent and redirect are present and redirect is relative
    if (!intent || !redirect || !redirect.startsWith('/')) {
      return;
    }

    const msg = MESSAGES[intent];
    if (!msg) {
      return;
    }

    const notice = document.getElementById('auth-intent-notice');
    if (!notice) {
      return;
    }

    notice.innerHTML = `<strong class="auth-intent-title">${escapeHtml(msg.title)}</strong><p class="auth-intent-body">${escapeHtml(msg.body)}</p>`;
    notice.classList.add('is-visible', 'is-info');
    notice.style.display = '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
