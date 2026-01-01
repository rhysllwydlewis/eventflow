# Stripe Payment Integration - Testing Guide

## Overview

This guide explains how to test the Stripe payment integration in EventFlow.

## Prerequisites

1. **Stripe Account**: Sign up for a free Stripe account at https://stripe.com
2. **Stripe Test Keys**: Get your test API keys from the Stripe Dashboard
3. **Stripe CLI**: Install for local webhook testing (optional but recommended)

## Environment Setup

### Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Secret Key (from Stripe Dashboard > Developers > API Keys)
STRIPE_SECRET_KEY=sk_test_...

# Stripe Publishable Key (for frontend - currently not used in server-side implementation)
# For Railway deployment, use NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (get from Stripe CLI or Dashboard > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Success and Cancel URLs
STRIPE_SUCCESS_URL=http://localhost:3000/payment-success.html
STRIPE_CANCEL_URL=http://localhost:3000/payment-cancel.html
```

> **Railway Deployment Note**: If deploying to Railway, use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` instead of `STRIPE_PUBLISHABLE_KEY` for the publishable key, as Railway follows Next.js naming conventions.

### Getting Test API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Click "Reveal test key" for your **Secret key** (starts with `sk_test_`)
4. Add both keys to your `.env` file

## Testing Payment Flow

### 1. Start the Server

```bash
npm install
npm start
```

Verify the server logs show:

```
✅ Stripe payment integration enabled
```

### 2. Test Authentication

Before testing payments, you need to be logged in:

1. Go to http://localhost:3000/auth.html
2. Sign up or log in with a test account

### 3. Test Checkout Page

1. Navigate to http://localhost:3000/checkout.html
2. You should see:
   - Two pricing plans (Pro Monthly and Pro Yearly)
   - "Choose Pro Monthly" and "Choose Pro Yearly" buttons
   - Security notice about Stripe encryption

3. Click on a plan button
4. You will be redirected to Stripe's hosted checkout page

### 4. Complete Test Payment

On the Stripe checkout page:

1. Use Stripe's test card number: `4242 4242 4242 4242`
2. Use any future expiry date (e.g., `12/25`)
3. Use any 3-digit CVC (e.g., `123`)
4. Use any valid postal code (e.g., `SW1A 1AA`)
5. Complete the payment

You will be redirected to the success page.

### 5. Verify Payment Success

After payment:

1. You should be on http://localhost:3000/payment-success.html
2. You should see:
   - Success checkmark
   - "Payment Successful!" message
   - Transaction details (if session ID present)
   - Buttons to go to dashboard or browse suppliers

## Testing Webhooks Locally

### Setup Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

4. Copy the webhook signing secret (starts with `whsec_`) to your `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Test Webhook Events

With the Stripe CLI running:

1. Make a test payment through the checkout page
2. Watch the Stripe CLI output for webhook events
3. Check your server logs for webhook processing messages:
   ```
   Received webhook event: checkout.session.completed
   Payment pay_123 marked as succeeded
   ```

### Test Specific Webhook Events

You can trigger test webhooks without making actual payments:

```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# Test subscription created
stripe trigger customer.subscription.created
```

## Testing the API Endpoints

### 1. Create Checkout Session

```bash
curl -X POST http://localhost:3000/api/payments/create-checkout-session \
  -H "Content-Type: application/json" \
  -b "token=YOUR_JWT_TOKEN" \
  -d '{
    "type": "one_time",
    "amount": 999,
    "currency": "gbp",
    "planName": "Pro Monthly"
  }'
```

Expected response:

```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### 2. Get Payment History

```bash
curl http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -b "token=YOUR_JWT_TOKEN"
```

Expected response:

```json
{
  "success": true,
  "payments": [
    {
      "id": "pay_123",
      "amount": 9.99,
      "currency": "gbp",
      "status": "succeeded",
      "type": "one_time",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. Create Billing Portal Session

```bash
curl -X POST http://localhost:3000/api/payments/create-portal-session \
  -H "Content-Type: application/json" \
  -b "token=YOUR_JWT_TOKEN" \
  -d '{
    "returnUrl": "http://localhost:3000/dashboard-supplier.html"
  }'
```

## Test Cards

Stripe provides various test cards for different scenarios:

| Card Number         | Scenario           |
| ------------------- | ------------------ |
| 4242 4242 4242 4242 | Success            |
| 4000 0000 0000 0002 | Declined           |
| 4000 0000 0000 9995 | Insufficient funds |
| 4000 0000 0000 0069 | Expired card       |
| 4000 0025 0000 3155 | 3D Secure required |

See more test cards: https://stripe.com/docs/testing

## Verifying Database Records

Check MongoDB for payment records:

```bash
# Connect to MongoDB
mongosh

# Use eventflow database
use eventflow

# Find all payments
db.payments.find()

# Find payments for a specific user
db.payments.find({ userId: "user_123" })

# Check payment status
db.payments.find({ status: "succeeded" })
```

## Troubleshooting

### "Stripe is not configured" Error

**Problem**: Server shows warning about Stripe not being configured.

**Solution**:

1. Verify `STRIPE_SECRET_KEY` is set in `.env`
2. Ensure the key starts with `sk_test_` for testing
3. Restart the server after adding the key

### Webhook Signature Verification Failed

**Problem**: Webhooks return 400 error with "Invalid signature".

**Solution**:

1. Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
2. If using Stripe CLI, copy the secret shown when running `stripe listen`
3. For production, get the secret from Stripe Dashboard > Webhooks

### Payment Not Recorded in Database

**Problem**: Payment completes but no record in database.

**Solution**:

1. Check server logs for webhook processing errors
2. Verify MongoDB connection is working
3. Ensure webhooks are being received (check Stripe Dashboard > Developers > Webhooks)

### Cannot Access Checkout Page (Redirects to Login)

**Problem**: Redirected to login when accessing checkout page.

**Solution**:

1. Log in at http://localhost:3000/auth.html
2. Ensure your JWT token cookie is valid
3. Check browser console for authentication errors

## Testing Subscriptions

### Create Subscription Price in Stripe

1. Go to Stripe Dashboard > Products
2. Create a new product (e.g., "EventFlow Pro")
3. Add a recurring price (e.g., £9.99/month)
4. Copy the Price ID (starts with `price_`)

### Test Subscription Checkout

Modify the checkout API call to use subscription mode:

```javascript
{
  "type": "subscription",
  "priceId": "price_1234567890",
  "planName": "Pro Monthly"
}
```

### Verify Subscription Status

After subscribing:

1. Check the `payments` collection for subscription records
2. Verify `subscriptionDetails` object is populated
3. Check user's `isPro` status is updated
4. Verify `proExpiresAt` date is set

## Production Deployment Checklist

Before deploying to production:

- [ ] Replace test API keys with live keys (`sk_live_...` and `pk_live_...`)
- [ ] Set up webhook endpoint in Stripe Dashboard
- [ ] Add webhook signing secret to production environment
- [ ] Update success/cancel URLs to production domain
- [ ] Enable webhook signature verification
- [ ] Test with real payment methods
- [ ] Monitor webhook event processing
- [ ] Set up error alerting for failed payments

### Railway-Specific Configuration

If deploying to Railway:

1. **Environment Variable Names**:
   - Use `STRIPE_SECRET_KEY` (standard name works)
   - Use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` instead of `STRIPE_PUBLISHABLE_KEY`
   - Railway follows Next.js conventions for client-side variables

2. **Setting Variables in Railway**:

   ```bash
   # In Railway dashboard > Variables tab, add:
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_SUCCESS_URL=https://your-domain.railway.app/payment-success.html
   STRIPE_CANCEL_URL=https://your-domain.railway.app/payment-cancel.html
   ```

3. **Webhook URL**:
   - Set webhook URL in Stripe Dashboard to: `https://your-domain.railway.app/api/payments/webhook`
   - Copy the webhook signing secret to Railway's `STRIPE_WEBHOOK_SECRET` variable

## API Documentation

View full API documentation at: http://localhost:3000/api-docs

Look for the "Payments" section for detailed endpoint information.

## Support

For issues or questions:

- Check Stripe documentation: https://stripe.com/docs
- Review server logs for error messages
- Test webhook events with Stripe CLI
- Contact EventFlow support if persistent issues occur
