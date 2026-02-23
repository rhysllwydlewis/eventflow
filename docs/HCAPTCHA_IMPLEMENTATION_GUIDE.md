# hCaptcha Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing hCaptcha across EventFlow forms to prevent spam and bot submissions.

## Backend Setup (✅ Complete)

### 1. Environment Configuration

The following environment variables have been added to `.env.example`:

```bash
# hCAPTCHA CONFIGURATION
# Get your keys from https://www.hcaptcha.com/
HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001
HCAPTCHA_SECRET_KEY=0x0000000000000000000000000000000000000000
```

**Production Setup:**

1. Sign up at [https://www.hcaptcha.com/](https://www.hcaptcha.com/)
2. Create a new site and get your Site Key and Secret Key
3. Add these to your Railway environment variables or `.env` file
4. **Never commit actual keys to Git**

### 2. Backend Verification Function (✅ Already Implemented)

Location: `server.js` lines ~215-245

```javascript
async function verifyHCaptcha(token) {
  if (!token) {
    return { success: false, error: 'No captcha token provided' };
  }

  if (!process.env.HCAPTCHA_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'CAPTCHA verification not configured' };
    }
    console.warn(
      'hCaptcha verification skipped - HCAPTCHA_SECRET not configured (development only)'
    );
    return { success: true, warning: 'Captcha verification disabled in development' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const verifyResponse = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET,
        response: token,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await verifyResponse.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('hCaptcha verification timeout');
      return { success: false, error: 'Captcha verification timeout' };
    }
    console.error('Error verifying captcha:', error);
    return { success: false, error: 'Captcha verification failed' };
  }
}
```

### 3. CSP Headers (✅ Already Configured)

Location: `middleware/security.js`

The Content Security Policy already includes hCaptcha domains:

- `script-src`: `https://hcaptcha.com`, `https://*.hcaptcha.com`
- `frame-src`: `https://hcaptcha.com`, `https://*.hcaptcha.com`
- `style-src`: `https://hcaptcha.com`, `https://*.hcaptcha.com`

## Frontend Implementation (✅ Complete)

### What Was Implemented

- **`public/auth.html`**: hCaptcha API script loaded, widget container (`#reg-hcaptcha-container`) added to registration form, `captchaToken` included in submission payload.
- **`public/contact.html`**: Contact form added with hCaptcha widget and client-side submission handler.
- **`public/assets/js/utils/hcaptcha.js`**: Reusable hCaptcha utility module for other forms.
- **`public/assets/js/app.js`**: Registration flow sends `captchaToken` to server.
- **Sitekey source**: `<meta name="hcaptcha-sitekey">` (populated from `HCAPTCHA_SITE_KEY` env var) or falls back to `EVENTFLOW_CONFIG.hcaptchaSitekey` (from `/api/v1/config`).

### Step 1: Add hCaptcha Script to HTML Pages

Add this to the `<head>` section of pages with forms:

```html
<!-- hCaptcha Script -->
<script src="https://js.hcaptcha.com/1/api.js" async defer></script>
```

**Pages to update:**

- `public/contact.html` - Contact form
- `public/auth.html` or registration page - Registration form
- Any page with enquiry forms

### Step 2: Add hCaptcha Widget to Forms

#### Example: Contact Form

```html
<form id="contactForm" method="POST">
  <div class="form-group">
    <label for="name">Name</label>
    <input type="text" id="name" name="name" required />
  </div>

  <div class="form-group">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required />
  </div>

  <div class="form-group">
    <label for="message">Message</label>
    <textarea id="message" name="message" rows="5" required></textarea>
  </div>

  <!-- hCaptcha Widget -->
  <div
    class="h-captcha"
    data-sitekey="YOUR_HCAPTCHA_SITE_KEY"
    data-theme="light"
    data-size="normal"
    data-callback="onCaptchaSuccess"
    data-expired-callback="onCaptchaExpired"
    data-error-callback="onCaptchaError"
  ></div>

  <button type="submit" id="submitBtn">Send Message</button>
</form>
```

#### Example: Registration Form

```html
<form id="registrationForm" method="POST">
  <!-- form fields -->

  <div
    class="h-captcha"
    data-sitekey="YOUR_HCAPTCHA_SITE_KEY"
    data-callback="onCaptchaSuccess"
    data-expired-callback="onCaptchaExpired"
  ></div>

  <button type="submit" id="submitBtn" disabled>Create Account</button>
</form>
```

### Step 3: Frontend JavaScript Validation

```javascript
// Callback functions
function onCaptchaSuccess(token) {
  console.log('Captcha verified successfully');
  document.getElementById('submitBtn').disabled = false;
}

function onCaptchaExpired() {
  console.warn('Captcha expired');
  document.getElementById('submitBtn').disabled = true;
  showNotification('Captcha expired, please try again', 'warning');
}

function onCaptchaError(error) {
  console.error('Captcha error:', error);
  showNotification('Captcha error, please refresh and try again', 'error');
}

// Form submission
document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();

  const captchaResponse = document.querySelector('[name="h-captcha-response"]')?.value;

  if (!captchaResponse) {
    showNotification('Please complete the captcha', 'error');
    return;
  }

  const formData = new FormData(e.target);
  formData.append('h-captcha-response', captchaResponse);

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      showNotification('Message sent successfully!', 'success');
      e.target.reset();
      if (window.hcaptcha) {
        hcaptcha.reset(); // Reset captcha after successful submission
      }
    } else {
      const error = await response.json();
      showNotification(error.message || 'Failed to send message', 'error');
    }
  } catch (err) {
    console.error('Form submission error:', err);
    showNotification('Network error, please try again', 'error');
  }
});
```

### Step 4: Backend Route Integration

#### Example: Contact Form Route

```javascript
app.post('/api/contact', async (req, res) => {
  try {
    const captchaToken = req.body['h-captcha-response'];

    // Verify captcha
    const captchaResult = await verifyHCaptcha(captchaToken);
    if (!captchaResult.success) {
      return res.status(400).json({
        error: 'Invalid captcha',
        details: captchaResult.error,
      });
    }

    // Process form...
    const { name, email, message } = req.body;

    // Send email, save to database, etc.

    res.json({ success: true, message: 'Contact form submitted successfully' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to process contact form' });
  }
});
```

### Step 5: CSS Styling

```css
/* hCaptcha Widget Styling */
.h-captcha {
  margin: 20px 0;
  display: flex;
  justify-content: center;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .h-captcha {
    transform: scale(0.85);
    transform-origin: 0 0;
  }
}

/* Form with captcha */
.form-with-captcha {
  max-width: 600px;
  margin: 0 auto;
}

/* Submit button disabled state */
button[type='submit']:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

## Testing Checklist

### Development Testing

- [ ] hCaptcha widget loads correctly
- [ ] Widget displays in light mode
- [ ] Submit button is disabled until captcha is completed
- [ ] Captcha verification works (even with test keys)
- [ ] Form submits successfully after captcha completion
- [ ] Captcha resets after successful submission
- [ ] Expired captcha is detected and handled
- [ ] Mobile responsive (widget scales correctly)

### Production Testing

- [ ] Real hCaptcha keys are configured
- [ ] Captcha prevents form spam
- [ ] Failed captcha verification returns proper error
- [ ] Works in Chrome, Firefox, Safari
- [ ] Works on mobile devices (iOS Safari, Chrome Android)
- [ ] Accessible (keyboard navigation, screen readers)
- [ ] GDPR compliant (check hCaptcha privacy settings)

## Integration with Lead Scoring

When implementing hCaptcha on enquiry forms, update the lead quality scoring:

```javascript
function calculateLeadQuality(enquiry) {
  let score = 0;

  // Existing scoring logic...

  // Bonus for captcha verification (reduces spam likelihood)
  if (enquiry.captchaVerified) {
    score += 10;
  }

  return score >= 80 ? 'Hot' : score >= 60 ? 'High' : score >= 40 ? 'Good' : 'Low';
}
```

## Common Issues & Solutions

### Issue: "Captcha not loading"

**Solution:** Check CSP headers include hCaptcha domains

### Issue: "Always returns invalid captcha in development"

**Solution:** Make sure HCAPTCHA_SECRET is set, or backend will skip verification in dev mode

### Issue: "Captcha expires too quickly"

**Solution:** Increase timeout in data attributes: `data-timeout="300"` (5 minutes)

### Issue: "Mobile widget too large"

**Solution:** Add CSS transform scale: `transform: scale(0.85);`

## Security Best Practices

1. **Never expose secret key** - Only use in backend
2. **Always validate server-side** - Never trust client-side validation alone
3. **Rate limit endpoints** - Even with captcha, add rate limiting
4. **Log captcha failures** - Monitor for potential attacks
5. **Use HTTPS** - Always use secure connections
6. **Set reasonable timeouts** - Don't make users wait too long

## Documentation Links

- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [hCaptcha Dashboard](https://dashboard.hcaptcha.com/)
- [CSP Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Support

For issues or questions, contact the development team or refer to the EventFlow internal wiki.
