# Stripe.js Integration Setup Guide

## Overview

EventFlow now uses Stripe.js v3 for secure payment processing. This guide explains how the integration works and how to set it up.

## Architecture

### Frontend (Stripe.js)

- **Library**: Loaded from `https://js.stripe.com/v3/`
- **Initialization**: Fetches publishable key from `/api/payments/config`
- **Checkout Flow**: Uses `stripe.redirectToCheckout()` method
- **File**: `/public/assets/js/checkout.js`

### Backend (Stripe Node.js SDK)

- **Library**: `stripe` npm package v20.1.0
- **Session Creation**: `/api/payments/create-checkout-session` endpoint
- **Config Endpoint**: `/api/payments/config` serves publishable key
- **File**: `/routes/payments.js`

## Setup Instructions

### 1. Get Stripe API Keys

1. Sign up at https://dashboard.stripe.com/register
2. Go to Developers > API keys
3. Copy your keys:
   - **Secret key** (starts with `sk_test_...` for test mode)
   - **Publishable key** (starts with `pk_test_...` for test mode)

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Backend API key (keep secret!)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Frontend publishable key (safe to expose)
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Optional: Webhook secret (for production)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Success/Cancel URLs
STRIPE_SUCCESS_URL=http://localhost:3000/payment-success.html
STRIPE_CANCEL_URL=http://localhost:3000/payment-cancel.html
```

### 3. Test the Integration

1. Start the server:

   ```bash
   npm start
   ```

2. Navigate to checkout page:

   ```
   http://localhost:3000/checkout.html?plan=pro
   ```

3. Check browser console for:

   ```
   ✅ Stripe.js initialized
   ```

4. Click "Choose Professional" button

5. You should be redirected to Stripe's hosted checkout page

6. Use test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

## How It Works

### Step 1: Page Load

```javascript
// checkout.js initializes Stripe
async function initializeStripe() {
  // Fetch config from backend
  const response = await fetch('/api/payments/config');
  const config = await response.json();

  // Initialize Stripe.js
  stripe = Stripe(config.publishableKey);
}
```

### Step 2: User Clicks Button

```javascript
// Button click triggers checkout
button.addEventListener('click', function () {
  const planKey = this.getAttribute('data-plan');
  handleCheckout(planKey);
});
```

### Step 3: Create Checkout Session

```javascript
// Backend creates session
const response = await fetch('/api/payments/create-checkout-session', {
  method: 'POST',
  body: JSON.stringify({
    type: 'one_time',
    amount: 3900, // £39 in pence
    currency: 'gbp',
    planName: 'Professional',
  }),
});
```

### Step 4: Redirect to Stripe

```javascript
// Use Stripe.js to redirect (recommended by Stripe)
const result = await stripe.redirectToCheckout({
  sessionId: data.sessionId,
});
```

## Content Security Policy (CSP)

The following CSP directives are required for Stripe.js:

```javascript
scriptSrc: [
  'https://js.stripe.com'  // Load Stripe.js library
],
connectSrc: [
  'https://api.stripe.com'  // API calls to Stripe
],
frameSrc: [
  'https://js.stripe.com',      // Stripe Elements iframes
  'https://hooks.stripe.com'    // Stripe webhooks
]
```

These are already configured in `server.js`.

## API Endpoints

### GET /api/payments/config

Returns Stripe publishable key for frontend.

**Response:**

```json
{
  "publishableKey": "pk_test_..."
}
```

### POST /api/payments/create-checkout-session

Creates a Stripe checkout session.

**Request:**

```json
{
  "type": "one_time",
  "amount": 3900,
  "currency": "gbp",
  "planName": "Professional"
}
```

**Response:**

```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

## Troubleshooting

### "Payment system not available"

- Check that `STRIPE_SECRET_KEY` is set in `.env`
- Check that `STRIPE_PUBLISHABLE_KEY` is set in `.env`
- Restart the server after changing `.env`

### "Stripe.js not loaded"

- Check browser console for CSP errors
- Verify `https://js.stripe.com/v3/` is in CSP `scriptSrc`
- Check network tab to see if script loaded

### "Failed to initialize Stripe"

- Check `/api/payments/config` endpoint returns `200 OK`
- Verify publishable key starts with `pk_test_` or `pk_live_`
- Check browser console for errors

### Console shows "⚠️ Stripe is not configured"

- `STRIPE_SECRET_KEY` is missing from environment
- Backend won't process payments until this is set

### Redirect doesn't work

- Check that session ID is returned from backend
- Verify `stripe.redirectToCheckout()` is called
- Check browser console for errors
- Try the fallback URL redirect

## Testing Checklist

- [ ] Environment variables set (SECRET_KEY and PUBLISHABLE_KEY)
- [ ] Server starts without Stripe errors
- [ ] Checkout page loads without console errors
- [ ] "✅ Stripe.js initialized" appears in console
- [ ] Clicking button shows "Processing..." state
- [ ] Redirects to Stripe checkout page
- [ ] Can complete test payment with test card
- [ ] Redirects back to success page after payment

## Production Deployment

### Additional Steps for Production:

1. **Use Live Keys**

   ```bash
   STRIPE_SECRET_KEY=sk_live_your_live_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
   ```

2. **Set Webhook Secret**
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/api/payments/webhook`
   - Copy signing secret to `STRIPE_WEBHOOK_SECRET`

3. **Update Success/Cancel URLs**

   ```bash
   STRIPE_SUCCESS_URL=https://yourdomain.com/payment-success.html
   STRIPE_CANCEL_URL=https://yourdomain.com/payment-cancel.html
   ```

4. **Enable Webhook Events**
   Select these events in Stripe Dashboard:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

5. **Test in Production**
   - Use real card or Stripe test mode toggle
   - Verify webhooks are received
   - Check payment appears in Stripe Dashboard

## Security Notes

- ✅ Publishable key is safe to expose (it's meant to be public)
- ⚠️ Secret key must NEVER be exposed to frontend
- ✅ CSP prevents unauthorized script loading
- ✅ HTTPS required for production (enforced by Stripe)
- ✅ Webhook signatures verified for security

## Documentation References

- Stripe.js Documentation: https://stripe.com/docs/js
- Checkout Session: https://stripe.com/docs/api/checkout/sessions
- Stripe Node.js SDK: https://stripe.com/docs/api?lang=node
- Testing Cards: https://stripe.com/docs/testing

## Support

If you encounter issues:

1. Check browser console for errors
2. Check server logs for Stripe initialization
3. Verify environment variables are set correctly
4. Test with Stripe test mode first
5. Consult Stripe documentation for API errors
