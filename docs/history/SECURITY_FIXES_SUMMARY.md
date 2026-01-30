# Security & Auth State Fixes Summary

## Overview

This PR addresses critical security vulnerabilities and auth state management issues reported after the merge of PR #205.

## Issues Fixed

### 1. Dashboard Guard Crash (Critical)

**Problem:** The dashboard guard script was attempting to access `document.body` before it existed, causing crashes when included in `<head>` tags.

**Solution:**

- Changed from direct `document.body` manipulation to injecting a `<style>` tag in `<head>`
- Style tag hides body with `visibility: hidden !important` and `opacity: 0 !important`
- Works even when script runs before `<body>` exists
- Guard removes the style tag via `showPage()` function when access is granted
- Fails closed: redirects to login on any error

**Files Changed:**

- `public/assets/js/dashboard-guard.js`

### 2. Post-Login Redirect Security Vulnerability (Critical)

**Problem:** The login flow blindly trusted `redirect` query parameters, allowing an admin to be redirected to customer/supplier dashboards or potentially malicious URLs.

**Solution:**

- Implemented `validateRedirectForRole()` function with allowlist-based validation
- Computes destination from user role FIRST, then optionally validates redirect param
- Only allows same-origin, role-appropriate paths:
  - Admin: Only `/admin*.html` pages
  - Supplier: Only `/dashboard-supplier.html`, `/settings.html`, `/plan.html`
  - Customer: Only `/dashboard-customer.html`, `/settings.html`, `/plan.html`, `/checkout.html`
- Rejects external URLs, protocol-relative URLs, javascript: URLs, etc.
- Applied to both login form submission and "already logged in" check on auth page

**Files Changed:**

- `public/assets/js/app.js` - Added `validateRedirectForRole()` function and updated login flow

**Tests Added:**

- `tests/unit/redirect-validation.test.js` - 28 comprehensive tests covering:
  - Role-based allowlisting
  - Security against external URLs, XSS, path traversal
  - Edge cases and error handling

### 3. Logout Navbar State Issues

**Problem:** After logout, navbar sometimes still showed "Log out" instead of "Log in" due to cached auth state.

**Solution:**

- Enhanced logout handler to clear ALL auth-related storage:
  - Clears `localStorage` auth markers
  - Clears `sessionStorage` entirely
  - Already clears auth cookie via backend
- Forces full page reload with cache-busting timestamp
- Ensures clean slate for navbar rendering

**Files Changed:**

- `public/assets/js/auth-nav.js`

### 4. Cookie Clearing Hardening

**Problem:** Logout cookie clearing might not work consistently across www/apex domain variants in production.

**Solution:**

- Enhanced `clearAuthCookie()` to attempt clearing with multiple domain configurations
- In production, tries:
  1. Standard clearing with path and options
  2. Legacy clearing without path
  3. Explicit domain variants (`.event-flow.co.uk`, `event-flow.co.uk`)
- Ensures cookie is cleared regardless of how it was originally set

**Files Changed:**

- `middleware/auth.js`

**Tests Added:**

- Updated `tests/unit/auth-middleware.test.js` with 3 new tests:
  - Verifies multiple clear attempts
  - Verifies domain-specific clearing in production
  - Verifies simpler clearing in development

## Test Coverage

### New Tests

- **28 tests** for redirect validation (all passing)
- **3 tests** for cookie clearing enhancements (all passing)

### Updated Tests

- Fixed integration tests in `tests/integration/auth-state-fixes.test.js` to match new guard behavior

### Overall Test Status

- **525 tests passing** ✅
- **0 tests failing** ✅

## Security Improvements

1. **No more redirect param trust:** Admin users cannot be tricked into landing on customer/supplier pages
2. **Fail-closed dashboard guard:** Any error results in redirect to login, never shows content inappropriately
3. **No DOM crashes:** Guard works safely even when script runs before body exists
4. **Complete logout:** All auth state thoroughly cleared across storage mechanisms and cookie domains
5. **XSS/Open Redirect Prevention:** Comprehensive validation prevents malicious redirect parameters

## Breaking Changes

None - all changes are backward compatible.

## Deployment Notes

- No special deployment steps required
- Cookie clearing improvements are automatic in production based on NODE_ENV
- No database migrations needed

## Manual Testing Checklist

- [ ] Login as admin → verify lands on `/admin.html`
- [ ] Login as supplier → verify lands on `/dashboard-supplier.html`
- [ ] Login as customer → verify lands on `/dashboard-customer.html`
- [ ] Login with redirect param for wrong role → verify ignored and lands on correct role dashboard
- [ ] Login with malicious redirect (e.g., `http://evil.com`) → verify rejected
- [ ] Logout → verify navbar shows "Log in"
- [ ] Logout → refresh page → verify still shows "Log in"
- [ ] Dashboard guard on protected page while logged out → verify redirects to login
- [ ] Dashboard guard on protected page with wrong role → verify redirects to correct dashboard

## Code Review Focus Areas

1. **Redirect validation logic** - Ensure allowlists are comprehensive and secure
2. **Cookie clearing domain handling** - Verify production domain variants are correct
3. **Dashboard guard fail-closed behavior** - Confirm no edge cases expose content inappropriately
4. **Test coverage** - Review test scenarios for completeness
