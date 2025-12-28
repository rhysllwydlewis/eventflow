# JWT Token Security Guide

## Overview

EventFlow uses JWT (JSON Web Tokens) for email verification with HMAC-SHA256 signing to ensure cryptographic security. This document covers the token implementation, security considerations, and best practices.

## Token Architecture

### JWT Token Structure

Our verification tokens follow the JWT standard with three parts:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3IxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ0eXBlIjoiZW1haWxfdmVyaWZpY2F0aW9uIiwiaWF0IjoxNjg5ODgwMDAwLCJleHAiOjE2ODk5NjY0MDAsInZlciI6MX0.signature_here
```

Breaking down the structure:

#### 1. Header (Base64URL encoded)

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

- `alg`: Algorithm used for signing (HMAC-SHA256)
- `typ`: Token type (JWT)

#### 2. Payload (Base64URL encoded)

```json
{
  "sub": "usr123",
  "email": "test@example.com",
  "type": "email_verification",
  "iat": 1689880000,
  "exp": 1689966400,
  "ver": 1
}
```

- `sub`: Subject (user ID)
- `email`: User's email address (normalized to lowercase)
- `type`: Token type (email_verification or password_reset)
- `iat`: Issued at timestamp (Unix timestamp)
- `exp`: Expiration timestamp (Unix timestamp)
- `ver`: Token version for revocation capability

#### 3. Signature

```
HMAC-SHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  JWT_SECRET
)
```

## Security Features

### 1. Cryptographic Signing (HMAC-SHA256)

**Why it matters:**

- Prevents token tampering
- Ensures token authenticity
- Can't be forged without the secret key

**Implementation:**

```javascript
const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });
```

**Validation:**

```javascript
const decoded = jwt.verify(token, JWT_SECRET, {
  algorithms: ['HS256'],
});
```

### 2. Token Versioning

**Purpose:**

- Allows global token revocation
- Useful for security incidents
- No database lookup needed

**How it works:**

- Each token includes a `ver` field with the current version
- To revoke all tokens, increment `TOKEN_VERSION` in `utils/token.js`
- Old tokens become instantly invalid

**Example:**

```javascript
// Current token version
const TOKEN_VERSION = 1;

// To revoke all existing tokens:
const TOKEN_VERSION = 2; // Increment this
```

### 3. Expiration with Grace Period

**Default Expiration:**

- Tokens expire after 24 hours
- Configurable via `TOKEN_EXPIRY_HOURS` environment variable

**Grace Period:**

- 5-minute grace period after expiration
- Reduces support burden from "just missed it" cases
- Configurable via `TOKEN_GRACE_PERIOD_MINUTES` environment variable

**Implementation:**

```javascript
const validation = validateVerificationToken(token, {
  allowGracePeriod: true, // Enable grace period
});

if (validation.valid && validation.withinGracePeriod) {
  console.log('Token accepted within grace period');
}
```

### 4. Email Normalization

**Why it matters:**

- Prevents duplicate accounts with different casing
- Ensures consistent token validation
- Improves user experience

**Implementation:**

- All emails converted to lowercase before token generation
- Token validation uses case-insensitive comparison

```javascript
// Email is normalized during token generation
payload.email = user.email.toLowerCase();
```

### 5. Token Type Validation

**Purpose:**

- Prevents token reuse across different contexts
- Email verification tokens can't be used for password resets

**Types:**

- `email_verification`: For email verification
- `password_reset`: For password resets

**Validation:**

```javascript
const validation = validateVerificationToken(token, {
  expectedType: TOKEN_TYPES.EMAIL_VERIFICATION,
});
```

### 6. Secure Secret Management

**Requirements:**

- `JWT_SECRET` must be at least 32 characters
- Should be randomly generated
- Never commit secrets to version control
- Rotate secrets periodically

**Best Practices:**

```bash
# Generate a secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set in environment
export JWT_SECRET="your-secure-random-secret-here"
```

**Production Warning:**

- Application logs a critical warning if default secret is used in production
- Application should refuse to start without a proper secret

## Token Lifecycle

### 1. Token Generation

**When:**

- User registers a new account
- User requests verification email resend

**Process:**

```javascript
const token = generateVerificationToken(user, {
  expiresInHours: 24,
  type: TOKEN_TYPES.EMAIL_VERIFICATION,
});
```

**Storage:**

- Token is stored in user record for legacy compatibility
- Token is sent via email to user
- Token expiration timestamp is stored

### 2. Token Distribution

**Email Delivery:**

```
https://event-flow.co.uk/verify.html?token=<JWT_TOKEN>
```

**Security Considerations:**

- Links are sent over HTTPS only
- Emails are transactional (not marketing)
- Email service (Postmark) has delivery tracking

### 3. Token Validation

**Validation Steps:**

1. Extract token from request (query/body/headers)
2. Decode token structure
3. Verify signature with JWT_SECRET
4. Check token version matches current version
5. Check token type matches expected type
6. Verify expiration (with optional grace period)
7. Extract and return user information

**Error Codes:**

- `MISSING_TOKEN`: No token provided
- `INVALID_FORMAT`: Token is malformed
- `INVALID_SIGNATURE`: Token has been tampered with
- `TOKEN_EXPIRED`: Token has expired (beyond grace period)
- `TOKEN_REVOKED`: Token version doesn't match
- `WRONG_TOKEN_TYPE`: Token type mismatch
- `VALIDATION_ERROR`: Unexpected validation error

### 4. Token Consumption

**One-time use:**

- After successful verification, user's `verified` flag is set to `true`
- Token is deleted from user record
- User can log in

**Idempotent:**

- If token is used twice, second attempt returns "already verified"
- No error, graceful handling

### 5. Token Revocation

**Individual Revocation:**

- Delete token from user record
- User can request new token via resend

**Global Revocation:**

- Increment `TOKEN_VERSION` constant
- All existing tokens become invalid instantly
- Users must request new verification emails

## Security Best Practices

### For Developers

1. **Secret Management**
   - Use strong, randomly generated secrets
   - Never commit secrets to git
   - Rotate secrets periodically
   - Use different secrets for dev/staging/production

2. **Token Handling**
   - Never log full tokens
   - Mask sensitive data in logs
   - Use HTTPS for all token transmission
   - Validate tokens on every use

3. **Error Messages**
   - Don't leak information about valid tokens
   - Use generic messages for security-sensitive errors
   - Log detailed errors server-side only
   - Rate limit token validation attempts

4. **Testing**
   - Test token expiration
   - Test signature validation
   - Test version mismatch
   - Test replay attacks
   - Test tampering attempts

### For Operations

1. **Monitoring**
   - Monitor token validation failure rates
   - Alert on suspicious patterns
   - Track token usage metrics
   - Monitor secret rotation status

2. **Incident Response**
   - Know how to rotate secrets
   - Understand token revocation
   - Have rollback procedures
   - Document escalation paths

3. **Regular Audits**
   - Review token generation logs
   - Check for expired secrets
   - Verify HTTPS enforcement
   - Test disaster recovery

## Configuration Reference

### Environment Variables

```bash
# Required
JWT_SECRET=<64-char-random-string>

# Optional (with defaults)
TOKEN_EXPIRY_HOURS=24              # Token lifetime
TOKEN_GRACE_PERIOD_MINUTES=5       # Grace period after expiration
NODE_ENV=production                # Environment mode
```

### Token Configuration

**Location:** `utils/token.js`

```javascript
const TOKEN_VERSION = 1; // Increment to revoke all tokens
const TOKEN_EXPIRY_HOURS = 24; // Default expiration
const TOKEN_GRACE_PERIOD_MINUTES = 5; // Grace period
```

## Troubleshooting

### "Invalid or tampered token"

**Causes:**

- Token was manually edited
- Secret key mismatch (dev vs production)
- Token corrupted in transit

**Solutions:**

- Request new verification email
- Verify JWT_SECRET is correct
- Check for URL encoding issues

### "Token has been revoked"

**Causes:**

- `TOKEN_VERSION` was incremented
- Security incident caused global revocation

**Solutions:**

- Request new verification email
- Check for security announcements
- Verify application version

### "Token has expired"

**Causes:**

- Token is older than 24 hours + 5 minutes
- User didn't click link in time

**Solutions:**

- Request new verification email
- Check email delivery time
- Consider extending TOKEN_EXPIRY_HOURS if appropriate

### "Wrong token type"

**Causes:**

- Using verification token for password reset
- Application bug

**Solutions:**

- Use correct token for intended purpose
- Request appropriate token type
- Report bug if issue persists

## Advanced Topics

### Token Debugging

**Development Mode:**

```javascript
const debug = debugToken(token);
console.log(debug);
```

**Output:**

```json
{
  "isJWT": true,
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": "usr123",
    "email": "t***@example.com",
    "type": "email_verification",
    "ver": 1
  },
  "isExpired": false,
  "versionValid": true
}
```

### Custom Token Types

**Adding new token type:**

1. Add to TOKEN_TYPES constant:

```javascript
const TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_DELETION: 'account_deletion', // New type
};
```

2. Generate token with new type:

```javascript
const token = generateVerificationToken(user, {
  type: TOKEN_TYPES.ACCOUNT_DELETION,
  expiresInHours: 1, // Shorter expiry for sensitive operations
});
```

3. Validate with type check:

```javascript
const validation = validateVerificationToken(token, {
  expectedType: TOKEN_TYPES.ACCOUNT_DELETION,
});
```

### Secret Rotation

**Process:**

1. Generate new secret:

```bash
NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
```

2. Update environment variable:

```bash
export JWT_SECRET="$NEW_SECRET"
```

3. Restart application

4. Increment TOKEN_VERSION to invalidate old tokens:

```javascript
const TOKEN_VERSION = 2; // Was 1
```

5. Monitor for affected users

6. Communicate to users if necessary

**Frequency:** Rotate secrets at least annually, or immediately after security incidents.

## Security Checklist

- [ ] JWT_SECRET is strong and randomly generated
- [ ] JWT_SECRET is not committed to version control
- [ ] HTTPS is enforced for all token transmission
- [ ] Token validation has rate limiting
- [ ] Tokens are masked in logs
- [ ] Error messages don't leak token information
- [ ] Token expiration is appropriate for use case
- [ ] Grace period is configured appropriately
- [ ] Monitoring is in place for token failures
- [ ] Incident response plan includes token revocation
- [ ] Regular security audits are scheduled
- [ ] Backup secrets are stored securely
- [ ] Token versioning is understood by team
- [ ] Documentation is up to date

## Resources

- **JWT Specification:** https://tools.ietf.org/html/rfc7519
- **HMAC-SHA256:** https://tools.ietf.org/html/rfc2104
- **OWASP JWT Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
- **JWT.io Debugger:** https://jwt.io/ (Use only with test tokens!)

## Support

For security issues, please contact:

- Email: security@event-flow.co.uk
- Create issue: https://github.com/rhysllwydlewis/eventflow/issues

For general questions:

- Documentation: `/docs`
- Email: support@event-flow.co.uk
