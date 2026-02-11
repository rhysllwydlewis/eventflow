# Subscription System Quick Reference

## Pricing at a Glance

| Plan | Monthly   | Yearly | Trial      | Packages  | Bookings  |
| ---- | --------- | ------ | ---------- | --------- | --------- |
| Free | £0        | -      | -          | 3         | 10        |
| Pro  | £39→£59\* | £468   | 14/28 days | 50        | 50        |
| Pro+ | £199      | £2,388 | 14/28 days | Unlimited | Unlimited |

\*£39/mo for first 3 months, then £59/mo

## Common Gotchas

❌ **Don't** use sync supplierIsProActive() - it's now async
✅ **Do** use await supplierIsProActive()

❌ **Don't** check user.isPro flag directly - it may be stale
✅ **Do** use subscriptionService.getSubscriptionByUserId()

See full guide at docs/STRIPE_SUBSCRIPTION_GUIDE.md
