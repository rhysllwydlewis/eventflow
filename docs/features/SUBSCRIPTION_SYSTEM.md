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

```javascript
{
  free: {
    price: £0/month,
    features: {
      maxPackages: 3,
      maxBookings: 10,
      messaging: true,
      analytics: false,
      prioritySupport: false,
    }
  },
  pro_monthly: {
    price: £39/month (first 3 months), then £59/month,
    trial: 14 days,
    features: {
      maxPackages: 50,
      maxBookings: 50,
      messaging: true,
      analytics: true,
      prioritySupport: true,
      priorityListing: true,
      badge: 'pro',
    }
  },
  pro_plus_monthly: {
    price: £199/month,
    trial: 14 days,
    features: {
      maxPackages: -1, // unlimited
      maxBookings: -1, // unlimited
      messaging: true,
      analytics: true,
      prioritySupport: true,
      priorityListing: true,
      badge: 'pro_plus',
      customBranding: true,
      homepageCarousel: true,
    }
  },
  pro_yearly: {
    price: £468/year,
    trial: 28 days,
    features: 'Same as pro_monthly'
  },
  pro_plus_yearly: {
    price: £2,388/year,
    trial: 28 days,
    features: 'Same as pro_plus_monthly'
  }
}
```

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

### Payment Document Structure

```javascript
{
  psp: 'googlepay',
  total: 9.99,
  currency: 'GBP',
  paymentToken: {...},
  status: 'pending' | 'success' | 'error',
  userId: 'user123',
  supplierId: 'supplier456',
  planId: 'pro_monthly',
  createdAt: Timestamp,
  processedAt: Timestamp,
  subscriptionActivated: true
}
```

## Subscription Lifecycle

### Status Flow

```
New → Trial → Active → (Expired/Cancelled)
```

### Subscription Document Structure

```javascript
{
  subscription: {
    tier: 'pro' | 'pro_plus' | 'free',
    status: 'trial' | 'active' | 'expired' | 'cancelled',
    planId: 'pro_monthly',
    paymentId: 'payment123',
    startDate: Timestamp,
    endDate: Timestamp,
    trialEndDate: Timestamp,
    autoRenew: true,
    billingCycle: 'monthly' | 'yearly',
    lastUpdated: Timestamp,
    lastChecked: Timestamp,
    cancelledAt?: Timestamp
  }
}
```

## Automated Processes

### Daily Status Check (`checkSubscriptionStatus`)

Runs at midnight (Europe/London) via Cloud Scheduler:

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
# Firebase Functions
SEND_EMAILS=true
APP_BASE_URL=https://eventflow-ffb12.web.app

# Email Service (Postmark)
POSTMARK_API_KEY=your_postmark_server_token
POSTMARK_FROM=admin@event-flow.co.uk
```

### Google Pay Configuration

**Test Mode**: Currently configured with `gateway: 'example'` for testing

**Production Setup**: Update `/public/supplier/js/googlepay-config.js`:

```javascript
// For Stripe
gateway: 'stripe',
gatewayMerchantId: 'your_stripe_merchant_id'

// For Braintree
gateway: 'braintree',
gatewayMerchantId: 'your_braintree_merchant_id'
```

## Limitations & TODOs

### Current Limitations

1. **Automatic Renewals**: Google Pay one-time tokens cannot be reused for recurring billing
   - Users must manually renew when subscription expires
   - Email reminders sent 7 days before expiry

2. **Payment Method Storage**: No payment method tokens stored for future charges
   - Each renewal requires new payment authorization

3. **Failed Payment Retry**: Limited retry logic for failed payments
   - Grace period implemented but no automatic retry

### Recommended Improvements

1. **Implement Recurring Billing**
   - Integrate with Stripe/Braintree for recurring charges
   - Store payment method IDs securely
   - Process automatic renewals

2. **Enhanced Dunning Management**
   - Multiple retry attempts for failed payments
   - Escalating email notifications
   - Smart retry timing (avoid weekends/holidays)

3. **Subscription Analytics**
   - Track churn rates
   - Monitor conversion from trial to paid
   - Revenue reporting

4. **Upgrade/Downgrade Flow**
   - Complete the pro-rated payment processing
   - Immediate plan changes
   - Credit management

## Testing

### Manual Testing Checklist

- [ ] Payment completes successfully
- [ ] Subscription activates in database
- [ ] Dashboard shows correct status
- [ ] Trial countdown displays
- [ ] Renewal date shown correctly
- [ ] Cancellation works
- [ ] Reactivation works
- [ ] Email notifications sent (check logs)
- [ ] Google Pay button renders
- [ ] Plan selection UI works

### Test Accounts

Use Google Pay TEST mode with test cards:

- Test Card: 4111 1111 1111 1111
- Any future expiry date
- Any 3-digit CVV

## Security Considerations

1. **Payment Tokens**: Never log or expose payment tokens
2. **User Verification**: All functions verify user owns supplier account
3. **Input Validation**: All user inputs sanitized
4. **Error Messages**: Generic errors to prevent information leakage
5. **HTTPS Only**: All payment flows over HTTPS

## Support & Troubleshooting

### Common Issues

**"Please log in to view subscription status"**

- User not authenticated - check Firebase Auth state
- Check browser console for errors

**Google Pay button not appearing**

- Google Pay API not loaded - check network tab
- Browser doesn't support Google Pay
- TEST mode requires specific browsers

**Subscription not activating after payment**

- Check Cloud Function logs
- Verify Firebase Extension is installed
- Check payment document in Firestore

**Emails not sending**

- Set `SEND_EMAILS=true` environment variable
- Configure Postmark (see POSTMARK_SETUP.md)
- Check function logs for email errors

### Debug Mode

Enable detailed logging:

```javascript
console.log('Subscription status:', subscription);
console.log('Payment data:', paymentData);
```

## Deployment

### Firebase Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### Frontend

```bash
# Files automatically served from public/
# No build step required for static files
```

### Cloud Scheduler (for checkSubscriptionStatus)

```bash
# Ensure scheduler is enabled
firebase deploy --only functions:checkSubscriptionStatus
```

## Resources

- [Google Pay Web API](https://developers.google.com/pay/api/web)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## License

Part of EventFlow - Event planning made simple.

© 2024 EventFlow. All rights reserved.
