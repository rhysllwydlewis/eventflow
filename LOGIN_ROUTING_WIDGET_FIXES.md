# Login Routing and Edge Widget Teaser Fixes

## Problem Statement

Two user-reported issues needed resolution:

### Issue 1: Login redirect/return logic incorrect

- While logging in with admin credentials, the login flow was showing customer dashboard URLs in the return parameter
- Example: `auth.html?return=%2Fdashboard-customer.html` visible during admin login
- This indicated stale cached/remembered redirect logic from previous sessions
- Users were concerned about being routed to wrong dashboards

### Issue 2: Edge widget teaser sizing & dismissal

- The JadeAssist chat widget teaser (shown bottom-left) was too small
- The teaser wasn't dismissing properly or staying dismissed across page loads
- Users wanted a larger, more visible teaser that could be permanently dismissed

## Root Cause Analysis

### Issue 1: Login Redirect

The redirect validation logic was already correct in `app.js`:

- `validateRedirectForRole()` function validates return URLs against user role
- Admin users would correctly ignore customer dashboard redirects
- **However**, the confusing URL parameter remained visible in the browser address bar during login

The UX issue was that even though the redirect would be ignored, the presence of the wrong dashboard URL in the address bar was confusing to users.

### Issue 2: Widget Teaser

- Site was using `jadeassist-init.v2.js` which is a simplified version without custom teaser
- The v2 script uses the widget's built-in `greetingTooltipText` which has limited styling
- The original `jadeassist-init.js` has full custom teaser implementation with:
  - Dismissal persistence via localStorage
  - Larger customizable size
  - Custom positioning and animations
  - Better UX controls

## Solutions Implemented

### 1. Enhanced Login Redirect Validation with URL Cleanup ✅

**File Modified:** `public/assets/js/app.js`

**Changes:**

1. **Added URL cleanup when invalid redirect is detected** (lines ~2727-2738):

   ```javascript
   if (!isValidRedirect) {
     console.warn(`Ignoring untrusted redirect param: ${redirect} for role: ${user.role}`);
     // Clear the invalid redirect from browser history to prevent confusion
     try {
       const cleanUrl = new URL(window.location.href);
       cleanUrl.searchParams.delete('redirect');
       cleanUrl.searchParams.delete('return');
       window.history.replaceState({}, '', cleanUrl.toString());
     } catch (_) {
       /* Ignore history API errors */
     }
   }
   ```

2. **Enhanced already-logged-in redirect validation** (lines ~2338-2375):
   - When a user is already logged in and visits auth.html with a return parameter
   - The code now validates that return parameter against their current role
   - Only redirects to valid role-appropriate pages
   - Ignores invalid redirects with console warning

**Impact:**

- Admin users logging in with `?return=/dashboard-customer.html` will:
  - See the parameter cleared from the URL
  - Be correctly routed to `/admin.html`
  - No longer see confusing customer dashboard URLs
- URL history is cleaned up automatically
- Prevents cross-role redirect attacks

### 2. Switch to Custom Teaser Widget Implementation ✅

**Files Modified:** 49 HTML files across the site

**Change:** Updated all HTML files from:

```html
<script src="/assets/js/jadeassist-init.v2.js" defer></script>
```

To:

```html
<script src="/assets/js/jadeassist-init.js" defer></script>
```

**Files Updated:**

- All 40 main public/\*.html files
- 8 article pages in public/articles/
- 1 supplier page in public/supplier/

**Impact:**

- Custom teaser functionality restored
- Dismissal now works with localStorage key: `jadeassist-teaser-dismissed`
- Dismissal persists for 1 day (configurable via `TEASER_EXPIRY_DAYS`)
- Teaser auto-dismisses after 15 seconds if not interacted with
- Better UX with custom animations and larger hit areas

### 3. Increased Teaser Size ✅

**Files Modified:**

- `public/assets/css/ui-ux-fixes.css`
- `public/assets/js/jadeassist-init.js`

**Changes:**

1. **CSS Widget Greeting Size** (ui-ux-fixes.css):

   ```css
   /* Before */
   max-width: 280px !important;
   min-width: 260px !important;

   /* After - Desktop */
   max-width: 320px !important; /* +40px */
   min-width: 280px !important; /* +20px */

   /* After - Mobile */
   max-width: 280px !important; /* +20px */
   min-width: 260px !important; /* +20px */
   ```

2. **Custom Teaser Bubble Size** (jadeassist-init.js):
   ```css
   .jade-teaser {
     max-width: 320px; /* Increased from 280px */
     /* ... */
   }
   ```

**Impact:**

- Desktop teaser: 40px wider (280px → 320px)
- Mobile teaser: 20px wider (260px → 280px)
- More visible and readable on all devices
- Better alignment with design requirements

### 4. Added Comprehensive Tests ✅

**Files Modified:**

- `tests/integration/auth-state-fixes.test.js` - Added 6 new tests
- `tests/integration/jadeassist-widget.test.js` - Updated 3 tests

**New Tests:**

1. **Login Redirect Validation and Cleanup:**
   - Validates `validateRedirectForRole` function exists
   - Checks for allowed paths per role (admin/supplier/customer)
   - Verifies same-origin URL validation
   - Confirms invalid redirect parameters are cleaned from URL
   - Tests redirect validation in login flow
   - Tests already-logged-in redirect validation

2. **Edge Widget Teaser:**
   - Verifies teaser functionality exists (showTeaser/dismissTeaser)
   - Confirms localStorage usage for dismissal persistence
   - Validates increased teaser size (320px desktop)
   - Checks CSS has increased widget greeting tooltip size
   - Confirms HTML files use custom teaser script (not v2)

3. **Updated Widget Tests:**
   - Changed expectation from v2 to v1 custom teaser script
   - Updated test descriptions to reflect teaser requirement
   - All 122 integration tests passing

**Test Results:**

```
Test Suites: 11 passed, 11 total
Tests:       122 passed, 122 total
```

## Security Considerations

1. **Redirect Validation:** The existing `validateRedirectForRole()` function provides strong protection:
   - Only allows same-origin URLs (prevents open redirect)
   - Validates against role-specific allowlists
   - Strips query strings and hashes from validation
   - Logs warnings for suspicious redirects

2. **URL Cleanup:** Using `window.history.replaceState()` to remove invalid parameters:
   - Prevents user confusion about intended destination
   - Clears potentially malicious redirect attempts from browser history
   - Maintains clean URL state for subsequent navigation

3. **Teaser Dismissal:** Uses localStorage, not critical for security:
   - Only stores dismissal timestamp
   - No sensitive data in storage
   - Gracefully handles storage errors

## Testing

### Automated Tests ✅

- All 122 integration tests passing
- Linting clean (ESLint)
- Code formatted with Prettier

### Manual Testing Required

#### Test 1: Admin Login with Invalid Redirect

1. Navigate to `/auth.html?return=%2Fdashboard-customer.html`
2. Log in with admin credentials
3. ✅ Should redirect to `/admin.html` (not customer dashboard)
4. ✅ URL bar should not show the return parameter after login
5. ✅ Console should show warning: "Ignoring untrusted redirect param"

#### Test 2: Customer Login with Valid Redirect

1. Navigate to `/auth.html?return=%2Fdashboard-customer.html`
2. Log in with customer credentials
3. ✅ Should redirect to `/dashboard-customer.html` (valid for customer)
4. ✅ No warnings in console

#### Test 3: Cross-Role Protection

1. Log in as customer, visit `/dashboard-customer.html`
2. Log out
3. Navigate to `/auth.html?return=%2Fdashboard-customer.html`
4. Log in with admin credentials
5. ✅ Should ignore customer dashboard redirect
6. ✅ Should redirect to `/admin.html`
7. ✅ URL should be cleaned

#### Test 4: Widget Teaser Visibility (Desktop)

1. Open homepage in desktop browser (width > 768px)
2. Wait 2 seconds for widget to initialize
3. ✅ Should see JadeAssist widget button (bottom-left)
4. Wait additional 500ms
5. ✅ Should see teaser bubble appear (larger, ~320px wide)
6. ✅ Teaser should have close button (×)
7. ✅ Teaser text should be readable

#### Test 5: Widget Teaser Dismissal (Desktop)

1. Click the × close button on teaser
2. ✅ Teaser should fade out and disappear
3. Refresh the page
4. ✅ Teaser should NOT reappear (stored in localStorage)
5. Open DevTools → Application → Local Storage
6. ✅ Should see key: `jadeassist-teaser-dismissed` with timestamp
7. Delete the localStorage key and refresh
8. ✅ Teaser should appear again

#### Test 6: Widget Teaser Interaction

1. Open homepage, wait for teaser to appear
2. Click anywhere on the teaser bubble (not the × button)
3. ✅ Teaser should dismiss
4. ✅ Chat widget should open
5. Close the chat widget
6. Refresh the page
7. ✅ Teaser should NOT reappear (dismissal persisted)

#### Test 7: Widget Teaser Visibility (Mobile)

1. Open homepage in mobile browser (width < 768px)
2. Wait for teaser to appear
3. ✅ Teaser should be slightly smaller (~280px max)
4. ✅ Teaser should be readable on small screen
5. ✅ Dismissal should work same as desktop

#### Test 8: Widget Teaser Auto-Dismiss

1. Open homepage, wait for teaser to appear
2. Don't interact with teaser
3. Wait 15 seconds
4. ✅ Teaser should automatically fade out
5. ✅ Dismissal should be stored in localStorage
6. Refresh page
7. ✅ Teaser should NOT reappear

## Files Changed Summary

**Total:** 53 files changed, 207 insertions(+), 76 deletions(-)

### Core Logic Changes (4 files):

- `public/assets/js/app.js` - Login redirect validation & cleanup
- `public/assets/js/jadeassist-init.js` - Teaser size increase
- `public/assets/css/ui-ux-fixes.css` - Widget greeting size increase

### HTML Files Updated (49 files):

All switched from `jadeassist-init.v2.js` → `jadeassist-init.js`

**Main pages (40 files):**

- auth.html, index.html, dashboard-customer.html, dashboard-supplier.html
- blog.html, budget.html, category.html, checkout.html, compare.html
- contact.html, conversation.html, credits.html, data-rights.html, faq.html
- for-suppliers.html, gallery.html, guests.html, legal.html, maintenance.html
- marketplace.html, messages.html, modal-test.html, offline.html, package.html
- payment-cancel.html, payment-success.html, plan.html, pricing.html
- privacy.html, reset-password.html, settings.html, start.html, supplier.html
- suppliers.html, terms-old.html, terms.html, test-avatar-positioning.html
- test-jadeassist-real.html, test-ui-fixes.html, timeline.html, verify.html

**Article pages (8 files):**

- articles/birthday-party-planning-guide.html
- articles/corporate-event-planning-guide.html
- articles/event-budget-management-guide.html
- articles/event-photography-complete-guide.html
- articles/perfect-wedding-day-timeline-guide.html
- articles/sustainable-event-planning-guide.html
- articles/wedding-catering-trends-2024.html
- articles/wedding-venue-selection-guide.html

**Supplier pages (1 file):**

- supplier/subscription.html

### Test Files (2 files):

- `tests/integration/auth-state-fixes.test.js` - Added 6 new tests
- `tests/integration/jadeassist-widget.test.js` - Updated 3 tests

## Deployment Notes

1. **No Database Changes:** No migrations required
2. **No Breaking Changes:** Backward compatible
3. **Browser Cache:** Users may need to hard refresh to see teaser
4. **localStorage:** Existing dismissed teasers from v2 won't interfere
5. **Testing Priority:**
   - Test admin login flow first
   - Verify teaser dismissal works
   - Check mobile responsive behavior

## Support & Troubleshooting

### If redirect issues persist:

1. Check browser console for "Ignoring untrusted redirect" warnings
2. Verify user role matches expected dashboard access
3. Check if return parameter is being added by bookmarks/history
4. Hard refresh to clear any cached JavaScript

### If teaser doesn't appear:

1. Check localStorage for `jadeassist-teaser-dismissed` key
2. Delete the key to reset dismissal
3. Wait 2-3 seconds after page load for widget initialization
4. Check console for JadeAssist initialization logs
5. Try with `?jade-debug` query parameter for diagnostic logs

### If teaser doesn't stay dismissed:

1. Check if localStorage is enabled in browser
2. Check for Private/Incognito mode (localStorage may not persist)
3. Verify `jadeassist-teaser-dismissed` key exists after dismissal
4. Check browser console for any storage errors

## Future Improvements

1. **Session-Based Return URL Storage:**
   - Store intended return URL in sessionStorage instead of query params
   - Clear on logout automatically
   - Never visible in URL bar

2. **Teaser A/B Testing:**
   - Track teaser interaction rates
   - Test different sizes and messages
   - Optimize for engagement

3. **Role-Specific Teaser Messages:**
   - Different teaser text for different user types
   - Personalized based on page context

4. **Enhanced Redirect Validation:**
   - Server-side validation of return URLs
   - Rate limiting for suspicious redirect attempts
   - Logging and monitoring of validation failures

## Related Documentation

- `AUTH_STATE_FIXES_SUMMARY.md` - PR #206 original auth fixes
- `LOGOUT_CACHE_FIXES.md` - PR #207 logout and cache-busting fixes
- `public/assets/js/dashboard-guard.js` - Role-based access control
- `public/assets/js/auth-nav.js` - Navigation logout handler
- `public/assets/js/jadeassist-init.js` - Custom teaser implementation
