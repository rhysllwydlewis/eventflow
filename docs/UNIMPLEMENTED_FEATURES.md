# Planned But Unimplemented Features - Summary

Based on review of FUTURE_IMPROVEMENTS.md, ROADMAP_PROGRESS.md, ADMIN_DASHBOARD_IMPROVEMENTS.md, and docs/90-DAY-ROADMAP.md

## Priority 1: High Impact Features (Ready to Implement)

### 1. Dashboard Analytics & Visualizations 📊

**Status**: Partially complete  
**Missing**:

- Chart.js integration for metrics visualization
- Event metrics chart (timeline of inquiries)
- Budget tracking pie chart
- Supplier performance metrics dashboard
- Lead quality breakdown charts for supplier dashboard

**Files Needed**:

- Enhance existing dashboard HTML files
- Create chart initialization scripts
- Note: chart.js and xlsx already installed

**Impact**: High - Suppliers need ROI visibility to justify staying

---

### 2. Skeleton Loaders & Better Loading States 💀

**Status**: Not implemented  
**Current Issue**: "Loading..." text shows during data fetch

**Needs**:

- Create `public/assets/css/skeleton.css`
- Create `public/assets/js/skeleton-loader.js` (utility exists but not used)
- Replace all "Loading..." text with skeleton UI
- Add fallback content for failed API calls
- Implement proper error boundaries

**Impact**: High - First impression, reduces perceived load time

---

### 3. Supplier Trust Badges & Verification 🎖️

**Status**: Backend ready, frontend missing  
**Backend Complete**:

- `isFounding`, `foundingYear`, `badges` fields exist in data
- Founding supplier seed data created

**Frontend Missing**:

- Display "Founding Supplier" badges on supplier cards
- Show verification badges (email verified, phone verified, business verified)
- Add badge display to supplier profiles
- Add verification flow UI

**Files to Modify**:

- `public/assets/js/app.js` - supplierCard() function
- `public/supplier.html` - Profile page
- Add badge CSS styles

**Impact**: High - Builds trust, differentiates quality suppliers

---

### 4. hCaptcha Integration for Lead Quality 🤖

**Status**: ✅ Implemented (PR: implement-hcaptcha-integration)
**What was done**:

- ✅ hCaptcha widget added to `public/auth.html` registration form
- ✅ hCaptcha widget added to `public/contact.html` contact form
- ✅ Server-side verification via `verifyHCaptcha()` in `routes/auth.js` (register) and `routes/misc.js` (contact)
- ✅ Lead scoring already penalises `captchaPassed: false` (`-50` pts) in `utils/leadScoring.js`
- ✅ Sitekey read from `HCAPTCHA_SITE_KEY` env var via `<meta name="hcaptcha-sitekey">` or `/api/v1/config`
- ✅ Enquiry threads (`routes/threads.js`) already integrate captcha + lead scoring

---

### 5. Lead Quality Display on Supplier Dashboard 📈

**Status**: Backend complete, frontend missing  
**Backend**:

- Lead scoring algorithm implemented ✅
- Scores stored in threads ✅
- Lead quality helper utility exists ✅

**Frontend Missing**:

- Display lead quality badges on each inquiry/message
- Add filter by quality (High/Medium/Low)
- Add sort by lead score
- Show quality breakdown statistics
- Add quality trend visualization

**Files to Modify**:

- `public/assets/js/supplier-messages.js` - Already has placeholder for lead quality
- `public/dashboard-supplier.html` - Add quality filter UI
- Use existing `lead-quality-helper.js`

**Impact**: High - Core differentiator vs. Hitched

---

## Priority 2: Medium Impact Features

### 6. Advanced Image Features 🖼️

**Missing Components**:

- Image lightbox for galleries
- Image zoom on hover/click
- Touch gestures for mobile galleries
- Keyboard navigation for images

**Files to Create**:

- `public/assets/js/components/Lightbox.js`
- `public/assets/js/components/ImageZoom.js`
- Enhance existing `Carousel.js`

**Impact**: Medium - Better UX for photo galleries

---

### 7. Faceted Search & Advanced Filters 🔍

**Current**: Basic category filtering only

**Missing**:

- Multi-facet filtering (category + price + location + amenities)
- Price range slider
- Location-based search with distance
- Search result counts per facet
- Save search preferences

**Impact**: Medium - Improves supplier discoverability

---

### 8. Phone Verification System 📱

**Status**: Not implemented

**Needs**:

- Twilio integration for SMS
- Phone verification flow
- Verification badge display
- Phone number management in settings

**Impact**: Medium - Increases trust, reduces fake accounts

---

### 9. Stripe Payment Integration 💳

**Status**: Stripe library loaded but not integrated

**Missing**:

- Self-serve subscription upgrade flow
- Payment method management
- Billing history page
- Invoices/receipts generation
- Subscription cancellation flow

**Files Needed**:

- Payment routes in server.js
- Stripe webhook handlers
- Payment UI components

**Impact**: Medium-High - Required for monetization

---

## Priority 3: Nice-to-Have Features

### 10. Blog Infrastructure 📝

**Status**: Blog page exists but empty

**Missing**:

- Blog post CMS/editor
- Blog post storage (MongoDB collection)
- Blog listing page
- Blog detail page
- SEO optimization for posts
- Social sharing

---

### 11. Email Templates & Transactional Emails 📧

**Status**: Postmark integrated, templates exist

**Enhancement Needs**:

- Email template editor in admin
- More email types (welcome, verification reminders, lead notifications)
- Email preview before send
- Email analytics

---

### 12. Bulk Operations (Admin) 📦

**Status**: Partially implemented

**Missing**:

- Bulk package operations
- Bulk user operations
- Bulk message sending
- Better selection UI
- Progress indicators for bulk operations

---

### 13. PWA Install Prompt 📲

**Status**: Service worker exists, install prompt missing

**Needs**:

- Add install prompt to HTML pages
- "Add to Home Screen" banner
- Install instructions
- iOS-specific install guide

---

### 14. Export Enhancements 📊

**Status**: Basic exports exist

**Missing**:

- PDF export for reports
- Email delivery of exports
- Scheduled exports
- Custom export templates

---

## Priority 4: Infrastructure Improvements

### 15. Sentry Integration (Frontend) 🔍

**Status**: Backend integrated, frontend missing

**Needs**:

- Add `@sentry/browser` to frontend
- Configure source maps
- Add custom error context
- Test error reporting

---

### 16. API Documentation Updates 📚

**Status**: Swagger exists but incomplete

**Needs**:

- Document new v1/v2 API routes
- Add pagination docs
- Update authentication docs
- Add code examples

---

### 17. More Comprehensive Tests 🧪

**Status**: Basic tests exist

**Missing**:

- E2E tests for supplier dashboard
- E2E tests for messaging system
- E2E tests for payment flow
- Load testing for API endpoints
- Visual regression tests

---

## Quick Wins (Can Implement Immediately)

1. **Add skeleton loaders** (1-2 days)
2. **Display founding supplier badges** (1 day)
3. **Show lead quality on supplier dashboard** (2 days)
4. **Add hCaptcha to forms** (1 day)
5. **Add Chart.js visualizations** (2-3 days)
6. **Install PWA prompt** (1 day)

---

## Recommendations

### For Next Sprint:

1. ✅ Skeleton loaders - Improves first impression
2. ✅ Lead quality display - Core differentiator
3. ✅ Trust badges - Builds credibility
4. ✅ hCaptcha integration - Protects lead quality
5. ✅ Dashboard charts - Shows ROI to suppliers

### For Following Sprint:

1. Stripe payment integration - Enables monetization
2. Phone verification - Reduces fraud
3. Faceted search - Improves discoverability
4. Advanced image features - Better UX

---

**Last Updated**: December 2024  
**Maintained By**: EventFlow Development Team
