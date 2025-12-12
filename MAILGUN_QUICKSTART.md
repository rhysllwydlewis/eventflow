# Mailgun Email Implementation - Quick Start

This document provides a quick reference for the Mailgun email implementation in EventFlow.

## Quick Setup

### 1. Install Dependencies

Already included in package.json:
```bash
npm install
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Mailgun Configuration
MAILGUN_API_KEY=your-mailgun-api-key-here
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_BASE_URL=https://api.eu.mailgun.net  # EU region (default)
MAILGUN_FROM=no-reply@mg.yourdomain.com
APP_BASE_URL=http://localhost:3000

# Enable email sending
EMAIL_ENABLED=true
```

### 3. Get Mailgun Credentials

1. Sign up at https://www.mailgun.com
2. Get your API key from Settings → API Keys
3. Use sandbox domain for testing or set up custom domain
4. Add authorized recipients for sandbox testing

## Features Implemented

### ✅ Account Verification
- Automatic email on user registration
- 24-hour token expiration
- Branded HTML email template
- Token validation on verification

### ✅ User Preferences
- `notify_account` (transactional emails) - defaults to `true`
- `notify_marketing` (promotional emails) - defaults to `false`
- Preferences API endpoint: `PUT /api/auth/preferences`

### ✅ Unsubscribe
- No-authentication unsubscribe link in marketing emails
- Endpoint: `GET /api/auth/unsubscribe?email=user@example.com`
- Preserves transactional email preferences

### ✅ Email Templates
- `verification.html` - Account verification
- `notification.html` - Transactional notifications
- `marketing.html` - Marketing campaigns with unsubscribe
- `welcome.html` - Welcome emails
- `password-reset.html` - Password reset

## API Usage

### Send Verification Email

```javascript
const mailgun = require('./utils/mailgun');

await mailgun.sendVerificationEmail(user, verificationToken);
```

### Send Marketing Email (with preference check)

```javascript
const mailgun = require('./utils/mailgun');

const result = await mailgun.sendMarketingEmail(
  user,
  'Subject Line',
  'Email message content',
  {
    templateData: {
      ctaText: 'Click Here',
      ctaLink: 'https://example.com'
    }
  }
);

// Returns null if user opted out
```

### Send Transactional Notification

```javascript
const mailgun = require('./utils/mailgun');

await mailgun.sendNotificationEmail(
  user,
  'Subject Line',
  'Notification message'
);
```

### Send Custom Email

```javascript
const mailgun = require('./utils/mailgun');

await mailgun.sendMail({
  to: 'user@example.com',
  subject: 'Subject',
  template: 'welcome',
  templateData: { name: 'John' },
  tags: ['onboarding']
});
```

## Testing

### Development Mode (No Mailgun)

Without Mailgun configured:
- Emails saved to `/outbox` folder as `.eml` files
- Console logs show email details
- Perfect for local development

### Run Tests

```bash
# Test Mailgun utility
node test-mailgun.js

# Integration tests
node test-integration.js
```

### Manual Testing

```bash
# Start server
npm start

# Check health endpoint
curl http://localhost:3000/api/health

# Test registration (creates verification email)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test1234!",
    "marketingOptIn": true
  }'

# Check outbox for email
ls -la outbox/
```

## API Endpoints

### Authentication & Preferences

- `POST /api/auth/register` - Register user (sends verification email)
- `GET /api/auth/verify?token=TOKEN` - Verify email
- `GET /api/auth/me` - Get user with preferences
- `PUT /api/auth/preferences` - Update notification preferences
  ```json
  {
    "notify_account": true,
    "notify_marketing": false
  }
  ```
- `GET /api/auth/unsubscribe?email=EMAIL` - Unsubscribe from marketing

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAILGUN_API_KEY` | Yes* | - | Your Mailgun private API key |
| `MAILGUN_DOMAIN` | Yes* | - | Verified Mailgun domain |
| `MAILGUN_BASE_URL` | No | `https://api.eu.mailgun.net` | Mailgun API endpoint (EU/US) |
| `MAILGUN_FROM` | No | `FROM_EMAIL` | Sender email address |
| `APP_BASE_URL` | No | `BASE_URL` | App URL for email links |
| `EMAIL_ENABLED` | No | `false` (dev) | Enable/disable email sending |

*Required for production email sending

## User Model Changes

New fields added to user schema:

```javascript
{
  // New fields
  verificationTokenExpiresAt: String,  // ISO timestamp
  notify_account: Boolean,             // Transactional emails
  notify_marketing: Boolean,           // Marketing emails
  
  // Existing (deprecated but kept for backward compatibility)
  notify: Boolean,
  marketingOptIn: Boolean,
  verificationToken: String
}
```

## Production Checklist

- [ ] Sign up for Mailgun account
- [ ] Set up custom domain (or use sandbox for testing)
- [ ] Add DNS records for domain verification
- [ ] Get API key from Mailgun dashboard
- [ ] Set environment variables in production
- [ ] Test with authorized recipients (sandbox)
- [ ] Verify emails are being delivered
- [ ] Monitor Mailgun dashboard for delivery stats

## Troubleshooting

### Emails not sending

1. Check environment variables are set
2. Verify `EMAIL_ENABLED=true`
3. Check Mailgun dashboard for errors
4. Verify domain is active in Mailgun
5. For sandbox: add recipient to authorized list

### Wrong region errors

- EU users: Use `https://api.eu.mailgun.net`
- US users: Use `https://api.mailgun.net`

### Token expiration issues

- Tokens expire after 24 hours
- User must request new verification email
- Check `verificationTokenExpiresAt` field

## Documentation

- **Full Setup Guide**: `MAILGUN_SETUP.md`
- **Usage Examples**: `mailgun-examples.js`
- **API Documentation**: Check `/api-docs` when server is running

## Support

- Mailgun Documentation: https://documentation.mailgun.com/
- EventFlow Issues: https://github.com/rhysllwydlewis/eventflow/issues

## Security Notes

⚠️ **Never commit API keys to source control**
- All credentials via environment variables
- `.env` file in `.gitignore`
- Use Railway/Heroku env vars in production
- Rotate keys periodically

✅ **Security features implemented**
- Server-side only (no frontend exposure)
- Token expiration (24 hours)
- CSRF protection on auth endpoints
- Rate limiting on registration
- Secure cookie handling
