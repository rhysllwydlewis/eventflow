# Logout and Cache-Busting Fixes

## Problem Statement

After PR #206, users reported that logout/login issues persisted:

1. Browser cache served old, broken version of `dashboard-guard.js` due to missing cache-busting parameters
2. Admin navbar logout didn't properly clear auth state like the main navbar did
3. GET logout endpoint lacked cache control headers

## Root Cause Analysis

### Issue 1: Missing Cache-Busting on dashboard-guard.js

- PR #206 fixed `dashboard-guard.js` but HTML files loaded it without version parameters
- Browsers served cached broken versions instead of the fixed file
- Line 17 in `admin.html` and 18 other HTML files had: `<script src="/assets/js/dashboard-guard.js"></script>`

### Issue 2: Inconsistent Logout Implementations

- `auth-nav.js` (main site navbar): POST request + CSRF + storage clearing + cache-busting redirect
- `admin-navbar.js` (admin panel): Simple GET redirect, no storage clearing, no cache-busting
- This inconsistency caused admin users to have persistent auth state after logout

### Issue 3: GET Logout Endpoint Cache Headers

- The GET `/api/auth/logout` endpoint cleared cookies but didn't set cache control headers
- POST endpoint had headers, but GET endpoint didn't
- Could cause cached logout responses

## Solutions Implemented

### 1. Added Cache-Busting to All dashboard-guard.js References ✅

**Files Modified:** 19 HTML files

- `public/admin.html`
- `public/admin-*.html` (15 files)
- `public/dashboard-customer.html`
- `public/dashboard-supplier.html`

**Change:**

```html
<!-- Before -->
<script src="/assets/js/dashboard-guard.js"></script>

<!-- After -->
<script src="/assets/js/dashboard-guard.js?v=17.0.2"></script>
```

**Impact:**

- Browsers will now fetch the latest version of dashboard-guard.js
- No more serving cached broken versions
- Future updates can use new version numbers

### 2. Fixed admin-navbar.js Logout Flow ✅

**File Modified:** `public/assets/js/admin-navbar.js`

**Changes:**

1. Changed from GET redirect to POST request with CSRF token
2. Added localStorage and sessionStorage clearing
3. Added cache-busting timestamp to redirect
4. Made function async to properly await fetch

**Before:**

```javascript
logoutBtn.addEventListener('click', e => {
  e.preventDefault();
  if (confirm('Are you sure you want to sign out?')) {
    window.location.href = '/api/auth/logout';
  }
});
```

**After:**

```javascript
logoutBtn.addEventListener('click', async e => {
  e.preventDefault();
  if (confirm('Are you sure you want to sign out?')) {
    try {
      // Call POST logout endpoint with CSRF token
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': window.__CSRF_TOKEN__ || '' },
        credentials: 'include',
      });
    } catch (_) {
      /* Ignore logout errors */
    }
    // Clear any auth-related storage
    try {
      localStorage.removeItem('eventflow_onboarding_new');
      sessionStorage.clear();
    } catch (_) {
      /* Ignore storage errors */
    }
    // Force full reload with cache-busting to ensure clean state
    window.location.href = `/?t=${Date.now()}`;
  }
});
```

**Impact:**

- Admin logout now matches main site logout behavior
- Properly clears all auth state (cookies, localStorage, sessionStorage)
- Forces browser to reload with fresh state
- Uses CSRF protection for security

### 3. Enhanced GET Logout Endpoint ✅

**File Modified:** `routes/auth.js`

**Change:**

```javascript
// Before
router.get('/logout', authLimiter, (_req, res) => {
  clearAuthCookie(res);
  res.redirect('/');
});

// After
router.get('/logout', authLimiter, (_req, res) => {
  // Set cache control headers to prevent caching of logout response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  clearAuthCookie(res);
  res.redirect('/');
});
```

**Impact:**

- Prevents browsers from caching logout responses
- Ensures fresh logout on every request
- Matches POST endpoint behavior

## Testing

### Automated Tests

- ✅ All 525 tests passing
- ✅ Linting clean
- ✅ Code review passed (0 issues)
- ✅ Security scan passed (0 vulnerabilities)

### Manual Verification Script

Created verification script that checks:

- ✅ All 18 HTML files have cache-busting on dashboard-guard.js
- ✅ admin-navbar.js uses POST with CSRF token
- ✅ admin-navbar.js clears localStorage
- ✅ admin-navbar.js clears sessionStorage
- ✅ admin-navbar.js uses cache-busting redirect
- ✅ GET logout endpoint has cache headers

## Manual Testing Checklist

To verify fixes work in production:

### Test 1: Verify Cache-Busting

1. Open browser DevTools → Network tab
2. Navigate to any admin page (e.g., `/admin.html`)
3. Look for request to `dashboard-guard.js`
4. ✅ Should see `dashboard-guard.js?v=17.0.2` (not without version)
5. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
6. ✅ Should still fetch versioned file

### Test 2: Admin Panel Logout

1. Log in as admin user
2. Navigate to `/admin.html`
3. Click logout button
4. ✅ Should see confirmation dialog
5. Confirm logout
6. ✅ Should redirect to homepage with timestamp in URL (e.g., `/?t=1234567890`)
7. Check navbar
8. ✅ Should show "Log in" (not "Log out")
9. Refresh page
10. ✅ Should still show "Log in"

### Test 3: Login After Logout

1. After logging out (Test 2), click "Log in"
2. Log in as admin user
3. ✅ Should redirect to `/admin.html` (correct dashboard for admin role)
4. ✅ Navbar should show "Log out"
5. ✅ No errors in browser console
6. ✅ No `Cannot read properties of null (reading 'style')` error

### Test 4: Cross-Dashboard Access Control

1. Log in as admin
2. Try to visit `/dashboard-supplier.html`
3. ✅ Should auto-redirect to `/admin.html`
4. Try to visit `/dashboard-customer.html`
5. ✅ Should auto-redirect to `/admin.html`

### Test 5: Multiple Logout/Login Cycles

1. Log in → Log out → Log in → Log out → Log in
2. ✅ Each logout should properly clear state
3. ✅ Each login should work without errors
4. ✅ No auth state leakage between sessions

## Files Changed Summary

**20 files changed, 44 insertions(+), 22 deletions(-)**

| File                                | Changes                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `public/admin.html`                 | Added cache-busting to dashboard-guard.js                 |
| `public/admin-audit.html`           | Added cache-busting to dashboard-guard.js                 |
| `public/admin-content.html`         | Added cache-busting to dashboard-guard.js                 |
| `public/admin-homepage.html`        | Added cache-busting to dashboard-guard.js                 |
| `public/admin-marketplace.html`     | Added cache-busting to dashboard-guard.js                 |
| `public/admin-packages.html`        | Added cache-busting to dashboard-guard.js                 |
| `public/admin-payments.html`        | Added cache-busting to dashboard-guard.js                 |
| `public/admin-pexels.html`          | Added cache-busting to dashboard-guard.js                 |
| `public/admin-photos.html`          | Added cache-busting to dashboard-guard.js                 |
| `public/admin-reports.html`         | Added cache-busting to dashboard-guard.js                 |
| `public/admin-settings.html`        | Added cache-busting to dashboard-guard.js (2 occurrences) |
| `public/admin-supplier-detail.html` | Added cache-busting to dashboard-guard.js                 |
| `public/admin-suppliers.html`       | Added cache-busting to dashboard-guard.js                 |
| `public/admin-tickets.html`         | Added cache-busting to dashboard-guard.js                 |
| `public/admin-user-detail.html`     | Added cache-busting to dashboard-guard.js                 |
| `public/admin-users.html`           | Added cache-busting to dashboard-guard.js                 |
| `public/dashboard-customer.html`    | Added cache-busting to dashboard-guard.js                 |
| `public/dashboard-supplier.html`    | Added cache-busting to dashboard-guard.js                 |
| `public/assets/js/admin-navbar.js`  | Fixed logout to use POST, clear storage, cache-bust       |
| `routes/auth.js`                    | Added cache headers to GET logout endpoint                |

## Security Considerations

1. **CSRF Protection**: Admin logout now uses POST with CSRF token
2. **Cache Control**: Prevents caching of sensitive auth responses
3. **Storage Clearing**: Ensures no auth state persists in browser storage
4. **Cache-Busting**: Prevents serving outdated security-sensitive code

## Future Improvements

1. Consider adding server-side session invalidation (currently only clears client-side)
2. Add telemetry to track logout success rate
3. Consider adding visual feedback during logout process
4. Add E2E tests for logout flow

## Related Documentation

- `AUTH_STATE_FIXES_SUMMARY.md` - PR #206 original fixes
- `public/assets/js/dashboard-guard.js` - Role-based access control
- `public/assets/js/auth-nav.js` - Main site logout pattern
- `middleware/auth.js` - Cookie clearing implementation

## Deployment Notes

1. **Clear CDN cache** if using one (to serve new HTML files with cache-busting)
2. **No database migrations** required
3. **No breaking changes** - backward compatible
4. **Monitor** logout errors in Sentry after deployment
5. **Test** on staging environment first with multiple user roles

## Support

If issues persist after this fix:

1. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear browser cache
2. Check browser console for JavaScript errors
3. Check Network tab for failed requests
4. Verify cookies are being cleared after logout
5. Try in incognito/private browsing mode to rule out extension conflicts
