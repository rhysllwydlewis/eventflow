# Badge Lifecycle Management

## Overview

EventFlow automatically manages supplier badges based on subscription tiers. Badges are displayed on supplier profiles and in search results to indicate premium subscription status.

## Badge Types

### Pro Badge

- **Display**: "Pro" badge with distinctive styling
- **Tier**: `pro`
- **Awarded when**: User subscribes to Pro Monthly or Pro Yearly plan
- **Features**:
  - Pro supplier badge on profile
  - Priority listing in search results
  - Up to 50 event bookings per month
  - Email support

### Pro+ Badge

- **Display**: "Pro+" badge with premium styling
- **Tier**: `pro_plus`
- **Awarded when**: User subscribes to Pro+ Monthly or Pro+ Yearly plan
- **Features**:
  - Premium Pro+ badge on profile
  - All Pro features included
  - Unlimited event bookings
  - Advanced analytics dashboard
  - Priority phone support
  - Custom branding options
  - Featured in homepage carousel

## Badge Lifecycle

### 1. Badge Award (On Payment)

When a supplier makes a payment for a Pro or Pro+ subscription:

1. Payment is processed through Google Pay
2. Payment data is written to Firestore `payments` collection
3. Firebase Extension processes the payment
4. Supplier's `subscription.tier` field is set to `pro` or `pro_plus`
5. Badge automatically displays based on `subscription.tier`

**No manual badge management required** - badges are automatically shown based on the tier field.

### 2. Badge Display

Badges are displayed in multiple locations:

- **Supplier Profile Page**: Badge appears next to supplier name
- **Search Results**: Badge appears in supplier card listings
- **Dashboard**: Badge appears in supplier's own dashboard

The badge rendering logic checks `supplier.subscription.tier`:

```javascript
if (s.subscription && s.subscription.tier) {
  const tier = s.subscription.tier;
  if (tier === 'pro') {
    proBadge = '<span class="supplier-badge pro">Pro</span>';
  } else if (tier === 'pro_plus') {
    proBadge = '<span class="supplier-badge pro_plus">Pro+</span>';
  }
}
```

### 3. Badge Removal (On Expiry/Cancellation)

When a subscription expires or is cancelled:

1. Firebase Extension or backend updates supplier document
2. `subscription.tier` is set to `free` or removed
3. `subscription.status` is set to `expired` or `cancelled`
4. Badge automatically stops displaying (no longer matches tier check)

**No manual badge removal required** - badges automatically hide when tier changes.

## Data Model

### Supplier Document

```javascript
{
  id: "supplier123",
  name: "Example Business",
  subscription: {
    tier: "pro",           // 'free', 'pro', or 'pro_plus'
    planId: "pro_monthly",
    status: "active",      // 'active', 'trial', 'expired', 'cancelled'
    startDate: Timestamp,
    endDate: Timestamp,
    autoRenew: true
  },
  badges: ["founding"],    // Optional: Additional badges array
  // ... other fields
}
```

## Current Pricing (Updated)

### Pro Plan

- **Monthly**: £39/month for first 3 months, then £59/month
- **Yearly**: £468/year
- **Trial**: 14 days free
- **Features**: Reduced perks (up to 50 bookings, email support)

### Pro+ Plan

- **Monthly**: £199/month
- **Yearly**: £2,388/year
- **Trial**: 14 days free
- **Features**: All functionality (unlimited bookings, priority support, custom branding, homepage carousel)

## Badge CSS Classes

Badges use these CSS classes (defined in `public/assets/css/styles.css`):

- `.supplier-badge` - Base badge styling
- `.supplier-badge.pro` - Pro tier styling
- `.supplier-badge.pro_plus` - Pro+ tier styling

## Testing Badge Lifecycle

To test the badge lifecycle:

1. **Award Badge**: Subscribe to a plan via subscription page
   - Badge should appear immediately on profile after payment
2. **Display Badge**: Check these locations
   - Supplier profile page
   - Search results
   - Dashboard
3. **Remove Badge**: Cancel subscription or let it expire
   - Badge should disappear when tier changes to 'free'

## Implementation Notes

- Badges are **automatically managed** via the `subscription.tier` field
- No separate badge award/removal functions needed
- The system is **declarative** - badge presence is determined by current tier
- Legacy `isPro` flag is still supported for backwards compatibility
- Additional badges can be stored in the `badges` array for special cases (e.g., "founding")
