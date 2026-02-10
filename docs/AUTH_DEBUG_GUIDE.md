# Authentication Debugging Guide

This guide provides comprehensive instructions for diagnosing and fixing authentication issues in EventFlow.

## Overview

The emergency authentication debugging system provides admin-only endpoints to diagnose and fix common login, password reset, and account management issues. All endpoints require admin authentication and are protected with CSRF tokens where applicable.

## Quick Fixes

### Users Can't Log In

**Symptoms:**

- User receives "Invalid email or password" error (401)
- User has correct credentials but can't log in
- Login fails with password comparison error

**Diagnosis Steps:**

1. **Test login without actual authentication:**

   ```bash
   POST /api/v1/admin/debug/login-test
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "TheirPassword123"
   }
   ```

   **Response Example:**

   ```json
   {
     "email": "user@example.com",
     "found": true,
     "verified": true,
     "hasPasswordHash": true,
     "hashValid": true,
     "passwordMatches": false,
     "canLogin": false,
     "issues": ["❌ Password does not match"]
   }
   ```

2. **Inspect user record:**

   ```bash
   GET /api/v1/admin/debug/user?email=user@example.com
   ```

   **Response Example:**

   ```json
   {
     "debug_info": {
       "id": "usr_abc123",
       "email": "user@example.com",
       "name": "John Doe",
       "verified": true,
       "role": "customer",
       "hasPasswordHash": true,
       "passwordHashLength": 60,
       "passwordHashValid": true,
       "hasResetToken": false
     },
     "diagnostics": {
       "readyToLogin": true,
       "issues": []
     }
   }
   ```

**Common Issues & Solutions:**

#### Issue 1: No Password Hash

**Symptoms:**

```json
{
  "hasPasswordHash": false,
  "issues": ["❌ No password hash found"]
}
```

**Fix:**

```bash
POST /api/v1/admin/debug/fix-password
Content-Type: application/json
X-CSRF-Token: <csrf-token>

{
  "email": "user@example.com",
  "newPassword": "NewTemporaryPassword123"
}
```

**Response:**

```json
{
  "ok": true,
  "message": "Password updated for user@example.com. User can now log in.",
  "email": "user@example.com",
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Issue 2: Invalid Bcrypt Hash

**Symptoms:**

```json
{
  "passwordHashValid": false,
  "issues": ["❌ Invalid bcrypt hash format"]
}
```

**Fix:** Use the same `/debug/fix-password` endpoint to reset the hash.

#### Issue 3: Email Not Verified

**Symptoms:**

```json
{
  "verified": false,
  "issues": ["❌ Email not verified"]
}
```

**Fix:**

```bash
POST /api/v1/admin/debug/verify-user
Content-Type: application/json
X-CSRF-Token: <csrf-token>

{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "ok": true,
  "message": "User user@example.com is now verified",
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "verified": true
  }
}
```

---

### Password Reset Not Working

**Symptoms:**

- User doesn't receive password reset email
- Reset link says "expired" or "invalid"
- Password reset flow fails silently

**Diagnosis Steps:**

1. **Test email system:**

   ```bash
   POST /api/v1/admin/debug/test-email
   Content-Type: application/json
   X-CSRF-Token: <csrf-token>

   {
     "email": "user@example.com"
   }
   ```

   **Response Example:**

   ```json
   {
     "ok": true,
     "message": "Test email sent to user@example.com",
     "testToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

2. **Check server logs for password reset flow:**
   Look for these log entries:

   ```
   [PASSWORD RESET] Request for email: user@example.com
   [PASSWORD RESET] Found user: user@example.com, verified: true
   [PASSWORD RESET] Generated token for user@example.com
   [PASSWORD RESET] Sending email to user@example.com...
   [PASSWORD RESET] ✅ Email sent successfully to user@example.com
   ```

3. **Check user audit log:**
   Look in the `audit_logs` collection for password reset entries.

**Common Issues & Solutions:**

#### Issue 1: Postmark Not Configured

**Symptoms:**

- Emails saved to `/outbox` folder instead of being sent
- Log message: "⚠️ Postmark not configured"

**Fix:**

1. Set `POSTMARK_API_KEY` in `.env` file
2. Set `POSTMARK_FROM` to a verified sender email
3. Restart the server

#### Issue 2: Invalid Email Template

**Symptoms:**

- Error: "Failed to load email template: password-reset"

**Fix:**
Ensure `/email-templates/password-reset.html` exists and is readable.

#### Issue 3: Token Expired

**Symptoms:**

- User clicks reset link and sees "expired" error
- Tokens expire after 1 hour by default

**Fix:**
User needs to request a new password reset link via `/api/v1/auth/forgot`.

---

### Database-Wide User Audit

**Purpose:** Identify all users with authentication issues across the entire database.

**Usage:**

```bash
POST /api/v1/admin/debug/audit-users
Content-Type: application/json
X-CSRF-Token: <csrf-token>
```

**Response Example:**

```json
{
  "totalUsers": 150,
  "issues": {
    "noPasswordHash": [
      { "id": "usr_abc123", "email": "user1@example.com" },
      { "id": "usr_def456", "email": "user2@example.com" }
    ],
    "invalidBcryptHash": [],
    "notVerified": [{ "id": "usr_ghi789", "email": "user3@example.com" }],
    "noEmail": []
  },
  "summary": {
    "usersWithoutPassword": 2,
    "usersWithInvalidHash": 0,
    "unverifiedUsers": 1,
    "usersWithoutEmail": 0
  }
}
```

**Interpretation:**

- `noPasswordHash`: Users who can't log in (no password set)
- `invalidBcryptHash`: Users with corrupted password hashes
- `notVerified`: Users who haven't verified their email
- `noEmail`: Users with missing email addresses (data corruption)

**Bulk Fixes:**
For users with issues, use the individual fix endpoints:

1. `/debug/fix-password` for password hash issues
2. `/debug/verify-user` for verification issues

---

## Endpoint Reference

### GET /api/v1/admin/debug/user

**Purpose:** Inspect user record for debugging.

**Authentication:** Requires admin role.

**Query Parameters:**

- `email` (required): User's email address

**Response Fields:**

- `debug_info`: User metadata and diagnostics
- `diagnostics.readyToLogin`: Boolean indicating if user can log in
- `diagnostics.issues`: Array of issues preventing login

---

### POST /api/v1/admin/debug/fix-password

**Purpose:** Manually set a user's password (emergency recovery).

**Authentication:** Requires admin role + CSRF token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "newPassword": "NewPassword123"
}
```

**Validation:**

- Password must be at least 8 characters
- Email must exist in database

**Audit Log:** Creates audit log entry with action `fix_password`.

---

### POST /api/v1/admin/debug/verify-user

**Purpose:** Manually verify user's email address.

**Authentication:** Requires admin role + CSRF token.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Side Effects:**

- Sets `verified: true`
- Removes `verificationToken` and `verificationTokenExpiresAt`

**Audit Log:** Creates audit log entry with action `verify_user`.

---

### POST /api/v1/admin/debug/test-email

**Purpose:** Test email sending and verify Postmark is working.

**Authentication:** Requires admin role + CSRF token.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**What it does:**

1. Generates a test verification token
2. Sends verification email via Postmark
3. Returns token for manual verification

**Use Cases:**

- Verify Postmark configuration
- Test email template rendering
- Debug email delivery issues

**Audit Log:** Creates audit log entry with action `test_email`.

---

### POST /api/v1/admin/debug/login-test

**Purpose:** Test login without actually logging in (diagnostics only).

**Authentication:** Requires admin role.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "UserPassword123"
}
```

**Response:**

```json
{
  "email": "user@example.com",
  "found": true,
  "verified": true,
  "hasPasswordHash": true,
  "hashValid": true,
  "passwordMatches": true,
  "canLogin": true,
  "issues": []
}
```

**Note:** This endpoint requires admin authentication to prevent credential enumeration attacks.

---

### POST /api/v1/admin/debug/audit-users

**Purpose:** Audit all users and identify issues.

**Authentication:** Requires admin role + CSRF token.

**Response:** See "Database-Wide User Audit" section above.

**Audit Log:** Creates audit log entry with action `audit_users`.

---

## Enhanced Auth Endpoints

The following existing auth endpoints have been enhanced with comprehensive logging:

### POST /api/v1/auth/login

**Enhanced Logging:**

```
[LOGIN] Attempt for email: user@example.com
[LOGIN] Found user: user@example.com, verified: true, hasHash: true
[LOGIN] Password match: true
[LOGIN] ✅ Successful login for: user@example.com
```

**Error Handling:**

- Logs missing password hash
- Logs password comparison errors
- Logs verification status

---

### POST /api/v1/auth/forgot

**Enhanced Features:**

- Uses JWT tokens instead of random tokens
- Comprehensive logging at each step
- Creates audit log entries
- Better error messages

**Logging:**

```
[PASSWORD RESET] Request for email: user@example.com
[PASSWORD RESET] Found user: user@example.com, verified: true
[PASSWORD RESET] Generated token for user@example.com
[PASSWORD RESET] Token saved for user@example.com, expires: 2024-...
[PASSWORD RESET] Sending email to user@example.com...
[PASSWORD RESET] ✅ Email sent successfully to user@example.com
```

---

### POST /api/v1/auth/reset-password

**Enhanced Features:**

- Supports both JWT and legacy tokens
- Sends password reset confirmation email
- Comprehensive logging
- Creates audit log entries

**Logging:**

```
[PASSWORD RESET VERIFY] Request with token: eyJhbGciOiJIUzI1NiI...
[PASSWORD RESET VERIFY] Checking if JWT token...
[PASSWORD RESET VERIFY] Valid JWT token for: user@example.com
[PASSWORD RESET VERIFY] Resetting password for: user@example.com
[PASSWORD RESET VERIFY] ✅ Password updated for: user@example.com
[PASSWORD RESET VERIFY] Confirmation email sent to: user@example.com
```

---

## Security Considerations

### Admin-Only Access

All debug endpoints (except `/login-test`) require:

1. Valid admin authentication (JWT cookie)
2. Admin role verification
3. CSRF token (for POST requests)

### Audit Logging

All admin actions are logged to the `audit_logs` collection with:

- Admin ID and email
- Action type
- Target user
- Timestamp
- IP address and user agent

### Rate Limiting

Auth endpoints are protected by rate limiting:

- Login: 10 requests per 15 minutes
- Password reset: 10 requests per 15 minutes

### Password Security

- All passwords are hashed with bcrypt (10 rounds)
- Minimum 8 characters required
- Password reset tokens expire after 1 hour
- JWT tokens use HS256 algorithm

---

## Troubleshooting

### Issue: "CSRF token missing or invalid"

**Cause:** POST request doesn't include CSRF token.

**Fix:**

1. Get CSRF token from `/api/v1/csrf-token`
2. Include in `X-CSRF-Token` header

### Issue: "Unauthenticated" (401)

**Cause:** Admin not logged in or JWT expired.

**Fix:**

1. Log in as admin via `/api/v1/auth/login`
2. Ensure `token` cookie is set

### Issue: "Forbidden" (403)

**Cause:** User is authenticated but not an admin.

**Fix:**
Ensure the logged-in user has `role: "admin"` in their user record.

### Issue: Email test fails with "Postmark send error"

**Causes:**

1. Invalid Postmark API key
2. Unverified sender email
3. Network connectivity issues

**Fix:**

1. Verify `POSTMARK_API_KEY` in `.env`
2. Ensure `POSTMARK_FROM` is verified in Postmark dashboard
3. Check server internet connectivity

---

## Best Practices

### 1. Use Login Test First

Before making changes, always use `/debug/login-test` to understand the exact issue.

### 2. Check Audit Logs

Review audit logs regularly to track:

- Password reset requests
- Admin interventions
- Failed login attempts

### 3. Communicate with Users

After fixing a user's account:

1. Inform them their password has been reset
2. Provide the temporary password securely
3. Ask them to change it immediately

### 4. Monitor Email Delivery

Regularly test email delivery with `/debug/test-email` to ensure Postmark is working.

### 5. Document Interventions

When manually fixing user accounts, document:

- Date and time
- Reason for intervention
- Actions taken
- User notification method

---

## Support

For additional help:

- Check server logs in `/logs` directory
- Review audit logs in `audit_logs` collection
- Check Postmark dashboard for email delivery status
- Contact development team with specific error messages

---

## Changelog

### Version 1.0 (February 2024)

Initial release with:

- 6 debug endpoints
- Enhanced auth logging
- JWT-based password reset tokens
- Password reset confirmation emails
- Comprehensive documentation
