# EventFlow Verification Guide

This document describes the email and phone verification flows implemented in EventFlow, including API endpoints, expected responses, and integration notes.

---

## Table of Contents

1. [Overview](#overview)
2. [Email Verification](#email-verification)
   - [Send Verification Email](#send-verification-email)
   - [Verify Email Token](#verify-email-token)
   - [Check Email Status](#check-email-status)
3. [Phone Verification](#phone-verification)
   - [Send Phone Code](#send-phone-code)
   - [Verify Phone Code](#verify-phone-code)
   - [Remove Phone Number](#remove-phone-number)
   - [Check Phone Status](#check-phone-status)
4. [Rate Limiting](#rate-limiting)
5. [Security Considerations](#security-considerations)
6. [Frontend Integration](#frontend-integration)

---

## Overview

EventFlow supports two verification channels:

| Channel   | Purpose                              | Token lifespan |
| --------- | ------------------------------------ | -------------- |
| **Email** | Confirm user email address ownership | 24 hours       |
| **Phone** | Confirm mobile number via SMS OTP    | 10 minutes     |

Both verification flows are **authenticated** — the user must be logged in before triggering a verification request. Verification status is stored on the `users` document and surfaced via API.

---

## Email Verification

### Send Verification Email

Triggers a verification email to the currently authenticated user's address. An existing, unexpired token is reused to prevent spam.

**Endpoint:** `POST /api/auth/send-verification`  
**Authentication:** Required  
**Rate limit:** Up to 5 requests per 15 minutes per IP

**Request body:** _(none)_

**Success response (200):**

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Error responses:**

- `400` — Email already verified
- `429` — Rate limit exceeded
- `500` — Failed to send email

---

### Verify Email Token

Confirms the user's email address by validating the token supplied in the verification link.

**Endpoint:** `GET /api/auth/verify-email/:token`  
**Authentication:** Not required (token is the credential)

**URL parameters:**

| Parameter | Type   | Description                                        |
| --------- | ------ | -------------------------------------------------- |
| `token`   | string | 64-character hex token from the verification email |

**Success response (200):**

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error responses:**

- `400` — Token missing, expired, or already used
- `404` — No user found for this token

---

### Check Email Status

Returns the current email verification status for the authenticated user.

**Endpoint:** `GET /api/auth/email-status`  
**Authentication:** Required

**Success response (200):**

```json
{
  "verified": true,
  "email": "user@example.com"
}
```

---

## Phone Verification

### Send Phone Code

Generates a 6-digit OTP and sends it via SMS to the provided phone number. Uses an in-memory or Redis store for the OTP with a 10-minute TTL.

**Endpoint:** `POST /api/me/phone/send-code`  
**Authentication:** Required  
**CSRF:** Protected  
**Rate limit:** Per user / IP (see Rate Limiting below)

**Request body:**

```json
{
  "phone": "+447700900000"
}
```

**Success response (200):**

```json
{
  "success": true,
  "message": "Verification code sent"
}
```

**Error responses:**

- `400` — Invalid phone number format or phone number already in use
- `429` — Rate limit exceeded
- `500` — SMS sending failed

---

### Verify Phone Code

Validates the OTP supplied by the user.

**Endpoint:** `POST /api/me/phone/verify-code`  
**Authentication:** Required  
**CSRF:** Protected

**Request body:**

```json
{
  "code": "123456"
}
```

**Success response (200):**

```json
{
  "success": true,
  "message": "Phone number verified"
}
```

**Error responses:**

- `400` — Code missing, incorrect, or expired

---

### Remove Phone Number

Removes a previously verified phone number from the user's account.

**Endpoint:** `DELETE /api/me/phone`  
**Authentication:** Required  
**CSRF:** Protected

**Success response (200):**

```json
{
  "success": true,
  "message": "Phone number removed"
}
```

---

### Check Phone Status

Returns the current phone verification status for the authenticated user.

**Endpoint:** `GET /api/me/phone/status`  
**Authentication:** Required

**Success response (200):**

```json
{
  "verified": true,
  "phone": "+447700900000"
}
```

---

## Rate Limiting

| Endpoint                           | Limit                         | Window            |
| ---------------------------------- | ----------------------------- | ----------------- |
| `POST /api/auth/send-verification` | 5 requests                    | 15 minutes per IP |
| `POST /api/me/phone/send-code`     | Configured via `writeLimiter` | Per IP            |

Rate-limit responses use HTTP status `429 Too Many Requests` with a `Retry-After` header.

---

## Security Considerations

1. **Token entropy** — Email verification tokens are 64-character hex strings generated via `crypto.randomBytes(32)`, giving 256 bits of entropy.
2. **OTP entropy** — Phone OTPs are 6-digit numbers with a short expiry (10 minutes) and are invalidated after a single successful use.
3. **CSRF protection** — All phone mutation endpoints (`POST`, `DELETE`) require a valid CSRF token via the `csrfProtection` middleware.
4. **Rate limiting** — Both flows apply rate limits to prevent enumeration and brute-force attacks.
5. **Token expiry** — Email tokens expire after 24 hours; phone OTPs after 10 minutes.
6. **No user enumeration** — Error responses do not reveal whether an email/phone is registered.

---

## Frontend Integration

The `/verify` page (`public/verify.html`) handles email verification by extracting the token from the URL query string and calling `GET /api/auth/verify-email/:token` automatically.

Phone verification UI is integrated into the account settings page. The flow is:

1. User enters their phone number and submits the form.
2. Frontend calls `POST /api/me/phone/send-code`.
3. User receives an SMS with a 6-digit code.
4. User enters the code; frontend calls `POST /api/me/phone/verify-code`.
5. On success, the verified badge appears next to the phone number.

---

_Last updated: March 2026_
