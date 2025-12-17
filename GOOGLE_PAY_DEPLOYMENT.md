# Google Pay Subscription System - Deployment Guide

## Overview

This guide explains how to deploy and test the Google Pay subscription system for EventFlow Pro and Pro+ memberships.

## Prerequisites

1. Firebase project: `eventflow-ffb12`
2. Google Pay merchant account
3. Firebase CLI installed: `npm install -g firebase-tools`
4. Node.js 18+ installed

## Architecture

### Components

1. **Frontend UI**
   - `/public/supplier/subscription.html` - Subscription plan selection page
   - `/public/supplier/js/subscription.js` - Subscription management logic
   - `/public/supplier/js/googlepay-config.js` - Google Pay API configuration
   - `/public/supplier/js/feature-access.js` - Feature access control
   - `/public/supplier/css/subscription.css` - Subscription page styles

2. **Backend Cloud Functions**
   - `functions/subscriptions.js` - All subscription-related Cloud Functions
   - `functions/index.js` - Functions entry point

3. **Database**
   - Firestore collections: `suppliers`, `payments`, `subscriptionPlans`
   - Security rules updated in `firestore.rules`

### Subscription Plans

| Plan | Price | Billing | Trial | Features |
|------|-------|---------|-------|----------|
| Pro Monthly | £9.99/mo | Monthly | 14 days | Priority listing, badge, analytics, 50 bookings/mo |
| Pro+ Monthly | £19.99/mo | Monthly | 14 days | All Pro + premium badge, unlimited bookings, priority support |
| Pro Yearly | £99.99/yr | Yearly | 28 days | Pro features + 17% savings |
| Pro+ Yearly | £199.99/yr | Yearly | 28 days | Pro+ features + 17% savings |

## Deployment Steps

### 1. Deploy Firebase Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

This deploys the following Cloud Functions:
- `onPaymentSuccess` - Processes Google Pay payments
- `checkSubscriptionStatus` - Daily cron job to check subscription status
- `cancelSubscription` - Handles cancellations
- `updateSubscription` - Handles plan changes
- `initializeSubscriptionPlans` - One-time setup to create plan documents

### 2. Initialize Subscription Plans

After deploying functions, call the initialization endpoint once:

```bash
curl https://europe-west2-eventflow-ffb12.cloudfunctions.net/initializeSubscriptionPlans
```

This creates the subscription plan documents in Firestore.

### 3. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 4. Configure Google Pay

1. **Get Google Pay Merchant ID**
   - Visit [Google Pay Business Console](https://pay.google.com/business/console)
   - Complete merchant verification
   - Copy your Merchant ID

2. **Update Google Pay Config**
   - Edit `/public/supplier/js/googlepay-config.js`
   - Replace `merchantId` with your actual Merchant ID
   - Update gateway parameters if using a specific payment gateway

3. **Configure Payment Gateway**
   - The Firebase extension `google-pay/make-payment@0.1.3` handles payment processing
   - Ensure it's properly configured in Firebase Console

### 5. Deploy Frontend

Upload all frontend files to your hosting:

```bash
firebase deploy --only hosting
```

Or if using another hosting provider, upload:
- `/public/supplier/` directory
- Updated `/public/dashboard-supplier.html`
- Updated `/public/assets/css/styles.css`
- Updated `/public/assets/js/app.js`

## Testing

### Test Environment Setup

1. **Use Google Pay Test Cards**
   - Google Pay provides test card numbers for development
   - Visit: https://developers.google.com/pay/api/web/guides/test-and-deploy

2. **Firebase Emulators (Optional)**
   ```bash
   firebase emulators:start
   ```

### Test Scenarios

#### 1. New Subscription Purchase

1. Navigate to `/supplier/subscription.html`
2. Log in as a supplier user
3. Select a subscription plan
4. Click Google Pay button
5. Complete payment with test card
6. Verify:
   - Payment document created in Firestore
   - Supplier document updated with subscription info
   - `onPaymentSuccess` function triggered
   - Dashboard shows Pro/Pro+ badge

#### 2. Trial Period

1. Check Firestore after new subscription
2. Verify `subscription.status` is `'trial'`
3. Verify `subscription.trialEndDate` is correct
4. Wait for trial to end or manually update date
5. Run scheduled function manually:
   ```bash
   firebase functions:shell
   checkSubscriptionStatus()
   ```
6. Verify status changes to `'active'`

#### 3. Subscription Cancellation

1. Go to dashboard subscription card
2. Click "Manage Subscription"
3. Click "Cancel Subscription"
4. Verify:
   - `subscription.autoRenew` set to `false`
   - Status remains active until end date
   - User can still access features

#### 4. Feature Access Control

1. Create supplier with free tier
2. Try to create more than 3 packages
3. Verify limit warning shows
4. Upgrade to Pro
5. Verify package limit increases to 50
6. Verify Pro badge appears on profile

#### 5. Badge Display

1. Create Pro subscription
2. Check supplier listing page (`/suppliers.html`)
3. Verify Pro badge appears next to supplier name
4. Check individual supplier page (`/supplier.html?id=...`)
5. Verify badge appears there too
6. Check dashboard supplier list
7. Verify badge appears consistently

### Manual Testing Checklist

- [ ] Subscription page loads correctly
- [ ] All 4 plans display with correct pricing
- [ ] Google Pay button appears
- [ ] Google Pay button is clickable
- [ ] Payment flow works end-to-end
- [ ] Subscription activates with trial
- [ ] Dashboard shows subscription status
- [ ] Pro badge appears on profiles
- [ ] Pro+ badge appears on profiles
- [ ] Package limit enforced correctly
- [ ] Cancellation works correctly
- [ ] Scheduled status check works
- [ ] Feature access control works
- [ ] Upgrade prompts appear for locked features

## Monitoring

### View Cloud Function Logs

```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only onPaymentSuccess
```

### Check Firestore Data

1. Open [Firebase Console](https://console.firebase.google.com)
2. Navigate to Firestore Database
3. Check collections:
   - `subscriptionPlans` - Should have 4 documents
   - `payments` - Payment transaction records
   - `suppliers` - Check `subscription` field

### Monitor Scheduled Function

The `checkSubscriptionStatus` function runs daily at midnight (London time).

Check logs:
```bash
firebase functions:log --only checkSubscriptionStatus
```

## Troubleshooting

### Payment Not Processing

1. Check browser console for errors
2. Verify Google Pay API loaded: Check for `google.payments` object
3. Check payment document created in Firestore
4. Check `onPaymentSuccess` function logs
5. Verify Firebase extension is active

### Badge Not Showing

1. Check supplier document has `subscription.tier` field
2. Verify supplier document has `subscription.status` of `'active'` or `'trial'`
3. Check browser console for JavaScript errors
4. Clear browser cache
5. Verify CSS loaded correctly

### Feature Access Not Working

1. Check `feature-access.js` imported correctly
2. Check supplier document structure
3. Verify authentication working
4. Check browser console for errors

### Scheduled Function Not Running

1. Verify function deployed successfully
2. Check Cloud Scheduler in GCP Console
3. Manually trigger function for testing:
   ```bash
   firebase functions:shell
   checkSubscriptionStatus()
   ```

## Security Notes

1. **API Keys**: The Firebase API key in client code is safe to expose. Security is enforced via Firestore rules.

2. **Payment Processing**: All payment data is processed through Google Pay's secure infrastructure. We never store card details.

3. **Firestore Rules**: Updated rules ensure:
   - Users can only read their own subscription data
   - Only Cloud Functions can update payment status
   - Subscription plans are read-only for clients

4. **Cloud Functions**: All functions verify user authentication before processing requests.

## Production Checklist

Before going live:

- [ ] Update Google Pay environment to `'PRODUCTION'` in `googlepay-config.js`
- [ ] Replace test merchant ID with production merchant ID
- [ ] Test with real payment methods (small amounts)
- [ ] Set up error alerting (Firebase Crashlytics, Sentry, etc.)
- [ ] Configure backup payment method
- [ ] Set up email notifications for subscription events
- [ ] Test subscription renewal flow
- [ ] Document customer support procedures
- [ ] Train support team on subscription management
- [ ] Set up metrics/analytics tracking
- [ ] Plan communication strategy for customers
- [ ] Review and accept Google Pay terms of service

## Support

For issues with:
- **Google Pay**: https://developers.google.com/pay/api/web/support
- **Firebase Functions**: https://firebase.google.com/support
- **EventFlow**: Contact your development team

## Next Steps

1. Complete payment gateway integration
2. Set up email notifications for subscription events
3. Add analytics tracking for conversion rates
4. Implement webhook handlers for payment updates
5. Add support for discount codes/coupons
6. Implement subscription management API for admin
7. Add reporting dashboard for subscription metrics
