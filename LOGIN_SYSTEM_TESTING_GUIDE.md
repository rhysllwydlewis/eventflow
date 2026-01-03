# Login System Testing Guide

## Prerequisites
- Server running on localhost or deployment environment
- Admin account credentials
- Multiple browsers for testing (Chrome, Firefox, Safari, Mobile)
- Network throttling tool for mobile simulation

## Test Suite

### Test 1: CSRF Token Generation and Usage

**Objective:** Verify CSRF tokens are properly generated and included in login requests

**Steps:**
1. Navigate to `/auth.html`
2. Open browser DevTools (F12) → Console tab
3. Look for message: "CSRF token fetched successfully"
4. In Console, type: `window.__CSRF_TOKEN__`
5. Verify token is a 64-character hex string

**Expected Results:**
- ✅ CSRF token fetched message appears in console
- ✅ `window.__CSRF_TOKEN__` contains valid token
- ✅ No CSRF-related errors in console

**Failure Indicators:**
- ❌ Error: "Failed to fetch CSRF token"
- ❌ `window.__CSRF_TOKEN__` is undefined
- ❌ 403 errors on login attempt

---

### Test 2: Login with CSRF Token (Desktop)

**Objective:** Verify login works with CSRF token on desktop browsers

**Steps:**
1. Navigate to `/auth.html`
2. Wait for CSRF token to load (check console)
3. Enter valid credentials in login form
4. Click "Log in" button
5. Monitor Network tab for `/api/auth/login` request

**Expected Results:**
- ✅ Login request includes `X-CSRF-Token` header
- ✅ Login succeeds (200 OK response)
- ✅ User redirected to appropriate dashboard
- ✅ Cookie `token` is set in browser

**Test Data:**
- Email: `admin@event-flow.co.uk`
- Password: `[admin password]`

---

### Test 3: Login with CSRF Token (Mobile)

**Objective:** Verify login works on mobile devices

**Steps:**
1. Open site on mobile device or use Chrome DevTools device emulation
2. Navigate to `/auth.html`
3. Wait for CSRF token to load
4. Enter valid credentials
5. Tap "Log in"

**Expected Results:**
- ✅ Login succeeds on mobile
- ✅ No infinite redirect loop
- ✅ User redirected to dashboard

**Mobile Browsers to Test:**
- iOS Safari
- Chrome Mobile (Android)
- Firefox Mobile

---

### Test 4: Remember Me - Checked (30-day session)

**Objective:** Verify "Remember Me" extends session to 30 days

**Steps:**
1. Navigate to `/auth.html`
2. Check the "Remember Me" checkbox
3. Enter valid credentials and login
4. After login, inspect cookies in DevTools:
   - Application/Storage → Cookies → `token`
5. Check cookie expiration date

**Expected Results:**
- ✅ "Remember Me" checkbox is checked
- ✅ Login succeeds
- ✅ Cookie `token` has Max-Age ≈ 2,592,000 seconds (30 days)
- ✅ Cookie expires approximately 30 days from now

**How to Verify:**
```javascript
// In browser console after login:
document.cookie.split(';').forEach(c => console.log(c.trim()));
```

---

### Test 5: Remember Me - Unchecked (7-day session)

**Objective:** Verify default session is 7 days when unchecked

**Steps:**
1. Clear all cookies
2. Navigate to `/auth.html`
3. Leave "Remember Me" checkbox UNCHECKED
4. Enter valid credentials and login
5. Inspect cookie expiration

**Expected Results:**
- ✅ "Remember Me" checkbox is NOT checked
- ✅ Login succeeds
- ✅ Cookie `token` has Max-Age ≈ 604,800 seconds (7 days)
- ✅ Cookie expires approximately 7 days from now

---

### Test 6: Remember Me - Session Persistence

**Objective:** Verify user stays logged in across browser sessions

**Steps:**
1. Login with "Remember Me" checked
2. Close browser completely (not just tab)
3. Reopen browser and navigate to site
4. Navigate to `/api/auth/me`

**Expected Results:**
- ✅ User remains logged in after browser restart
- ✅ `/api/auth/me` returns user object
- ✅ No login prompt appears

**Note:** This test requires closing and reopening the browser, not just the tab.

---

### Test 7: Remember Me - UI Styling

**Objective:** Verify checkbox styling is visually appealing

**Steps:**
1. Navigate to `/auth.html`
2. Observe "Remember me" checkbox
3. Hover over checkbox and label
4. Tab to checkbox (keyboard navigation)
5. Click checkbox on/off

**Expected Results:**
- ✅ Checkbox is 18x18 pixels (visible size)
- ✅ Checkbox has purple accent color (#667eea)
- ✅ Label is clickable (toggles checkbox)
- ✅ Hover shows opacity change (0.8)
- ✅ Focus shows outline for accessibility
- ✅ Good spacing between label and checkbox (10px)

---

### Test 8: Admin Access During Maintenance Mode

**Objective:** Verify admins can login and access dashboard during maintenance

**Setup:**
1. Login as admin
2. Navigate to `/admin-settings.html`
3. Enable maintenance mode
4. Logout

**Test Steps:**
1. Navigate to site homepage (should redirect to maintenance page)
2. Click login or navigate to `/auth.html`
3. Login with admin credentials
4. Verify redirect to admin dashboard

**Expected Results:**
- ✅ Non-admin users see maintenance page
- ✅ Admin can access `/auth.html`
- ✅ Admin login succeeds
- ✅ Admin redirected to `/admin.html`
- ✅ Admin can access all admin pages
- ✅ Admin can disable maintenance mode

**Important:** Admin should NOT get stuck in redirect loop

---

### Test 9: Maintenance Auto-Timer - Set Duration

**Objective:** Verify maintenance timer can be set and saved

**Steps:**
1. Login as admin
2. Navigate to `/admin-settings.html`
3. Scroll to "Maintenance Mode" section
4. Select "15 minutes" from "Auto-Disable Timer" dropdown
5. Enable maintenance mode
6. Click "Update Maintenance Mode"
7. Refresh page

**Expected Results:**
- ✅ Duration dropdown shows selected value
- ✅ Settings save successfully
- ✅ Success toast message appears
- ✅ Maintenance mode is enabled
- ✅ Duration is preserved after refresh

---

### Test 10: Maintenance Auto-Timer - Countdown Display

**Objective:** Verify countdown timer displays and updates

**Steps:**
1. Continue from Test 9 (maintenance enabled with 15-min timer)
2. Observe countdown display area
3. Wait 5-10 seconds
4. Observe countdown updates

**Expected Results:**
- ✅ Countdown display is visible
- ✅ Shows format: "⏰ Auto-disable in: 14m 55s"
- ✅ Countdown updates every second
- ✅ Blue background color (#f0f7ff)
- ✅ Time decreases each second

**Countdown Format Examples:**
- `⏰ Auto-disable in: 14m 55s`
- `⏰ Auto-disable in: 1h 23m 45s`
- `⏰ Auto-disable in: 2d 3h 15m`

---

### Test 11: Maintenance Auto-Timer - Auto-Disable

**Objective:** Verify maintenance auto-disables when timer expires

**Note:** This test requires waiting for timer to expire. For testing, use shortest duration (15 minutes) or manually adjust `expiresAt` in database.

**Steps (Quick Test Method):**
1. Enable maintenance with 15-minute timer
2. Use database tool to set `expiresAt` to 1 minute in future
3. Wait 1-2 minutes
4. Navigate to any page as non-admin user
5. Check if maintenance page still appears

**Expected Results:**
- ✅ After expiration, maintenance mode auto-disables
- ✅ Non-admin users can access site again
- ✅ Console log: "Maintenance mode expired, auto-disabling..."
- ✅ Admin dashboard shows maintenance disabled
- ✅ Countdown shows: "⏰ Maintenance mode has expired..."

---

### Test 12: Maintenance Auto-Timer - Manual Disable

**Objective:** Verify manual disable works while timer is active

**Steps:**
1. Enable maintenance with 30-minute timer
2. Verify countdown is showing
3. Click "Disable" or toggle maintenance off
4. Verify countdown disappears

**Expected Results:**
- ✅ Maintenance can be manually disabled
- ✅ Countdown timer stops and disappears
- ✅ Timer is cleared (no memory leak)
- ✅ Site becomes accessible to all users

---

### Test 13: Error Handling - No CSRF Token

**Objective:** Verify proper error handling if CSRF token fails

**Steps:**
1. Navigate to `/auth.html`
2. In DevTools Console, run: `window.__CSRF_TOKEN__ = null`
3. Attempt to login
4. Observe error message

**Expected Results:**
- ✅ Login fails with clear error message
- ✅ Error message: "CSRF token missing"
- ✅ No uncaught exceptions in console
- ✅ User can retry login

---

### Test 14: Error Handling - Invalid Credentials

**Objective:** Verify login errors display properly

**Steps:**
1. Navigate to `/auth.html`
2. Enter invalid email/password
3. Click "Log in"
4. Observe error message

**Expected Results:**
- ✅ Error displayed: "Invalid email or password"
- ✅ Error is visible and readable
- ✅ Form remains filled
- ✅ User can retry login

---

### Test 15: Accessibility - Keyboard Navigation

**Objective:** Verify all features are keyboard accessible

**Steps:**
1. Navigate to `/auth.html`
2. Use Tab key to navigate through form
3. Use Space/Enter to check checkbox
4. Use Enter to submit form

**Expected Results:**
- ✅ Can tab to all form fields
- ✅ Can tab to "Remember me" checkbox
- ✅ Can toggle checkbox with Space/Enter
- ✅ Focus indicators are visible
- ✅ Can submit form with Enter key

---

### Test 16: Cross-Browser Compatibility

**Objective:** Verify functionality across different browsers

**Browsers to Test:**
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

**Test Each Browser:**
1. Login with CSRF token
2. Test Remember Me checkbox
3. Test admin access during maintenance
4. Test maintenance countdown display

**Expected Results:**
- ✅ All features work consistently across browsers
- ✅ Styling appears correctly
- ✅ No browser-specific errors

---

## Regression Tests

### Regression Test 1: Existing Login Flow

**Objective:** Verify existing login functionality still works

**Steps:**
1. Navigate to `/auth.html`
2. Login without checking "Remember Me"
3. Verify redirect to correct dashboard
4. Logout and login again

**Expected Results:**
- ✅ Standard login flow unaffected
- ✅ Dashboard redirect works correctly
- ✅ No new errors introduced

### Regression Test 2: Admin Settings

**Objective:** Verify other admin settings still work

**Steps:**
1. Login as admin
2. Navigate to `/admin-settings.html`
3. Toggle various feature flags
4. Update other settings

**Expected Results:**
- ✅ Feature flags still work
- ✅ Email templates accessible
- ✅ No JavaScript errors
- ✅ All existing functionality intact

---

## Performance Tests

### Performance Test 1: CSRF Token Fetch Time

**Objective:** Measure CSRF token fetch overhead

**Steps:**
1. Open DevTools → Network tab
2. Navigate to `/auth.html`
3. Find `/api/csrf-token` request
4. Check request duration

**Expected Results:**
- ✅ Token fetch completes in < 100ms
- ✅ Does not block page load
- ✅ No noticeable delay to user

### Performance Test 2: Countdown Timer Efficiency

**Objective:** Verify countdown doesn't cause performance issues

**Steps:**
1. Enable maintenance with timer
2. Open DevTools → Performance tab
3. Record for 10 seconds
4. Check CPU usage

**Expected Results:**
- ✅ Minimal CPU usage (< 1%)
- ✅ No memory leaks
- ✅ Timer stops when page unloaded

---

## Security Tests

### Security Test 1: CSRF Protection

**Objective:** Verify login is protected against CSRF attacks

**Steps:**
1. Try to login without CSRF token (set to null)
2. Try to login with invalid CSRF token
3. Try to reuse old CSRF token

**Expected Results:**
- ✅ Login fails without valid token
- ✅ 403 Forbidden response
- ✅ Clear error message
- ✅ Expired tokens rejected

### Security Test 2: Cookie Security

**Objective:** Verify cookies are properly secured

**Steps:**
1. Login successfully
2. Inspect cookie in DevTools
3. Check cookie attributes

**Expected Results:**
- ✅ httpOnly: true
- ✅ secure: true (in production)
- ✅ sameSite: lax
- ✅ No sensitive data in cookie value

---

## Test Report Template

```
# Test Report: Login System Fixes

Date: [DATE]
Tester: [NAME]
Environment: [Production/Staging/Local]
Browser: [Browser Name + Version]

## Test Results Summary

Total Tests: 16
Passed: [ ]
Failed: [ ]
Skipped: [ ]

## Failed Tests

| Test # | Test Name | Failure Reason | Screenshot |
|--------|-----------|----------------|------------|
|        |           |                |            |

## Notes

[Any additional observations or issues found]

## Sign-off

☐ All critical tests passed
☐ No security issues found
☐ Performance acceptable
☐ Ready for production

Signature: ________________  Date: __________
```

---

## Quick Test Checklist

Use this checklist for rapid testing:

- [ ] CSRF token loads on auth page
- [ ] Login works on desktop
- [ ] Login works on mobile  
- [ ] Remember Me extends session to 30 days
- [ ] Default session is 7 days
- [ ] Checkbox styling looks good
- [ ] Admin can login during maintenance
- [ ] Admin can access admin pages during maintenance
- [ ] Maintenance timer can be set
- [ ] Countdown displays and updates
- [ ] Maintenance auto-disables when expired
- [ ] Manual disable works while timer active
- [ ] No console errors
- [ ] No infinite redirect loops
- [ ] Cross-browser compatibility confirmed

---

## Troubleshooting Guide

### Issue: CSRF token not loading

**Symptoms:** `window.__CSRF_TOKEN__` is undefined

**Solutions:**
1. Check if `/api/csrf-token` endpoint is accessible
2. Check browser console for fetch errors
3. Verify CORS settings allow credentials
4. Check network tab for 403/500 errors

### Issue: Countdown not updating

**Symptoms:** Timer shows but doesn't count down

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify `expiresAt` is set in settings
3. Check if `setInterval` is being blocked
4. Refresh page to restart countdown

### Issue: Remember Me not working

**Symptoms:** User logged out after browser restart

**Solutions:**
1. Check if checkbox was actually checked
2. Verify cookie Max-Age in DevTools
3. Check if cookies are being cleared by browser
4. Verify server sent correct cookie expiry

---

## Automated Testing (Future)

Consider implementing automated tests using:

- **Playwright:** For end-to-end testing
- **Jest:** For unit testing JavaScript functions
- **Cypress:** For integration testing

Example test case:
```javascript
test('Login with Remember Me', async () => {
  await page.goto('/auth.html');
  await page.fill('#login-email', 'test@example.com');
  await page.fill('#login-password', 'password');
  await page.check('#login-remember');
  await page.click('button[type="submit"]');
  
  // Verify redirect
  await expect(page).toHaveURL('/dashboard-customer.html');
  
  // Verify cookie
  const cookies = await context.cookies();
  const tokenCookie = cookies.find(c => c.name === 'token');
  expect(tokenCookie.maxAge).toBeGreaterThan(7 * 24 * 60 * 60);
});
```

---

## Contact

For questions about this testing guide, contact:
- Technical Lead: [Name]
- QA Team: [Email]
- GitHub Issues: https://github.com/rhysllwydlewis/eventflow/issues
