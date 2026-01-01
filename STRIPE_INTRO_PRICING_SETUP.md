# Stripe Introductory Pricing Setup Guide

This guide explains how to set up introductory pricing for the Professional plan using Stripe coupons and checkout discounts.

## Overview

The Professional plan offers introductory pricing:
- **First 3 months**: £39/month
- **After 3 months**: £59/month

This is implemented using:
1. A Stripe recurring Price ID set to £59/month
2. A Stripe Coupon that gives £20 off for the first 3 months
3. Stripe Checkout applies the coupon automatically

## Setup Steps

### 1. Create the Recurring Price in Stripe

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Products** → **Add Product**
3. Create a product:
   - **Name**: EventFlow Professional Plan
   - **Description**: Professional subscription for EventFlow suppliers
4. Add a recurring price:
   - **Pricing model**: Standard pricing
   - **Price**: £59.00 GBP
   - **Billing period**: Monthly
   - **Payment type**: Recurring
5. Click **Add product**
6. Copy the **Price ID** (starts with `price_...`)
   - Example: `price_1A2B3C4D5E6F7G8H9I0J1K2L`

### 2. Create the Introductory Discount Coupon

1. In Stripe Dashboard, go to **Products** → **Coupons** → **New**
2. Create a coupon:
   - **Name**: Professional Plan Intro Discount
   - **ID**: (optional, e.g., `pro-intro-3mo`)
   - **Coupon type**: Amount off
   - **Amount off**: £20.00 GBP
   - **Duration**: Repeating
   - **Number of months**: 3
3. Click **Create coupon**
4. Copy the **Coupon ID** (the one you set, or auto-generated)
   - Example: `pro-intro-3mo`

### 3. Configure Environment Variables

Add these environment variables to your deployment platform (Railway, Heroku, etc.) or local `.env` file:

```bash
# Stripe Professional Plan Price ID (£59/month recurring)
STRIPE_PRO_PRICE_ID=price_1A2B3C4D5E6F7G8H9I0J1K2L

# Stripe Professional Plan Intro Coupon (£20 off for 3 months)
STRIPE_PRO_INTRO_COUPON_ID=pro-intro-3mo
```

**Important Notes:**
- Both variables **must** be set for intro pricing to work
- If either is missing, the system will fall back to one-time payments
- The coupon and price must be in the same Stripe account
- Use test credentials (`price_test_...`) for development

### 4. Verify the Configuration

1. Restart your application to load the new environment variables
2. Check the server logs for:
   ```
   ✅ Professional plan introductory pricing enabled
   ```
3. If you see a warning about partial configuration, check that both variables are set correctly

## How It Works

### Checkout Flow

When a user subscribes to the Professional plan:

1. Frontend calls `/api/payments/create-checkout-session` with plan details
2. Backend detects it's the Professional plan
3. If intro pricing is enabled:
   - Uses `STRIPE_PRO_PRICE_ID` for the subscription
   - Applies `STRIPE_PRO_INTRO_COUPON_ID` as a discount
4. Stripe Checkout shows:
   - First 3 months: £39/month (£59 - £20 coupon)
   - After 3 months: £59/month (regular price)
5. Stripe automatically handles the transition after 3 months

### Fallback Behavior

If intro pricing is **not** configured (missing env vars):
- System falls back to one-time payment mode
- Uses the displayed price directly
- No recurring subscription is created
- This allows the app to work without full Stripe configuration

## Testing

### Test Mode Setup

1. Use Stripe test mode credentials:
   - Test Price ID: `price_test_...`
   - Test Coupon ID: Your test coupon ID
2. Set environment variables with test credentials
3. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

### Verify Intro Pricing

1. Start subscription checkout for Professional plan
2. In Stripe Checkout, verify you see:
   - "Discount: -£20.00" or similar
   - Subtotal: £59.00
   - Total today: £39.00
3. Complete test payment
4. Check Stripe Dashboard → Subscriptions:
   - Verify subscription is created
   - Verify coupon is applied
   - Verify coupon expires after 3 months

## Troubleshooting

### "Intro pricing not enabled" in logs

**Problem**: Server logs show warning about partial configuration

**Solution**: 
- Check both `STRIPE_PRO_PRICE_ID` and `STRIPE_PRO_INTRO_COUPON_ID` are set
- Verify no typos in variable names
- Restart the application after setting variables

### Coupon not applied at checkout

**Problem**: Checkout shows full £59 price

**Solution**:
- Verify coupon ID is correct in Stripe Dashboard
- Check coupon is not expired or redeemed limit reached
- Ensure coupon currency matches price currency (GBP)
- Verify coupon is "active" in Stripe Dashboard

### "Invalid price" error

**Problem**: Stripe returns error about invalid price ID

**Solution**:
- Verify price ID is correct and exists in Stripe
- Check you're using correct mode (test vs live)
- Ensure price is set to "recurring" (not one-time)
- Verify price currency is GBP

### User charged £59 immediately

**Problem**: User charged full price instead of intro price

**Solution**:
- Verify coupon is set to "repeating" for 3 months
- Check coupon amount is £20.00 off
- Ensure coupon is applied before subscription created
- Review Stripe Dashboard to confirm coupon is on subscription

## Production Deployment Checklist

Before deploying to production:

- [ ] Create production Price ID in live Stripe account (£59/month)
- [ ] Create production Coupon in live Stripe account (£20 off, 3 months)
- [ ] Set `STRIPE_PRO_PRICE_ID` in production environment
- [ ] Set `STRIPE_PRO_INTRO_COUPON_ID` in production environment
- [ ] Use live Stripe API keys (`sk_live_...` and `pk_live_...`)
- [ ] Test with real payment (small amount) to verify flow
- [ ] Verify webhook receives subscription events
- [ ] Monitor first few real subscriptions for issues

## Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Coupons Documentation](https://stripe.com/docs/billing/subscriptions/coupons)
- [Stripe Prices Documentation](https://stripe.com/docs/billing/prices-guide)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Review Stripe Dashboard for failed payment attempts
3. Verify all environment variables are set correctly
4. Contact Stripe support for Stripe-specific issues

---

**Last Updated**: January 2026
**Version**: 1.0
