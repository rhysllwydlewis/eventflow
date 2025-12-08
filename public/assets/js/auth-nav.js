(async function () {
  // --- Theme (light / dark) ---
  const root = document.documentElement;
  const THEME_KEY = 'ef-theme';

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    // Initialise from saved preference or system preference
try {
  const stored = window.localStorage ? localStorage.getItem(THEME_KEY) : null;
  if (stored === 'light' || stored === 'dark') {
    // If the user has chosen a theme before, respect that
    applyTheme(stored);
  } else {
    // Default for everyone: light mode
    applyTheme('light');
  }
} catch (_) {
  // Ignore storage errors
}


    const syncAria = () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    syncAria();

    btn.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      try {
        if (window.localStorage) localStorage.setItem(THEME_KEY, next);
      } catch (_) {}
      syncAria();
    });
  }

  // --- Nav (burger + scroll behaviour) ---
  function initNavToggle() {
    const burger = document.getElementById('burger');
    const navMenu = document.querySelector('.nav.nav-menu');
    if (!burger || !navMenu) return;

    const body = document.body;

    const closeNav = () => {
      body.classList.remove('nav-open');
      burger.setAttribute('aria-expanded', 'false');
    };

    const openNav = () => {
      body.classList.add('nav-open');
      burger.setAttribute('aria-expanded', 'true');
    };

    burger.addEventListener('click', () => {
      const isOpen = body.classList.contains('nav-open');
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    // Close nav when a menu link is clicked (on mobile)
    navMenu.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.tagName === 'A') {
        closeNav();
      }
    });

    // Close nav if the viewport is resized up to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) {
        closeNav();
      }
    });
  }

  // --- Header scroll hide / show ---
  function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;

    let lastY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const goingDown = currentY > lastY && currentY > 80;
          header.classList.toggle('header--hidden', goingDown);
          lastY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // --- Auth-aware nav (existing behaviour, slightly tidied) ---
  async function me() {
    try {
      const r = await fetch('/api/auth/me');
      const data = await r.json();
      return data.user || null;
    } catch (_) {
      return null;
    }
  }

  function initAuthNav(user) {
    const auth = document.getElementById('nav-auth');
    const dash = document.getElementById('nav-dashboard');
    const signout = document.getElementById('nav-signout');

    const inlineNav = document.querySelector('.nav.nav-inline');
    const inlineLogin = inlineNav ? inlineNav.querySelector('.nav-main-login') : null;

    if (user) {
      // Mobile nav
      if (auth) auth.style.display = 'none';
      const dashHref = user.role === 'admin'
        ? '/admin.html'
        : (user.role === 'supplier' ? '/dashboard-supplier.html' : '/dashboard-customer.html');

      if (dash) {
        dash.style.display = '';
        dash.href = dashHref;
      }
      if (signout) {
        signout.style.display = '';
        signout.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } catch (_) {}
          location.href = '/';
        });
      }

      // Inline nav (top-right on desktop)
      let dashInline = inlineNav ? inlineNav.querySelector('.nav-main-dashboard') : null;
      if (inlineNav) {
        if (!dashInline) {
          dashInline = document.createElement('a');
          dashInline.className = 'nav-link nav-main nav-main-dashboard';
          dashInline.textContent = 'Dashboard';
          // Insert before login link if present, otherwise append
          if (inlineLogin && inlineLogin.parentNode === inlineNav) {
            inlineNav.insertBefore(dashInline, inlineLogin);
          } else {
            inlineNav.appendChild(dashInline);
          }
        }
        dashInline.href = dashHref;
      }

      if (inlineLogin) {
        inlineLogin.textContent = 'Log out';
        inlineLogin.href = '#';
        inlineLogin.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } catch (_) {}
          location.href = '/';
        });
      }
    } else {
      // Not signed in
      if (auth) auth.style.display = '';
      if (dash) dash.style.display = 'none';
      if (signout) signout.style.display = 'none';

      if (inlineLogin) {
        inlineLogin.textContent = 'Log in';
        inlineLogin.href = '/auth.html';
      }
      if (inlineNav) {
        const dashInline = inlineNav.querySelector('.nav-main-dashboard');
        if (dashInline) dashInline.remove();
      }
    }
  }

  // Initialise UI pieces that don't depend on auth
  initThemeToggle();
  initNavToggle();
  initHeaderScroll();

  // Then check auth and wire up auth-aware nav
  const user = await me();
  initAuthNav(user);
})();
