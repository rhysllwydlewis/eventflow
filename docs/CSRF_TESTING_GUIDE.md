# CSRF Protection Testing Guide

This document describes how to manually test the CSRF protection implementation.

## Overview

The EventFlow application now uses the **Double-Submit Cookie pattern** for CSRF protection:

1. Server generates a random CSRF token
2. Token is set as a cookie (`csrf`) AND returned in the response
3. Client reads the cookie and includes it in the `X-CSRF-Token` header for write operations
4. Server validates that the header value matches the cookie value

## Security Properties

- **SameSite=Lax**: Prevents cookie from being sent in cross-site requests
- **Secure flag**: Cookie only sent over HTTPS in production
- **NOT HttpOnly**: Client JavaScript can read the cookie to send in header
- **Stateless**: No server-side storage required
- **Same-Origin Policy**: Attacker cannot read cookie from different origin

## Manual Testing Steps

### Test 1: GET CSRF Token

**Request:**
```bash
curl -i -X GET http://localhost:3000/api/csrf-token
```

**Expected Response:**
- Status: 200
- Headers should include `Set-Cookie: csrf=<token>; ...`
- Body: `{"csrfToken":"<token>"}`
- The token in the cookie should match the token in the JSON body

### Test 2: POST Without CSRF Token (Should Fail)

**Request:**
```bash
curl -i -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<valid-auth-token>"
```

**Expected Response:**
- Status: 403
- Body: `{"error":"CSRF token missing"}`

### Test 3: POST With Wrong CSRF Token (Should Fail)

**Request:**
```bash
curl -i -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<valid-auth-token>; csrf=token1" \
  -H "X-CSRF-Token: wrong-token"
```

**Expected Response:**
- Status: 403
- Body: `{"error":"Invalid CSRF token"}`

### Test 4: POST With Correct CSRF Token (Should Succeed)

**Request:**
```bash
# First, get a CSRF token
TOKEN=$(curl -s http://localhost:3000/api/csrf-token | jq -r '.csrfToken')

# Then use it in a request
curl -i -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<valid-auth-token>; csrf=$TOKEN" \
  -H "X-CSRF-Token: $TOKEN"
```

**Expected Response:**
- Status: 200
- Body: `{"ok":true}`

### Test 5: Admin Route CSRF Protection

**Request:**
```bash
# Get CSRF token and auth token
TOKEN=$(curl -s -c cookies.txt http://localhost:3000/api/csrf-token | jq -r '.csrfToken')

# Try to create an FAQ without CSRF token
curl -i -X POST http://localhost:3000/api/admin/content/faqs \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<admin-auth-token>" \
  -d '{"question":"Test?","answer":"Test answer"}'
```

**Expected Response:**
- Status: 403
- Body: `{"error":"CSRF token missing"}`

**With CSRF Token:**
```bash
curl -i -X POST http://localhost:3000/api/admin/content/faqs \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<admin-auth-token>; csrf=$TOKEN" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"question":"Test?","answer":"Test answer"}'
```

**Expected Response:**
- Status: 200 or 201
- Body: Success response with created FAQ

## Browser Testing

### Using Browser DevTools

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to admin panel at http://localhost:3000/admin.html
4. Observe the following:

**On Page Load:**
- Request to `/api/csrf-token`
- Response sets `csrf` cookie
- Cookie visible in Application tab → Cookies

**On Admin Action (e.g., Create FAQ):**
- POST request to `/api/admin/content/faqs`
- Request headers include `X-CSRF-Token: <token>`
- Request cookies include `csrf=<token>`
- Both values should match

**On Logout:**
- POST request to `/api/auth/logout`
- Request includes both CSRF cookie and header
- Response clears auth cookie

### Testing Cross-Site Request Forgery Attack

To verify CSRF protection works, try to make a request from a different origin:

1. Create a malicious HTML file on a different domain (or file://)
2. Try to submit a form or fetch to the EventFlow API
3. The request will fail because:
   - Browser won't send the `csrf` cookie (SameSite=Lax)
   - Even if it did, attacker can't read the cookie to put in header (Same-Origin Policy)

**Example Malicious HTML:**
```html
<!DOCTYPE html>
<html>
<body>
<script>
// This will fail - no CSRF token
fetch('http://localhost:3000/api/admin/content/faqs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({question:'Evil?',answer:'Evil'})
});
</script>
</body>
</html>
```

**Result:**
- Request fails with 403 "CSRF token missing"
- Even if attacker had valid auth cookie, they can't get/set CSRF token

## Automated Testing

Run the integration tests:

```bash
npm test -- tests/integration/csrf-protection.test.js
```

All 25 tests should pass, verifying:
- Middleware implementation
- Cookie configuration
- Route protection
- Client-side integration

## Production Deployment Checklist

Before deploying to production (Railway):

- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (Railway provides this)
- [ ] `csrf` cookie has `Secure` flag (automatically set in production)
- [ ] `SameSite=Lax` allows cross-site navigation while blocking CSRF
- [ ] Test the admin panel and checkout flow in production
- [ ] Verify cookies are set correctly in browser DevTools
- [ ] Test logout functionality works correctly

## Troubleshooting

### "CSRF token missing" errors in development

**Cause**: Client not including CSRF token in request

**Solutions**:
- Check browser console for errors fetching CSRF token
- Verify `window.__CSRF_TOKEN__` is set in browser console
- Ensure `credentials: 'include'` in fetch requests
- Check if ad blocker is interfering

### "Invalid CSRF token" errors

**Cause**: Cookie and header values don't match

**Solutions**:
- Clear cookies and refresh page
- Check if multiple tabs/windows have different tokens
- Verify token isn't being modified in transit
- Check server logs for timing issues

### CSRF protection not working in production

**Cause**: Cookie not being sent due to configuration

**Solutions**:
- Verify HTTPS is enabled (required for Secure flag)
- Check `SameSite` attribute is set correctly
- Ensure domain configuration is correct
- Test with browser DevTools Network tab

## Security Notes

- CSRF protection is **disabled in test environment** (`NODE_ENV=test`) for easier testing
- Tokens are **valid for 24 hours** (cookie maxAge)
- No server-side token storage required (stateless)
- Protection works on **all state-changing routes** (POST/PUT/DELETE)
- GET requests are exempt (safe methods)
