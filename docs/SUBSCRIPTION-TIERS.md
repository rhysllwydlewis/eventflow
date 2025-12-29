# Subscription Tiers Documentation

## Overview

EventFlow offers three clear subscription tiers designed to support suppliers at every stage of their business growth. Our pricing is **transparent, fair, and commission-free** — unlike competitors who take 10-20% of each booking.

## Core Pricing Philosophy

✅ **No commission on bookings** — All revenue from your customers is 100% yours
✅ **Monthly billing only** — No annual lock-ins or hidden contracts
✅ **Cancel anytime** — One-click cancellation, no questions asked
✅ **Your data stays yours** — Export everything if you leave
✅ **First month guarantee** — Not happy? We'll refund your first month

---

## FREE Tier (£0/month)

### Who It's For

- New suppliers testing the platform
- Occasional suppliers (< 5 enquiries/month)
- Budget-conscious businesses

### Features

- ✅ Basic supplier profile
- ✅ Up to 5 photos
- ✅ Receive enquiries (no lead scoring)
- ✅ Standard listing in search results
- ✅ Email support (48-hour response)

### Limitations

- No lead quality indicators
- No priority placement
- Basic profile only (no badges, no analytics)
- Photo limit (5 photos)

### Upgrade Path

When you start receiving regular enquiries and want to improve lead quality, upgrade to **Pro**.

---

## PRO Tier (£49/month for 3 months, then £99/month)

### Who It's For

- Serious suppliers wanting to grow
- Businesses receiving 10+ enquiries/month
- Suppliers who value lead quality and analytics

### Features

**Everything in Free, plus:**

#### Lead Quality (🔥 Core Differentiator)

- ✅ **Lead quality scoring** (High/Medium/Low ratings)
- ✅ See enquiry completeness (budget, guest count, timeline)
- ✅ Spam and bot detection
- ✅ Email quality indicators

#### Visibility

- ✅ **Priority placement** in search results (top 50% of listings)
- ✅ Unlimited photos
- ✅ Featured in relevant category pages

#### Trust Signals

- ✅ **Email verification badge** (✓ Email Verified)
- ✅ **Phone verification badge** (✓ Phone Verified)
- ✅ Response time tracking and display

#### Analytics

- ✅ **Profile analytics dashboard**
  - Profile views (7/30/90 days)
  - Enquiry volume trends
  - Response rate tracking
  - Lead quality breakdown
- ✅ Response time metrics
- ✅ Profile completeness score

#### Support

- ✅ **Priority support** (24-hour response)
- ✅ Phone & email support

### Pricing

- **Trial**: £49/month for first 3 months
- **Standard**: £99/month after trial
- **Savings**: Save £150 during 3-month trial period

### ROI Justification

If Pro features help you:

- Close just **1 additional booking** per month, it pays for itself
- Save **2 hours** not chasing low-quality leads (time = money)
- Improve conversion by **10%** through trust badges

**Average Pro subscriber sees**:

- 2.5x more profile views
- 40% higher enquiry quality scores
- 25% better response rates from trust signals

---

## FEATURED Tier (£199/month)

### Who It's For

- Established suppliers wanting maximum visibility
- Premium brands targeting high-value clients
- Suppliers in competitive categories (London venues, top photographers)

### Features

**Everything in Pro, plus:**

#### Maximum Visibility

- ✅ **Homepage featured carousel placement**
- ✅ **Top of category pages** (top 3 positions)
- ✅ **"Featured" badge** on all listings
- ✅ Priority in all search results

#### Premium Trust Signals

- ✅ **Business verification badge** (✓ Business Verified)
  - Upload business registration/insurance
  - Manual review within 48 hours
  - Highest trust signal available

#### VIP Support & Services

- ✅ **Dedicated onboarding call** (30 minutes with account manager)
- ✅ **Monthly performance review** (analytics deep-dive)
- ✅ **Priority support** (4-hour response, weekdays)
- ✅ Direct phone line to support team

#### Advanced Analytics

- ✅ **Export analytics to CSV** (for your own reporting)
- ✅ Competitor benchmarking (anonymous comparison)
- ✅ Seasonal trends analysis
- ✅ ROI tracking tools

### Pricing

- **£199/month** (no trial discount — premium tier)
- **Annual option**: £1,990/year (save £398 — 2 months free)

### ROI Justification

Featured placement typically delivers:

- **5-10x more profile views** vs Free tier
- **3-4x more enquiries** vs Pro tier
- Average Featured supplier books **2-3 additional events/month**

If your average booking is £2,000+, **Featured pays for itself with 1 extra booking every 10 days**.

---

## Comparison Table

| Feature                     | Free       | Pro (£49→£99) | Featured (£199) |
| --------------------------- | ---------- | ------------- | --------------- |
| Profile & Photos            | ✅ (5 max) | ✅ Unlimited  | ✅ Unlimited    |
| Receive Enquiries           | ✅         | ✅            | ✅              |
| Lead Quality Scoring        | ❌         | ✅            | ✅              |
| Email Verification Badge    | ❌         | ✅            | ✅              |
| Phone Verification Badge    | ❌         | ✅            | ✅              |
| Business Verification Badge | ❌         | ❌            | ✅              |
| Priority Search Placement   | ❌         | ✅            | ✅ (Top 3)      |
| Homepage Featured Carousel  | ❌         | ❌            | ✅              |
| Profile Analytics Dashboard | ❌         | ✅            | ✅              |
| Export Analytics (CSV)      | ❌         | ❌            | ✅              |
| Response Time Tracking      | ❌         | ✅            | ✅              |
| Support Response Time       | 48 hours   | 24 hours      | 4 hours         |
| Onboarding Call             | ❌         | ❌            | ✅              |
| Monthly Performance Review  | ❌         | ❌            | ✅              |

---

## Upgrade/Downgrade Rules

### Upgrading

- **Takes effect immediately**
- Charged prorated amount for remainder of billing period
- All new features unlock instantly
- No disruption to existing enquiries or data

### Downgrading

- **Takes effect at end of current billing period**
- Prorated credit applied to account
- Features removed gracefully (e.g., photos beyond limit are hidden, not deleted)
- No data loss — all enquiries, messages, and analytics retained

### Cancelling

- **Cancel anytime** with one click in dashboard
- Account reverts to Free tier (not deleted)
- Keep all historical data (enquiries, messages, analytics)
- Can re-subscribe anytime (no penalties)

---

## Implementation Details

### Database Schema

Add to Supplier model (`models/index.js`):

```javascript
{
  // ... existing fields
  subscription: {
    tier: { bsonType: 'string' },              // 'free', 'pro', 'featured'
    status: { bsonType: 'string' },            // 'active', 'trialing', 'canceled', 'past_due'
    trialEndsAt: { bsonType: 'date' },         // When trial ends (null if not trialing)
    currentPeriodStart: { bsonType: 'date' },
    currentPeriodEnd: { bsonType: 'date' },
    cancelAtPeriodEnd: { bsonType: 'bool' },   // If user has requested cancellation
    stripeSubscriptionId: { bsonType: 'string' },
    stripeCustomerId: { bsonType: 'string' },
    pricePerMonth: { bsonType: 'number' }      // Current price in pence (4900, 9900, 19900)
  },
  subscriptionHistory: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      properties: {
        tier: { bsonType: 'string' },
        startDate: { bsonType: 'date' },
        endDate: { bsonType: 'date' },
        reason: { bsonType: 'string' }         // 'upgrade', 'downgrade', 'trial_end', 'cancel'
      }
    }
  }
}
```

### Stripe Configuration

#### Products

Create 3 products in Stripe:

1. **Free** — No Stripe product (native to platform)
2. **Pro Trial** — £49/month recurring (3 cycles)
3. **Pro Standard** — £99/month recurring
4. **Featured** — £199/month recurring

#### Prices

- Price IDs stored in environment variables:
  ```bash
  STRIPE_PRICE_PRO_TRIAL=price_xxxxxxxxxxxxx
  STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
  STRIPE_PRICE_FEATURED=price_xxxxxxxxxxxxx
  ```

#### Subscription Logic

```javascript
// When user upgrades to Pro
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [
    {
      price: process.env.STRIPE_PRICE_PRO_TRIAL,
      quantity: 1,
    },
  ],
  trial_end: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
  metadata: {
    supplierId: supplier.id,
    tier: 'pro',
  },
});

// After 3 months, Stripe automatically switches to standard price
// (configured in Stripe Dashboard with phase transitions)
```

### Feature Gating Middleware

```javascript
// middleware/subscriptionCheck.js
function requireTier(minTier) {
  const tierLevels = { free: 0, pro: 1, featured: 2 };

  return async (req, res, next) => {
    const supplier = await getSupplier(req.user.id);
    const userTier = supplier.subscription?.tier || 'free';

    if (tierLevels[userTier] >= tierLevels[minTier]) {
      return next();
    }

    return res.status(403).json({
      error: 'Upgrade required',
      message: `This feature requires ${minTier.toUpperCase()} tier`,
      upgradeUrl: '/dashboard/upgrade',
    });
  };
}

// Usage
app.get('/api/analytics/export', requireTier('featured'), exportAnalytics);
```

---

## Marketing & Positioning

### Key Messages

**For Free Tier Users:**

> "Start for free, upgrade when you're ready. No credit card required."

**For Pro Conversion:**

> "Stop wasting time on junk leads. Pro tier shows you lead quality scores so you can prioritize the best opportunities."

**For Featured Conversion:**

> "Get 5-10x more visibility. Featured suppliers appear at the top of every search and on the homepage."

### Upgrade CTAs in Dashboard

**When Free user receives 10+ enquiries/month:**

```
🎯 You received 12 enquiries this month!

Upgrade to Pro to see which ones are highest quality.
Pro members save 2+ hours/week by focusing on serious leads first.

[Upgrade to Pro - £49 for 3 months] [Learn More]
```

**When Pro user has high engagement:**

```
🚀 Your profile had 450 views last month!

Featured members in your category get 3-4x more enquiries.
Get homepage placement and top-of-search positioning.

[Upgrade to Featured - £199/month] [See Benefits]
```

---

## A/B Testing Opportunities

### Trial Pricing Test

- **Control**: £49 for 3 months → £99
- **Variant A**: £39 for 3 months → £99
- **Variant B**: £49 for 1 month → £99

**Measure**: Trial signup rate, trial-to-paid conversion

### Feature Bundling Test

- **Control**: Lead scoring in Pro
- **Variant**: Lead scoring in Free, analytics in Pro only

**Measure**: Free-to-Pro conversion rate, churn rate

---

## FAQ for Internal Team

**Q: Why no annual plans at launch?**
A: Simplicity. Monthly-only removes friction and builds trust. Add annual (with 2-month discount) once we have 100+ paying customers.

**Q: Why 3-month trial instead of 1 month?**
A: Wedding industry is slow-moving. Suppliers need 2-3 months to see meaningful results (seasonal variation, booking timelines). Longer trial = better retention.

**Q: What if competitors copy our lead scoring?**
A: We're first-to-market. Build brand around it. Even if copied, we have head start on algorithm refinement and supplier trust.

**Q: Should we offer discounts for annual prepayment?**
A: Not at launch. Prioritize cash flow and learning. Add once we have 50+ paying monthly subscribers and understand retention.

---

**Last Updated**: December 2025
**Version**: 1.0
**Owner**: Product Team
