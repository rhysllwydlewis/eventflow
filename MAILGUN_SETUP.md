# Mailgun Email Setup Guide

This guide explains how to set up Mailgun for email sending in EventFlow, including account verification and notification preferences.

## Table of Contents

1. [Overview](#overview)
2. [Mailgun Configuration](#mailgun-configuration)
3. [Environment Variables](#environment-variables)
4. [Email Features](#email-features)
5. [Usage Examples](#usage-examples)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Overview

EventFlow uses Mailgun for secure, server-side email delivery. Mailgun provides:

- **Transactional emails**: Account verification, password resets
- **Marketing emails**: Promotional content with unsubscribe support
- **Email tracking**: Delivery status, open rates, click tracking
- **Reliable delivery**: Industry-leading deliverability rates

### Key Features Implemented

✅ Server-side Mailgun client (API key never exposed to frontend)  
✅ Environment-configured credentials (MAILGUN_API_KEY, MAILGUN_DOMAIN, etc.)  
✅ Reusable mail utility for templated emails (text and HTML)  
✅ Account verification flow with 24-hour token expiration  
✅ Notification preferences (transactional vs. marketing)  
✅ Unsubscribe functionality for marketing emails  
✅ Email templates with consistent branding  

## Mailgun Configuration

### Step 1: Create Mailgun Account

1. Sign up at [https://www.mailgun.com](https://www.mailgun.com)
2. Choose the appropriate region:
   - **EU**: For European users (GDPR compliant)
   - **US**: For US/global users
3. Complete email verification

### Step 2: Get Your Credentials

#### API Key
1. Go to **Settings** → **API Keys**
2. Copy your **Private API key**
3. Keep this secret and never commit to source control

#### Domain
You have two options:

**Option A: Sandbox Domain (Testing)**
- Free, pre-configured domain for testing
- Limited to authorized recipients only
- Format: `sandboxXXXXXXXX.mailgun.org`
- Find it in: **Sending** → **Domains**

**Option B: Custom Domain (Production)**
1. Go to **Sending** → **Domains** → **Add New Domain**
2. Enter your domain (e.g., `mg.yourdomain.com`)
3. Add DNS records to your domain:
   - **TXT** record for domain verification
   - **MX** records for receiving
   - **CNAME** records for tracking
4. Wait for DNS propagation (can take up to 48 hours)
5. Verify domain status shows "Active"

### Step 3: Configure Sender Email

For sandbox domains:
1. Go to **Sending** → **Domains** → Select your domain
2. Add **Authorized Recipients** under the domain settings
3. Recipients must verify their email before receiving test emails

For custom domains:
- Any email address from your verified domain can be used
- Example: `no-reply@mg.yourdomain.com`

## Environment Variables

Add these variables to your `.env` file:

```bash
# ============================================
# MAILGUN CONFIGURATION
# ============================================

# Your Mailgun API key (required)
MAILGUN_API_KEY=pubkey-2821845c6a90a3ec96a734687de541f6

# Your verified Mailgun domain (required)
MAILGUN_DOMAIN=mg.yourdomain.com
# OR for testing:
# MAILGUN_DOMAIN=sandboxXXXXXXXX.mailgun.org

# Mailgun API base URL (defaults to EU region)
# EU region (default): https://api.eu.mailgun.net
# US region: https://api.mailgun.net
MAILGUN_BASE_URL=https://api.eu.mailgun.net

# Sender email address (must be from verified domain)
MAILGUN_FROM=no-reply@mg.yourdomain.com

# Application base URL (for email links)
APP_BASE_URL=http://localhost:3000
# Production example:
# APP_BASE_URL=https://your-app.railway.app

# Enable email sending (optional, defaults based on NODE_ENV)
EMAIL_ENABLED=true
```

### Important Notes

⚠️ **Never commit these values to source control**
- Add `.env` to `.gitignore` (already done in this repo)
- Use environment variables in production (Railway, Heroku, etc.)

⚠️ **Region Selection**
- EU users should use `https://api.eu.mailgun.net`
- US users should use `https://api.mailgun.net`
- Using wrong region will cause authentication errors

## Email Features

### 1. Account Verification

When users register, they receive a verification email with:
- 24-hour expiration token
- Branded HTML email template
- Fallback plain text version
- Secure verification link

**Implementation**: Automatic on user registration

### 2. Notification Preferences

Users can control two types of emails:

**`notify_account` (Transactional)**
- Default: `true`
- Account notifications, security alerts, password resets
- Cannot be completely disabled (security requirement)

**`notify_marketing` (Marketing)**
- Default: `false` (requires opt-in)
- Promotional emails, newsletters, feature announcements
- Can be disabled via account settings or unsubscribe link

### 3. Unsubscribe Functionality

Marketing emails include an unsubscribe link:
- Works without authentication (email parameter only)
- Sets `notify_marketing: false`
- Returns friendly confirmation message
- Preserves transactional email preferences

## Usage Examples

### Send Verification Email

```javascript
const mailgun = require('./utils/mailgun');

// During user registration
const user = {
  email: 'user@example.com',
  name: 'John Doe'
};
const verificationToken = 'abc123...';

await mailgun.sendVerificationEmail(user, verificationToken);
```

### Send Marketing Email

```javascript
const mailgun = require('./utils/mailgun');

// Get user from database
const user = {
  email: 'user@example.com',
  name: 'John Doe',
  notify_marketing: true // Must be true to send
};

// Send marketing email with preference check
const result = await mailgun.sendMarketingEmail(
  user,
  'New Features Available!',
  'Check out our latest features to make your event planning even easier.',
  {
    templateData: {
      ctaText: 'View Features',
      ctaLink: 'https://yourdomain.com/features'
    }
  }
);

// Returns null if user opted out
if (!result) {
  console.log('User has opted out of marketing emails');
}
```

### Send Notification Email

```javascript
const mailgun = require('./utils/mailgun');

// Send transactional notification
const user = {
  email: 'user@example.com',
  name: 'John Doe',
  notify_account: true
};

await mailgun.sendNotificationEmail(
  user,
  'Your booking is confirmed',
  'Your booking for the venue has been confirmed for June 15, 2024.'
);
```

### Send Custom Email

```javascript
const mailgun = require('./utils/mailgun');

// Send custom email with template
await mailgun.sendMail({
  to: 'user@example.com',
  subject: 'Welcome to EventFlow',
  template: 'welcome', // Uses email-templates/welcome.html
  templateData: {
    name: 'John Doe',
    loginLink: 'https://yourdomain.com/login'
  },
  tags: ['onboarding', 'transactional']
});

// Send simple text email
await mailgun.sendMail({
  to: 'user@example.com',
  subject: 'Quick notification',
  text: 'This is a plain text email message.'
});

// Send HTML email
await mailgun.sendMail({
  to: 'user@example.com',
  subject: 'Rich content',
  html: '<h1>Hello</h1><p>This is an HTML email.</p>',
  text: 'Hello\n\nThis is an HTML email.' // Fallback
});
```

## Testing

### Development Mode (No Mailgun Configured)

When Mailgun is not configured:
1. Emails are saved to `/outbox` folder as `.eml` files
2. Console logs show what would have been sent
3. No actual emails are delivered
4. Perfect for local development

### Testing with Sandbox Domain

1. Set up sandbox domain in Mailgun
2. Add test recipients as authorized recipients
3. Configure environment variables
4. Test registration flow
5. Check recipient inbox

### Verification Testing

```bash
# Test user registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test1234!",
    "role": "customer"
  }'

# Check outbox folder or recipient inbox
ls -la outbox/

# Test verification (replace TOKEN with actual token from email)
curl http://localhost:3000/api/auth/verify?token=TOKEN
```

### Preference Testing

```bash
# Get current preferences (requires authentication)
curl http://localhost:3000/api/auth/me \
  -H "Cookie: token=YOUR_JWT_TOKEN"

# Update preferences
curl -X PUT http://localhost:3000/api/auth/preferences \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{
    "notify_account": true,
    "notify_marketing": false
  }'

# Test unsubscribe (no auth required)
curl "http://localhost:3000/api/auth/unsubscribe?email=test@example.com"
```

## Troubleshooting

### Email Not Sending

**Check configuration:**
```javascript
const mailgun = require('./utils/mailgun');
console.log(mailgun.getMailgunStatus());
// Should show: { enabled: true, domain: '...', ... }
```

**Common issues:**
- Missing MAILGUN_API_KEY or MAILGUN_DOMAIN
- Wrong API base URL for your region
- Sandbox domain without authorized recipients
- DNS not propagated for custom domain

### Authentication Errors

```
Error: Forbidden
```

**Solutions:**
- Verify API key is correct (no extra spaces)
- Check you're using the **Private API key**, not Public
- Ensure base URL matches your account region
- Confirm domain ownership in Mailgun dashboard

### Domain Not Verified

```
Error: Domain not found
```

**Solutions:**
- Wait for DNS propagation (up to 48 hours)
- Verify all DNS records are added correctly
- Check domain status in Mailgun dashboard
- For testing, use sandbox domain instead

### Emails Going to Spam

**Best practices:**
- Use custom domain instead of sandbox
- Set up proper SPF, DKIM, DMARC records
- Avoid spam trigger words in subject/content
- Include unsubscribe link in marketing emails
- Maintain good sender reputation

### Token Expiration Issues

```
Error: Verification token has expired
```

**Solutions:**
- Tokens expire after 24 hours
- User must request new verification email
- Check `verificationTokenExpiresAt` field in database
- Consider implementing "resend verification" endpoint

## API Endpoints

### Verification
- `POST /api/auth/register` - Register user (sends verification email)
- `GET /api/auth/verify?token=TOKEN` - Verify email with token

### Preferences
- `GET /api/auth/me` - Get current user with preferences
- `PUT /api/auth/preferences` - Update notification preferences
- `GET /api/auth/unsubscribe?email=EMAIL` - Unsubscribe from marketing

## Security Best Practices

✅ **API Key Security**
- Never commit API key to source control
- Use environment variables only
- Rotate keys periodically
- Use different keys for dev/staging/production

✅ **Email Validation**
- Validate email format before sending
- Use sparse indexes for token fields
- Implement rate limiting on email endpoints
- Clear tokens after successful verification

✅ **Privacy Compliance**
- Honor unsubscribe requests immediately
- Include unsubscribe link in marketing emails
- Don't reveal if email exists in unsubscribe response
- Log preference changes for audit trail

## Production Deployment

### Railway / Heroku

Set environment variables in dashboard:
```bash
MAILGUN_API_KEY=pubkey-2821845c6a90a3ec96a734687de541f6
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_BASE_URL=https://api.eu.mailgun.net
MAILGUN_FROM=no-reply@mg.yourdomain.com
APP_BASE_URL=https://your-app.railway.app
```

### Docker

Pass as environment variables:
```dockerfile
ENV MAILGUN_API_KEY=pubkey-2821845c6a90a3ec96a734687de541f6
ENV MAILGUN_DOMAIN=mg.yourdomain.com
```

Or use `.env` file with Docker Compose:
```yaml
services:
  app:
    env_file: .env
```

## Support

- **Mailgun Docs**: https://documentation.mailgun.com/
- **Mailgun Support**: https://help.mailgun.com/
- **EventFlow Issues**: https://github.com/rhysllwydlewis/eventflow/issues

## License

This implementation is part of EventFlow and follows the same license as the main project.
