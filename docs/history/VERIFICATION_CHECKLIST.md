# Verification Checklist for Homepage PR

## 1. Fallback Stats Removed ✅

**Fixed in commit 7a8c451**

**Verification:**

```bash
# Stats section should hide gracefully on API failure
curl http://localhost:3000/api/public/stats
# If 404 or error: Stats section hidden (no fake 100/75/30/200 values)
```

**Code change:**

- Removed hardcoded `fallbackStats` object
- Added `hideStatsSection()` function
- Stats section now `display: none` on API failure

---

## 2. Route Conflicts Resolved ✅

**Fixed in commit 7a8c451**

**Verification:**

```bash
# Test both endpoints work without conflicts
curl http://localhost:3000/api/reviews?limit=1
curl http://localhost:3000/api/v2/reviews/supplier/:id
```

**Route ownership:**

- `/api/reviews` → routes/index.js (homepage testimonials)
- `/api/v2/reviews` → server.js (v2 API endpoints)
- No duplicate mounting

---

## 3. Newsletter Collection Naming ✅

**Fixed in commit 7a8c451**

**Verification:**

```bash
# Check store.js uses consistent camelCase
grep "newsletterSubscribers" store.js routes/newsletter.js
```

**Files updated:**

- `store.js`: Changed to `newsletterSubscribers.json` (camelCase)
- `routes/newsletter.js`: Uses `newsletterSubscribers` (camelCase)
- Consistent across all files

---

## 4. SEO Canonical Protection ✅

**Fixed in commit 7a8c451**

**Verification - Browser DevTools:**

```javascript
// Open homepage in browser
// Open DevTools Console
// Check canonical and og:url
document.querySelector('link[rel="canonical"]').href;
document.querySelector('meta[property="og:url"]').content;

// Expected on production:
// https://event-flow.co.uk/ (or https://event-flow.co.uk/path)

// Expected on localhost/staging:
// Should preserve production URLs if already set
// Should NOT overwrite with localhost origin
```

**Protection details:**

- Preserves `https://event-flow.co.uk/` (non-www)
- Does NOT preserve `https://www.event-flow.co.uk/` (www variant)
- Prevents bypass like `https://event-flow.co.uk.evil.com`

---

## 5. Security Review - GET /api/reviews ✅

**Fixed in commit 7a8c451**

**Verification:**

```bash
# Test endpoint returns only safe fields
curl http://localhost:3000/api/reviews?limit=1 | jq '.reviews[0]'
```

**Expected response (safe fields only):**

```json
{
  "customerName": "Sarah Johnson",
  "supplierName": "Elegant Venues Ltd",
  "rating": 5,
  "comment": "Outstanding service...",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

**Explicitly excluded (sensitive fields):**

- ❌ email
- ❌ userId / authorId
- ❌ ipAddress
- ❌ userAgent
- ❌ moderation flags (approved, rejected, spam, etc.)
- ❌ dispute data
- ❌ internal IDs

**Security guarantees:**

- Server-side `approved === true` filter enforced
- No query parameter can bypass approval check
- Safe field projection in map function

---

## Manual Testing Checklist

### Newsletter Flow

- [ ] Subscribe with valid email → 200 response
- [ ] Subscribe with invalid email → 400 error
- [ ] Check `data/newsletterSubscribers.json` created
- [ ] Check email saved in `outbox/` folder
- [ ] Verify confirmation token in email
- [ ] Click confirmation link → redirect to `/newsletter/confirmed.html`
- [ ] Try expired token → redirect to `/newsletter/expired.html`

### Stats Section

- [ ] Homepage loads with stats visible
- [ ] If `/api/public/stats` fails → stats section hidden
- [ ] No hardcoded fallback values shown

### Testimonials Section

- [ ] Homepage loads testimonials from `/api/reviews`
- [ ] Only approved reviews displayed
- [ ] If no reviews → section hidden gracefully
- [ ] Proper HTML escaping (no XSS)

### SEO Canonicals

- [ ] Homepage: canonical = `https://event-flow.co.uk/`
- [ ] Marketplace: canonical = `https://event-flow.co.uk/marketplace`
- [ ] localhost/staging preserves production URLs

---

## Production Deployment Notes

1. **Environment variables required:**

   ```bash
   POSTMARK_API_KEY=...
   POSTMARK_FROM=admin@event-flow.co.uk
   BASE_URL=https://event-flow.co.uk
   NEWSLETTER_CONFIRM_BASE_URL=https://event-flow.co.uk
   ```

2. **MongoDB/Storage:**
   - Production should use MongoDB (set `MONGODB_URI`)
   - `newsletterSubscribers` collection auto-created on first subscription
   - Consider creating indexes:
     ```javascript
     db.newsletterSubscribers.createIndex({ email: 1 }, { unique: true });
     db.newsletterSubscribers.createIndex({ confirmToken: 1 });
     ```

3. **Rate limiting:**
   - Newsletter endpoint: 5 req/hour per IP
   - Ensure production IP detection works (TRUST_PROXY setting)

4. **Email delivery:**
   - Test confirmation emails reach inbox
   - Check SPF/DKIM records for domain
   - Monitor Postmark delivery rates
