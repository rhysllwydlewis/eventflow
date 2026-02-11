# Subscription System Implementation Guide

## Overview

The EventFlow subscription system provides a complete payment and subscription management solution for supplier accounts using Stripe integration. Google Pay has been removed in favor of Stripe's comprehensive payment solution.

## Architecture

### Components

1. **Frontend (Public Pages)**
   - `/public/supplier/subscription.html` - Subscription management page
   - `/public/supplier/js/subscription.js` - Subscription logic (Stripe integration)
   - `/public/supplier/js/feature-access.js` - Feature access control
   - `/public/dashboard-supplier.html` - Supplier dashboard with subscription status

2. **Backend (Express Routes)**
   - `/routes/subscriptions-v2.js` - RESTful API for subscriptions
   - `/services/subscriptionService.js` - Business logic
   - `/services/paymentService.js` - Stripe payment processing
   - `/middleware/subscriptionGate.js` - Feature gating middleware

3. **Webhooks**
   - `/webhooks/stripeWebhookHandler.js` - Stripe event processing

4. **Models**
   - `/models/Subscription.js` - Subscription schema and feature definitions

## Subscription Plans

### Available Plans

#### Free
- **Price**: £0/month
- **Features**:
  - Up to 3 packages
  - Up to 10 event bookings per month
  - Messaging enabled
  - No analytics
  
#### Pro Monthly
- **Price**: £39/month for first 3 months, then £59/month
- **Trial**: 14 days free
- **Features**:
  - Pro supplier badge on profile
  - Priority listing in search results
  - Up to 50 packages
  - Up to 50 event bookings per month
  - Messaging enabled
  - Advanced analytics dashboard
  - Priority email support

#### Pro+ Monthly
- **Price**: £199/month
- **Trial**: 14 days free
- **Features**:
  - Premium Pro+ badge on profile
  - All Pro features
  - Unlimited packages
  - Unlimited bookings
  - Advanced analytics dashboard
  - Priority phone support
  - Custom branding options
  - Featured in homepage carousel

#### Pro Yearly
- **Price**: £468/year (save £240 vs monthly)
- **Trial**: 28 days free
- Same features as Pro Monthly

#### Pro+ Yearly
- **Price**: £2,388/year
- **Trial**: 28 days free
- Same features as Pro+ Monthly

## Payment Flow

### Stripe Integration

1. **User selects plan** → `subscription.html`
2. **Clicks Subscribe button** → `POST /api/v2/subscriptions`
3. **Backend creates Stripe subscription** → Returns checkout URL
4. **Stripe redirects** → Hosted checkout page
5. **User completes payment** → Stripe processes
6. **Stripe webhook** → `customer.subscription.created` event
7. **Backend activates** → Subscription record created/updated
8. **User redirected** → Dashboard with active subscription

## Subscription Lifecycle

### Status Flow

```
New → Trial → Active → (Expired/Cancelled)
```

### Subscription Document Structure

```javascript
{
  id: 'sub_xxx',
  userId: 'user123',
  plan: 'pro' | 'pro_plus' | 'free',
  status: 'active' | 'trialing' | 'past_due' | 'canceled',
  stripeSubscriptionId: 'sub_stripe_xxx',
  stripeCustomerId: 'cus_stripe_xxx',
  currentPeriodStart: '2024-01-01T00:00:00.000Z',
  currentPeriodEnd: '2024-02-01T00:00:00.000Z',
  trialEnd: '2024-01-15T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}
```

## Automated Processes

### Stripe Webhooks

Webhook events processed automatically:

1. **Check trial expiration** → Move from 'trial' to 'active'
2. **Check subscription expiration** → Expire if past end date
3. **Send renewal reminders** → 7 days before expiry
4. **Send trial ending reminders** → 3 days before trial ends
5. **Handle auto-renewal** → Process renewal (manual intervention required for now)

### Email Notifications

| Event                  | Timing        | Template                      |
| ---------------------- | ------------- | ----------------------------- |
| Subscription activated | Immediate     | subscription-activated        |
| Trial ending           | 3 days before | subscription-trial-ending     |
| Renewal reminder       | 7 days before | subscription-renewal-reminder |
| Payment failed         | Immediate     | subscription-payment-failed   |
| Cancellation           | Immediate     | subscription-cancelled        |

## Cloud Functions

### `onPaymentSuccess`

**Trigger**: Firestore document update on `payments/{paymentId}`

**Actions**:

1. Validate payment status
2. Calculate dates (trial, renewal)
3. Update supplier document with subscription
4. Send confirmation email
5. Mark payment as processed

### `checkSubscriptionStatus`

**Trigger**: Scheduled (daily at midnight)

**Actions**:

1. Query active/trial subscriptions
2. Check expiration dates
3. Update statuses
4. Send reminder emails

### `cancelSubscription`

**Trigger**: HTTPS callable function

**Actions**:

1. Verify user authentication
2. Verify user owns supplier
3. Disable auto-renewal
4. Set cancellation date
5. Send confirmation email

### `updateSubscription`

**Trigger**: HTTPS callable function

**Actions**:

1. Verify user authentication
2. Calculate pro-rated amount
3. Update subscription plan
4. (TODO: Process payment difference)

## Configuration

### Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_PRO_PLUS_PRICE_ID=price_xxxxx
```

## Feature Gating

### Server-Side Checks

```javascript
const subscriptionService = require('../services/subscriptionService');

// Check feature access
const hasAnalytics = await subscriptionService.checkFeatureAccess(userId, 'analytics');

// Get user features
const features = await subscriptionService.getUserFeatures(userId);
```

### Middleware Protection

```javascript
const { requireSubscription } = require('../middleware/subscriptionGate');

router.post('/advanced-feature', requireSubscription('pro'), async (req, res) => {
  // Protected route
});
```

## Testing

### Test Cards

- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0025 0000 3155
