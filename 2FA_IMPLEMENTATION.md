# Two-Factor Authentication (2FA) Implementation Guide

## Overview
EventFlow supports Time-Based One-Time Password (TOTP) two-factor authentication for admin accounts.

## Implementation Status

### Current Features
- User schema ready for 2FA data
- Audit logging for 2FA events
- Admin-only 2FA requirement option

### Pending Features
- [ ] QR code generation for TOTP setup
- [ ] 2FA verification middleware
- [ ] Recovery codes generation
- [ ] Admin UI for 2FA management

## User Schema Extensions

The following fields are added to user objects for 2FA support:

```javascript
{
  // ... existing user fields ...
  
  // 2FA fields
  "twoFactorEnabled": false,
  "twoFactorSecret": null,        // TOTP secret (encrypted)
  "twoFactorRecoveryCodes": [],   // Array of backup codes (hashed)
  "twoFactorEnabledAt": null,     // ISO timestamp
  "lastTwoFactorVerified": null   // ISO timestamp
}
```

## Setup Flow (Planned)

### 1. Enable 2FA
```
User → Settings → Security → Enable 2FA
↓
Server generates TOTP secret
↓
Display QR code + manual entry key
↓
User scans with authenticator app
↓
User enters verification code
↓
Server validates and enables 2FA
↓
Generate and display recovery codes
```

### 2. Login with 2FA
```
User enters email + password
↓
Server validates credentials
↓
Redirect to 2FA verification page
↓
User enters TOTP code
↓
Server validates TOTP
↓
Issue JWT token and redirect to dashboard
```

## Recovery Codes

Each user gets 10 recovery codes:
- One-time use only
- Securely hashed (bcrypt)
- Displayed only once at generation
- Can be regenerated (invalidates previous codes)

## Admin Controls

### Require 2FA for Admins
```javascript
// In admin management endpoint
POST /api/admin/settings/require-2fa
{
  "required": true
}
```

### Reset User 2FA
```javascript
// For users locked out
POST /api/admin/users/:id/reset-2fa
{
  "reason": "User lost access to authenticator"
}
```

## Dependencies Required

```bash
npm install speakeasy qrcode
```

- `speakeasy`: TOTP secret generation and verification
- `qrcode`: QR code generation for easy setup

## Security Considerations

1. **Secret Storage**
   - Encrypt TOTP secrets at rest
   - Never transmit secrets in logs
   - Clear secrets on 2FA disable

2. **Rate Limiting**
   - Limit TOTP verification attempts
   - Implement exponential backoff
   - Lock account after repeated failures

3. **Recovery Codes**
   - Hash with bcrypt (same as passwords)
   - Mark as used immediately
   - Allow regeneration only after verification

4. **Audit Logging**
   - Log all 2FA events:
     - Enable/disable
     - Successful verifications
     - Failed attempts
     - Recovery code usage
     - Admin resets

## Implementation Priority

1. **Phase 1** (High Priority)
   - TOTP secret generation
   - QR code display
   - Verification endpoint
   - Recovery code generation

2. **Phase 2** (Medium Priority)
   - Admin 2FA requirement enforcement
   - Recovery code UI
   - Admin reset functionality

3. **Phase 3** (Low Priority)
   - Backup email codes
   - SMS verification (optional)
   - WebAuthn/FIDO2 support

## Testing Checklist

- [ ] Generate TOTP secret
- [ ] Display QR code correctly
- [ ] Verify TOTP codes (valid)
- [ ] Reject TOTP codes (invalid)
- [ ] Handle time drift (±30s window)
- [ ] Recovery code validation
- [ ] Recovery code one-time use
- [ ] 2FA disable flow
- [ ] Admin reset functionality
- [ ] Audit log entries

## Recommended Authenticator Apps

- Google Authenticator (iOS/Android)
- Microsoft Authenticator (iOS/Android)
- Authy (iOS/Android/Desktop)
- 1Password (cross-platform)

## User Documentation

### How to Enable 2FA

1. Navigate to Settings → Security
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with authenticator app
4. Enter verification code to confirm
5. Save recovery codes in secure location

### Using 2FA

1. Log in with email and password
2. Open authenticator app
3. Enter 6-digit code
4. Access granted

### Lost Access to Authenticator

1. Use a recovery code to log in
2. Disable and re-enable 2FA with new device
3. Contact admin if no recovery codes available

## Admin Notifications

When 2FA is required for admins, the system will:
- Notify admins via email
- Display banner on admin dashboard
- Provide 7-day grace period
- Lock admin features after deadline

## Future Enhancements

1. **Risk-Based Authentication**
   - Require 2FA only for suspicious logins
   - Trust known devices for 30 days
   - IP-based risk scoring

2. **Hardware Tokens**
   - YubiKey support
   - WebAuthn/FIDO2
   - Biometric authentication

3. **Account Recovery**
   - Verified email backup
   - SMS fallback (with warnings)
   - Admin-assisted recovery process

## Resources

- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [OWASP 2FA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [Google Authenticator Key URI Format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format)

## Notes

This is a planning document. Implementation will be done in a future update with proper testing and security review.
