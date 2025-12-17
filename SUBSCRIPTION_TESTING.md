# Subscription System Testing Checklist

## Pre-Deployment Setup

- [ ] Install Firebase Functions dependencies: `cd functions && npm install`
- [ ] Configure environment variables in Firebase Functions
- [ ] Deploy Firebase Functions: `firebase deploy --only functions`
- [ ] Verify Cloud Scheduler is enabled for `checkSubscriptionStatus`
- [ ] (Optional) Configure email service (Mailgun/SendGrid)

## Payment Flow Testing

### Initial Payment
- [ ] Navigate to `/supplier/subscription.html` while logged in
- [ ] Verify Google Pay button appears on plan cards
- [ ] Click Google Pay button and complete test payment
- [ ] Verify payment success message appears
- [ ] Verify redirect to dashboard after 2 seconds
- [ ] Check Firestore `payments` collection for payment document
- [ ] Verify payment document has `subscriptionActivated: true`
- [ ] Check Cloud Function logs for payment processing
- [ ] Verify confirmation email logged (or sent if email configured)

### Subscription Activation
- [ ] Check Firestore `suppliers` collection for updated subscription field
- [ ] Verify subscription has correct tier, status, dates
- [ ] Verify `pro: true` field is set
- [ ] Check supplier dashboard shows subscription status
- [ ] Verify pro ribbon displays at top of dashboard
- [ ] Verify subscription card shows plan name and trial info

## Dashboard Display Testing

### Authentication States
- [ ] Test dashboard while logged out - should show "Please log in"
- [ ] Test dashboard with no supplier profile - should show "Create profile"
- [ ] Test dashboard with free plan - should show upgrade prompt
- [ ] Test dashboard with active subscription - should show plan details

### Subscription Information
- [ ] Verify tier name displays correctly (Pro vs Pro+)
- [ ] Verify status displays (Trial/Active/Expired)
- [ ] Verify trial countdown shows days remaining
- [ ] Verify renewal date formatted correctly (e.g., "15 January 2024")
- [ ] Verify auto-renew status displayed
- [ ] Verify "Manage Subscription" button appears

## Trial Period Testing

### During Trial
- [ ] Create new subscription with trial period
- [ ] Verify status shows "Trial"
- [ ] Verify days remaining counts down
- [ ] Verify trial end date displayed
- [ ] Verify access to premium features

### Trial Ending (requires time manipulation or Cloud Function trigger)
- [ ] Trigger `checkSubscriptionStatus` function manually
- [ ] Verify trial ending reminder sent at 3 days before
- [ ] Check email logs for trial ending notification
- [ ] Verify status changes from Trial to Active when trial ends

## Renewal System Testing

### Renewal Reminders
- [ ] Set subscription end date to 7 days in future
- [ ] Trigger `checkSubscriptionStatus` function
- [ ] Verify renewal reminder email logged/sent
- [ ] Check email content shows correct renewal date
- [ ] Verify different messages for auto-renew vs manual

### Auto-Renew Expiration
- [ ] Set subscription end date to past with `autoRenew: true`
- [ ] Trigger `checkSubscriptionStatus` function
- [ ] Verify subscription status changes to "expired"
- [ ] Verify tier changes to "free"
- [ ] Verify `pro: false` is set
- [ ] Verify failed payment email logged/sent

### Manual Renewal (No Auto-Renew)
- [ ] Set subscription `autoRenew: false`
- [ ] Set end date within 14 days
- [ ] Reload subscription page
- [ ] Verify renewal prompt appears with warning
- [ ] Verify "Renew Now" button displayed
- [ ] Click through to payment flow

## Cancellation Testing

### Cancel Subscription
- [ ] Go to subscription management page
- [ ] Click "Cancel Subscription" button
- [ ] Verify confirmation dialog appears with end date
- [ ] Confirm cancellation
- [ ] Verify success message displays
- [ ] Verify page reloads after 2 seconds

### Post-Cancellation State
- [ ] Check Firestore - verify `autoRenew: false`
- [ ] Check Firestore - verify `cancelledAt` timestamp set
- [ ] Verify cancellation email logged/sent
- [ ] Reload dashboard - verify shows "Cancelled - Access until [date]"
- [ ] Verify premium features still accessible until end date
- [ ] Verify "Reactivate Subscription" button appears

### Reactivation
- [ ] Click "Reactivate Subscription" button
- [ ] Verify confirmation dialog
- [ ] Confirm reactivation
- [ ] Verify success message
- [ ] Check Firestore - verify `autoRenew: true`
- [ ] Check Firestore - verify `cancelledAt: null`
- [ ] Verify subscription status updated on dashboard

## Email Notification Testing

### Payment Confirmation
- [ ] Complete payment successfully
- [ ] Check Cloud Function logs for email send
- [ ] Verify email contains plan name, price, trial info
- [ ] Verify email contains correct renewal date
- [ ] Verify email contains feature list
- [ ] Verify links work (dashboard, manage subscription)

### Trial Ending
- [ ] Trigger 3 days before trial end
- [ ] Verify email sent with correct days remaining
- [ ] Verify email explains billing will start
- [ ] Verify manage subscription link works

### Renewal Reminder (Auto-Renew)
- [ ] Trigger 7 days before renewal
- [ ] Verify email states auto-renewal
- [ ] Verify email shows renewal date and amount
- [ ] Verify "no action needed" message present

### Renewal Reminder (Manual)
- [ ] Trigger 7 days before expiry with autoRenew: false
- [ ] Verify email urges manual renewal
- [ ] Verify "Renew Now" CTA button present
- [ ] Verify link goes to subscription page

### Payment Failed
- [ ] Trigger payment failure scenario
- [ ] Verify email explains payment failed
- [ ] Verify grace period end date shown
- [ ] Verify "Update Payment Method" CTA present

### Cancellation Confirmation
- [ ] Cancel subscription
- [ ] Verify cancellation email sent
- [ ] Verify email shows access end date
- [ ] Verify email explains what happens next
- [ ] Verify "Reactivate" link present

## Edge Cases & Error Handling

### Multiple Suppliers
- [ ] User with multiple supplier profiles
- [ ] Verify subscription status shows for first supplier
- [ ] Verify correct supplier data used

### Expired Subscriptions
- [ ] Subscription past end date with autoRenew: false
- [ ] Verify status shows "Expired"
- [ ] Verify tier changes to "free"
- [ ] Verify dashboard shows upgrade prompt

### Invalid States
- [ ] Subscription without end date
- [ ] Subscription without plan ID
- [ ] Subscription with unknown plan ID
- [ ] Verify graceful error handling

### API Errors
- [ ] Simulate Firestore read/write errors
- [ ] Verify error messages displayed to user
- [ ] Verify errors logged to Cloud Functions
- [ ] Verify system doesn't crash

## Cloud Functions Testing

### onPaymentSuccess
- [ ] Manually create payment document in Firestore
- [ ] Update with `status: 'success'`
- [ ] Verify function triggers and processes
- [ ] Check logs for detailed execution
- [ ] Verify supplier subscription created

### checkSubscriptionStatus
- [ ] Manually trigger via Cloud Scheduler
- [ ] Or trigger via Firebase console
- [ ] Verify batch processing of multiple suppliers
- [ ] Check logs for each subscription checked
- [ ] Verify correct status updates

### cancelSubscription
- [ ] Call via Firebase SDK or REST API
- [ ] Verify authentication required
- [ ] Verify ownership validation
- [ ] Verify subscription updated correctly

### getSubscriptionStatus
- [ ] Call with valid supplier ID
- [ ] Verify returns correct subscription data
- [ ] Verify days remaining calculated correctly
- [ ] Test with no subscription (free tier)

## UI/UX Testing

### Subscription Page
- [ ] Test on desktop browser
- [ ] Test on mobile browser
- [ ] Verify plan cards display correctly
- [ ] Verify tabs switch between monthly/yearly
- [ ] Verify "Current Plan" badge appears correctly
- [ ] Verify Google Pay button renders properly
- [ ] Test responsive design at various widths

### Dashboard
- [ ] Test subscription card layout
- [ ] Verify pro ribbon displays correctly
- [ ] Test with different subscription states
- [ ] Verify dates format correctly
- [ ] Test button interactions

### Loading States
- [ ] Verify loading spinner appears during payment
- [ ] Verify loading overlay during cancellation
- [ ] Verify loading during reactivation

### Notifications
- [ ] Verify success notifications appear
- [ ] Verify error notifications appear
- [ ] Verify notifications auto-dismiss after 5s
- [ ] Verify notification styling (colors, position)

## Performance Testing

- [ ] Test with 100+ suppliers in database
- [ ] Verify `checkSubscriptionStatus` completes in reasonable time
- [ ] Check Cloud Function execution times
- [ ] Verify Firestore read/write quotas not exceeded

## Security Testing

- [ ] Attempt to cancel another user's subscription
- [ ] Attempt to access subscription status for another supplier
- [ ] Verify all API calls require authentication
- [ ] Verify payment tokens not exposed in logs
- [ ] Test XSS in email templates with malicious input

## Documentation Testing

- [ ] Read through SUBSCRIPTION_SYSTEM.md
- [ ] Verify all code examples work
- [ ] Verify deployment instructions accurate
- [ ] Verify configuration examples correct

## Production Readiness

- [ ] Replace 'example' PSP with actual gateway (Stripe/Braintree)
- [ ] Configure production Google Pay merchant ID
- [ ] Set up production email service
- [ ] Configure environment variables for production
- [ ] Set SEND_EMAILS=true
- [ ] Test with real (non-test) payment card
- [ ] Verify SSL certificates valid
- [ ] Set up monitoring/alerting for Cloud Functions
- [ ] Plan for handling failed renewals at scale

## Post-Deployment Monitoring

- [ ] Monitor Cloud Function error rates
- [ ] Track successful payments vs failed
- [ ] Monitor email delivery rates
- [ ] Track subscription conversion rates
- [ ] Monitor trial-to-paid conversion
- [ ] Set up alerts for critical errors

## Notes

- Most testing requires a deployed Firebase environment
- Email testing can be done by checking Cloud Function logs if email service not configured
- Use Firebase Emulator Suite for local testing where possible
- Document any bugs found during testing
- Update this checklist as needed based on findings
