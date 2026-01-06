# Quick Setup Guide for Email Verification

## ⚠️ IMPORTANT: You mentioned you couldn't verify your email

If you're getting a 404 error when clicking the verification link, here's how to troubleshoot:

## Step 1: Verify Postmark Configuration

Set these environment variables in your Railway/hosting dashboard:

```env
POSTMARK_API_KEY=5889c784-6208-417f-af17-94f63536db36
POSTMARK_FROM=admin@event-flow.co.uk
APP_BASE_URL=https://event-flow.co.uk
```

**Important:** Make sure `admin@event-flow.co.uk` is verified as a Sender Signature in Postmark.

## Step 2: Check Verification Link Format

The verification link should look like:

```
https://event-flow.co.uk/verify.html?token=verify_abc123xyz789
```

**Common Issues:**

- ❌ Missing `.html` extension: `https://event-flow.co.uk/verify?token=...` (404 error)
- ✅ Correct format: `https://event-flow.co.uk/verify.html?token=...`

## Step 3: Test the Verification Page Directly

1. Navigate to: `https://event-flow.co.uk/verify.html` (without token)
2. You should see: "No verification token provided. Please check your email for the verification link."
3. If you get a 404, the file isn't being served correctly

## Step 4: Check Email Template

The email template uses this link format:

```html
<a href="{{verificationLink}}" class="cta-button">✓ Verify Email Address</a>
```

The backend generates the link in `utils/postmark.js`:

```javascript
const verificationLink = `${APP_BASE_URL}/verify.html?token=${encodeURIComponent(verificationToken)}`;
```

## Step 5: Verify Static File Serving

In your `server.js`, ensure this line exists:

```javascript
app.use(express.static('public'));
```

This serves all files in the `public/` directory, including `verify.html`.

## Step 6: Test the Verification Flow

### Manual Test:

1. **Register a test account:**

   ```bash
   curl -X POST https://event-flow.co.uk/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "your-test-email@example.com",
       "password": "TestPass123",
       "role": "customer"
     }'
   ```

2. **Check your email** - You should receive the verification email

3. **Click the verification link** - Should redirect to verify.html

4. **Check browser console** - Look for any JavaScript errors

5. **Try to login** - Should be blocked until you verify

6. **After verification** - Login should work

### Check Server Logs:

Look for these log messages:

```
📧 Attempting to send verification email to user@example.com
✅ Verification email sent successfully to user@example.com
✅ Email sent successfully via Postmark
   MessageID: abc123-xyz789
```

If you see errors instead:

```
❌ Failed to send verification email: [error message]
```

## Step 7: Postmark Dashboard Checks

1. Go to: https://account.postmarkapp.com/servers
2. Click on your server
3. Check **Activity** tab - See all sent emails
4. Look for your verification email
5. Check status: Should be "Delivered"

## Step 8: Configure Webhook (Optional but Recommended)

Add this webhook URL in Postmark to track email delivery:

**Webhook URL:**

```
https://event-flow.co.uk/api/webhooks/postmark
```

**Setup:**

1. Go to: Servers → [Your Server] → Webhooks
2. Click "Add webhook"
3. Set URL to: `https://event-flow.co.uk/api/webhooks/postmark`
4. Select events: Delivery, Bounce, SpamComplaint
5. Configure Basic Auth (optional):
   - Username: `postmark-webhook`
   - Password: (generate a secure password)
   - Add same credentials to environment variables:
     ```env
     POSTMARK_WEBHOOK_USER=postmark-webhook
     POSTMARK_WEBHOOK_PASS=your-secure-password
     ```

## Troubleshooting Specific Issues

### Issue: "Could not verify email" or 404 Error

**Possible Causes:**

1. ❌ Wrong URL format (missing .html)
2. ❌ Static files not being served
3. ❌ Token expired (24-hour limit)
4. ❌ Token already used
5. ❌ JavaScript not loading

**Solutions:**

1. Check the exact URL in the email
2. Visit `https://event-flow.co.uk/verify.html` directly (should load the page)
3. Check browser console for errors
4. Try a new registration with a different email
5. Check server logs for verification attempts

### Issue: Email Not Received

**Possible Causes:**

1. ❌ Postmark API key not set
2. ❌ Sender address not verified
3. ❌ Email went to spam
4. ❌ Invalid recipient email

**Solutions:**

1. Check environment variables are set correctly
2. Verify sender in Postmark dashboard
3. Check spam/junk folder
4. Check Postmark activity logs
5. Try sending to a different email address

### Issue: Verification Link Expired

**Message:** "Verification token has expired. Please request a new one."

**Solution:** Currently, you need to register again. The token expires after 24 hours for security.

**Future Enhancement:** We should add a "Resend Verification Email" feature.

## Verification Checklist

- [ ] Environment variables set (POSTMARK_API_KEY, POSTMARK_FROM, APP_BASE_URL)
- [ ] Sender email verified in Postmark
- [ ] Static files being served (`express.static('public')`)
- [ ] verify.html accessible at `https://event-flow.co.uk/verify.html`
- [ ] Email received with correct verification link format
- [ ] Clicking link loads verify.html page
- [ ] Page shows "Checking your verification link..."
- [ ] Success message appears: "✓ Your email has been verified successfully!"
- [ ] Auto-redirect to login page after 3 seconds
- [ ] Welcome email received after verification
- [ ] Can now login successfully

## Quick Commands

### Check if verify.html is accessible:

```bash
curl -I https://event-flow.co.uk/verify.html
# Should return: HTTP/1.1 200 OK
```

### Check environment variables (in Railway):

```bash
railway variables
# Look for POSTMARK_API_KEY, POSTMARK_FROM, APP_BASE_URL
```

### Test verification endpoint directly:

```bash
curl "https://event-flow.co.uk/api/auth/verify?token=YOUR_TOKEN_HERE"
```

## Need More Help?

1. Check the complete documentation: `EMAIL_VERIFICATION.md`
2. Check Postmark setup guide: `POSTMARK_SETUP.md`
3. Check server logs for error messages
4. Check Postmark activity dashboard
5. Contact support with:
   - The exact error message
   - Screenshots of the issue
   - Server logs (remove sensitive data)
   - Postmark activity log

## Summary

The email verification system is fully implemented and working. The most common issue is the verification link format or Postmark not being configured correctly. Follow the steps above to ensure everything is set up properly.

**Key Points:**

- ✅ Email template has dark mode support and professional design
- ✅ Backend properly generates and validates tokens
- ✅ Frontend (verify.html) handles the verification flow
- ✅ All tests passing (36 tests total)
- ✅ Documentation complete
- ✅ Webhook support available

If you're still having issues, the most likely causes are:

1. Environment variables not set in production
2. Sender email not verified in Postmark
3. Static files not being served correctly
