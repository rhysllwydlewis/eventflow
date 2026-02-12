# Two-Factor Authentication (2FA) Implementation Guide

## Overview

EventFlow implements TOTP-based Two-Factor Authentication using the `speakeasy` library. This provides an additional security layer beyond passwords for user accounts.

## Architecture

### Components

1. **Backend API** (`routes/twoFactor.js`)
   - Setup endpoint: Generate QR code and backup codes
   - Verify endpoint: Enable 2FA after verification
   - Disable endpoint: Turn off 2FA (requires token or backup code)
   - Status endpoint: Check current 2FA status

2. **Encryption** (`utils/encryption.js`)
   - AES-256-GCM encryption for 2FA secrets
   - SHA-256 hashing for backup codes
   - Secure token generation

3. **Login Flow** (`routes/auth.js`)
   - Standard login checks for 2FA status
   - If enabled, returns temporary token (2-minute expiry)
   - Separate endpoint for 2FA completion

4. **Database Schema** (`models/index.js`)
   - `twoFactorEnabled`: boolean
   - `twoFactorSecret`: string (encrypted)
   - `twoFactorBackupCodes`: string[] (hashed)

## API Endpoints

### 1. Setup 2FA

**Endpoint:** `POST /api/me/2fa/setup`

**Authentication:** Required (JWT cookie)

**Rate Limiting:** writeLimiter

**CSRF Protection:** Required

**Request:**

```http
POST /api/me/2fa/setup
Cookie: auth=<jwt-token>
X-CSRF-Token: <csrf-token>
```

**Response:**

```json
{
  "ok": true,
  "qrCode": "data:image/png;base64,iVBORw0KG...",
  "backupCodes": [
    "ABCD1234",
    "EFGH5678",
    "IJKL9012",
    "MNOP3456",
    "QRST7890",
    "UVWX1234",
    "YZAB5678",
    "CDEF9012",
    "GHIJ3456",
    "KLMN7890"
  ],
  "message": "Scan the QR code with your authenticator app, then verify to enable 2FA"
}
```

**Notes:**

- QR code contains the TOTP secret for authenticator apps
- Backup codes are for emergency access (one-time use)
- 2FA is NOT enabled until verified
- Save backup codes securely - they won't be shown again

### 2. Verify and Enable 2FA

**Endpoint:** `POST /api/me/2fa/verify`

**Authentication:** Required

**Rate Limiting:** writeLimiter

**CSRF Protection:** Required

**Request:**

```json
{
  "token": "123456"
}
```

**Response:**

```json
{
  "ok": true,
  "message": "2FA has been enabled successfully"
}
```

**Notes:**

- Verifies the TOTP token from authenticator app
- Window of ±2 time steps allowed for clock skew
- Sets `twoFactorEnabled: true` in database

### 3. Disable 2FA

**Endpoint:** `POST /api/me/2fa/disable`

**Authentication:** Required

**Rate Limiting:** writeLimiter

**CSRF Protection:** Required

**Request:**

```json
{
  "token": "123456"
}
```

OR

```json
{
  "backupCode": "ABCD1234"
}
```

**Response:**

```json
{
  "ok": true,
  "message": "2FA has been disabled"
}
```

**Notes:**

- Requires either current TOTP token OR a backup code
- Removes all 2FA data from database
- User must set up 2FA again if they want to re-enable

### 4. Check 2FA Status

**Endpoint:** `GET /api/me/2fa/status`

**Authentication:** Required

**Response:**

```json
{
  "ok": true,
  "enabled": true,
  "hasBackupCodes": true
}
```

## Login Flow with 2FA

### Standard Login (2FA Enabled)

**Step 1:** Initial login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "remember": true
}
```

**Response (2FA Required):**

```json
{
  "ok": false,
  "requires2FA": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Please enter your 2FA code"
}
```

**Step 2:** Complete login with 2FA

```http
POST /api/auth/login-2fa
Content-Type: application/json

{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token": "123456",
  "remember": true
}
```

OR with backup code:

```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "backupCode": "ABCD1234",
  "remember": true
}
```

**Response (Success):**

```json
{
  "ok": true,
  "user": {
    "id": "usr_123",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "customer"
  }
}
```

**Notes:**

- Temporary token expires in 2 minutes
- Backup codes are single-use (removed after successful login)
- Failed 2FA attempts are logged

## Security Features

### Encryption

- **Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **IV:** Randomized per encryption operation
- **Format:** `iv:tag:encrypted`

### Backup Codes

- **Hashing:** SHA-256
- **Format:** 8-character uppercase hexadecimal
- **Count:** 10 codes generated
- **Usage:** One-time use, removed after verification

### Rate Limiting

- All POST endpoints protected with `writeLimiter`
- Prevents brute-force attacks
- Default: 30 requests per 15 minutes

### CSRF Protection

- Double-Submit Cookie pattern
- Required for all state-changing operations
- Token must match cookie value

## Environment Variables

```env
# Encryption key for 2FA secrets
# If not set, falls back to JWT_SECRET
ENCRYPTION_KEY=your_encryption_key_here

# JWT secret (required)
JWT_SECRET=your_jwt_secret_here
```

**Generate secure keys:**

```bash
openssl rand -base64 32
```

## Frontend Integration

### Setup Flow (Pseudocode)

```javascript
// 1. User clicks "Enable 2FA"
async function enable2FA() {
  const response = await fetch('/api/me/2fa/setup', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': getCsrfToken(),
    },
    credentials: 'include',
  });

  const data = await response.json();

  // 2. Display QR code
  document.getElementById('qr-code').src = data.qrCode;

  // 3. Display backup codes (IMPORTANT: User must save these)
  displayBackupCodes(data.backupCodes);

  // 4. Show verification input
  showVerificationInput();
}

// 5. User enters code from authenticator app
async function verify2FA(token) {
  const response = await fetch('/api/me/2fa/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  if (response.ok) {
    alert('2FA enabled successfully!');
  }
}
```

### Login Flow (Pseudocode)

```javascript
async function login(email, password, remember) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, remember }),
  });

  const data = await response.json();

  if (data.requires2FA) {
    // Show 2FA input
    show2FAInput(data.tempToken);
  } else if (data.ok) {
    // Login successful
    redirectToDashboard();
  }
}

async function complete2FA(tempToken, token) {
  const response = await fetch('/api/auth/login-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tempToken, token }),
  });

  const data = await response.json();

  if (data.ok) {
    redirectToDashboard();
  }
}
```

## Authenticator Apps

Compatible with any TOTP-based authenticator app:

- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Bitwarden
- LastPass Authenticator

## Testing

### Integration Tests

Run the test suite:

```bash
npm test -- tests/integration/security-features.test.js
```

Tests cover:

- Encryption/decryption
- TOTP token generation and verification
- Backup code generation and hashing
- Token expiry
- 2FA secret encryption flow

### Manual Testing

1. **Setup:**

   ```bash
   # Create test user
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'
   ```

2. **Enable 2FA:**

   ```bash
   # Get QR code (requires authentication)
   curl -X POST http://localhost:3000/api/me/2fa/setup \
     -H "Cookie: auth=<jwt-token>" \
     -H "X-CSRF-Token: <csrf-token>"
   ```

3. **Scan QR code with authenticator app**

4. **Verify:**

   ```bash
   curl -X POST http://localhost:3000/api/me/2fa/verify \
     -H "Cookie: auth=<jwt-token>" \
     -H "X-CSRF-Token: <csrf-token>" \
     -H "Content-Type: application/json" \
     -d '{"token":"123456"}'
   ```

5. **Test login with 2FA:**

   ```bash
   # Initial login
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'

   # Complete with 2FA
   curl -X POST http://localhost:3000/api/auth/login-2fa \
     -H "Content-Type: application/json" \
     -d '{"tempToken":"<temp-token>","token":"123456"}'
   ```

## Troubleshooting

### "Invalid token" errors

**Cause:** Time synchronization issues

**Solution:**

- Ensure server time is accurate (use NTP)
- Check authenticator app time sync
- Window of ±2 time steps is allowed

### Backup codes not working

**Cause:** Code already used or incorrect format

**Solution:**

- Backup codes are single-use
- Must be uppercase hexadecimal
- Case-sensitive: `ABCD1234` not `abcd1234`

### Lost backup codes

**Solution:**

- User must disable 2FA using account recovery
- Or provide valid TOTP token to disable
- Re-setup 2FA to generate new backup codes

### Encryption errors in production

**Cause:** Missing or invalid ENCRYPTION_KEY

**Solution:**

- Set ENCRYPTION_KEY environment variable
- Generate with: `openssl rand -base64 32`
- Ensure it's at least 32 characters

## Best Practices

### For Users

1. Save backup codes securely (password manager, printed copy)
2. Use a reputable authenticator app
3. Enable 2FA on important accounts
4. Don't share TOTP secrets or QR codes

### For Developers

1. Never log or expose TOTP secrets
2. Always encrypt secrets before database storage
3. Hash backup codes (never store plaintext)
4. Implement rate limiting on all endpoints
5. Use CSRF protection on state-changing operations
6. Set reasonable token expiry times
7. Log failed 2FA attempts for security monitoring

## Security Considerations

### Threat Model

- **Protects against:** Password theft, credential stuffing, phishing
- **Does not protect against:** Device compromise, social engineering for backup codes

### Attack Vectors

1. **Brute force:** Mitigated by rate limiting
2. **Time-based attacks:** Window of ±2 steps limits exposure
3. **Backup code theft:** Hashed in database, single-use
4. **TOTP secret theft:** Encrypted with AES-256-GCM

### Compliance

- Compatible with security best practices
- Suitable for GDPR, SOC 2, ISO 27001
- Implements NIST SP 800-63B guidelines

## Future Enhancements

Potential improvements:

- [ ] WebAuthn/FIDO2 support
- [ ] SMS-based 2FA (less secure, but more accessible)
- [ ] Trusted device management
- [ ] 2FA recovery codes refresh
- [ ] Admin-enforced 2FA for specific roles
- [ ] 2FA usage analytics and reporting

## References

- [RFC 6238: TOTP](https://tools.ietf.org/html/rfc6238)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Speakeasy Documentation](https://github.com/speakeasyjs/speakeasy)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
