(async function(){
  async function me(){
    try{
      const r = await fetch('/api/auth/me');
      const data = await r.json();
      return data.user || null;
    }catch(_){
      return null;
    }
  }

  const user = await me();

  const auth = document.getElementById('nav-auth');
  const dash = document.getElementById('nav-dashboard');
  const signout = document.getElementById('nav-signout');

  const burger = document.getElementById('burger');
  const navMenu = document.querySelector('.nav.nav-menu');
  const inlineNav = document.querySelector('.nav.nav-inline');
  const inlineLogin = inlineNav ? inlineNav.querySelector('.nav-main-login') : null;

  // Burger toggle for small screens
  if (burger && navMenu) {
    burger.addEventListener('click', () => {
      const isHidden = navMenu.style.display === 'none' || !navMenu.style.display;
      navMenu.style.display = isHidden ? 'flex' : 'none';
      burger.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });
  }

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
        try{
          await fetch('/api/auth/logout', { method: 'POST' });
        }catch(_){}
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
        try{
          await fetch('/api/auth/logout', { method: 'POST' });
        }catch(_){}
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
})();
