# Backend APIs Status

This document tracks frontend features and their backend API implementation status.

**Last Updated:** February 2026 (Phase 3–4 additions documented)

---

## ✅ IMPLEMENTED: Supplier Analytics API

**Frontend Location:** `public/assets/js/supplier-analytics-chart.js` (line 260)

**Status:** ✅ Now fully implemented with real backend API

**Backend Endpoint:** `GET /api/me/suppliers/:id/analytics?period=7|30|90`

**Response Format:**

```json
{
  "period": 7,
  "labels": ["1 Jan", "2 Jan", "3 Jan", ...],
  "views": [45, 52, 38, ...],
  "enquiries": [3, 5, 2, ...],
  "totalViews": 280,
  "totalEnquiries": 24,
  "responseRate": 85,
  "avgResponseTime": 4.5
}
```

**Implementation Details:**

- ✅ Reads from `analytics` collection in database
- ✅ Calculates response metrics from `messages` collection
- ✅ Supports 7/30/90 day periods
- ✅ Fallback to mock data if supplier ID not available or API fails
- ⚠️ Requires analytics tracking to be implemented (views/enquiries not yet captured)

### Analytics Tracking TODO

To populate real analytics data, implement tracking for:

1. **Profile Views** - Track when users view supplier profiles
2. **Enquiries** - Track when users send enquiries/messages to suppliers

Example analytics record format:

```json
{
  "supplierId": "sup_123",
  "date": "2026-01-15",
  "views": 45,
  "enquiries": 3
}
```

---

## ✅ IMPLEMENTED: Lead Quality API (Phase 3)

**Frontend Location:** `public/assets/js/supplier-messages.js`, `public/assets/js/lead-quality-helper.js`

**Status:** ✅ Implemented

**Backend Endpoints:**

- `GET /api/me/leads` — List leads with quality scores
- Lead scores stored in thread documents (`leadScore`, `leadQuality` fields)

**Implementation Details:**

- ✅ Lead scoring algorithm in `utils/leadScoring.js`
- ✅ Scores calculated on thread creation
- ✅ Quality badge (High/Medium/Low) displayed on supplier dashboard

---

## ✅ IMPLEMENTED: Marketplace Listings API (Phase 4)

**Frontend Location:** `public/assets/js/marketplace.js`

**Status:** ✅ Core listing CRUD implemented

**Backend Endpoints:**

- `GET /api/v1/marketplace/listings` — List/search listings (category, condition, price, keyword, sort)
- `POST /api/v1/marketplace/listings` — Create listing (auth required)
- `PATCH /api/v1/marketplace/listings/:id` — Update listing (auth required)
- `DELETE /api/v1/marketplace/listings/:id` — Delete listing (auth required)
- `GET /api/v1/marketplace/listings/:id` — Get single listing

**Notes:**

- ⚠️ Location/distance filter is a stub — see `docs/MARKETPLACE_FILTER_STATUS.md`

---

## ✅ IMPLEMENTED: Supplier Search V2 API (Phase 4)

**Frontend Location:** Supplier listing pages, search bar

**Status:** ✅ Implemented with caching and analytics

**Backend Endpoint:** `GET /api/v2/search/suppliers`

**Supported filters:** category, location, price range, rating, amenities, guest count, pro/featured/verified flags, and multiple sort options

**Notes:**

- ⚠️ Distance sort (`sortBy=distance`) falls back to relevance — see `docs/MARKETPLACE_FILTER_STATUS.md`

---

## ✅ IMPLEMENTED: PWA Manifest & Service Worker (Phase 3/4)

**Frontend Location:** All HTML pages

**Status:** ✅ Implemented

**Endpoints:**

- `GET /manifest.json` — PWA web app manifest
- Service worker registered for offline support

---

## 🟡 Enhancement: Photo Management APIs

**Frontend Location:** `public/assets/js/supplier-photo-upload.js`

**Status:** Partially implemented

### Currently Available:

- ✅ POST `/api/me/suppliers/:id/photos` - Upload photo (uses base64 encoding, stores locally in /uploads)

### Missing:

- ❌ GET `/api/me/suppliers/:id/photos` - List photos
- ❌ DELETE `/api/me/suppliers/:id/photos/:photoId` - Delete specific photo

**Current Storage Architecture:**

- Photo files: Stored locally in `/uploads/{ownerType}/{ownerId}/` directory
- Photo metadata: Stored in MongoDB in supplier document's `photosGallery` array
- Format: `{ url: string, approved: boolean, uploadedAt: timestamp }`

**Current Workaround:** Photos are stored in supplier's `photosGallery` array and accessed via supplier GET endpoint.

**Recommendation:** Add dedicated endpoints for better photo management and separation of concerns.

---

## 📊 Data Storage Architecture

### Database (MongoDB/dbUnified)

- ✅ **Suppliers**: Full supplier profiles
- ✅ **Tickets**: Support tickets with responses
- ✅ **Messages**: Customer-supplier messages with response tracking
- ✅ **Users**: User accounts and authentication
- ✅ **Reviews**: Supplier reviews and ratings
- ✅ **Packages**: Supplier service packages
- ✅ **Marketplace Listings**: Buy/sell/hire items
- ⚠️ **Analytics**: Analytics data (structure exists, tracking needs implementation)

### File Storage

- ✅ **Photos**: Local filesystem at `/uploads/{ownerType}/{ownerId}/`
- ✅ **Hero Images**: Cloudinary (admin only, via routes/admin.js)
- ⚠️ **Message Attachments**: Local filesystem at `/uploads/attachments/` — lost on redeployment; cloud storage (S3/Cloudinary) integration pending
- 📝 Note: Supplier photos use local storage with base64 transfer, NOT Cloudinary

### CSRF Protection

- ✅ All POST/PATCH/DELETE endpoints protected with `csrfProtection` middleware
- ✅ Includes photo uploads, ticket creation, supplier updates

---

## Summary

| Feature                  | Status             | Priority | Frontend File               | Backend Status             |
| ------------------------ | ------------------ | -------- | --------------------------- | -------------------------- |
| Supplier Analytics API   | ✅ Implemented     | High     | supplier-analytics-chart.js | Live, needs tracking       |
| Analytics Tracking       | ⚠️ TODO            | High     | N/A                         | Needs implementation       |
| Lead Quality API         | ✅ Implemented     | High     | supplier-messages.js        | Fully functional           |
| Marketplace Listings API | ✅ Implemented     | High     | marketplace.js              | Fully functional           |
| Supplier Search V2       | ✅ Implemented     | High     | Search pages                | Functional (distance stub) |
| PWA Manifest             | ✅ Implemented     | Medium   | All pages                   | Fully functional           |
| Supplier CRUD            | ✅ Complete        | High     | supplier-gallery.js         | Fully functional           |
| Photo Upload             | ✅ Complete        | High     | supplier-photo-upload.js    | Fully functional           |
| Photo Gallery GET        | ⚠️ Workaround      | Medium   | supplier-photo-upload.js    | Via supplier endpoint      |
| Photo DELETE             | ❌ Missing         | Medium   | supplier-photo-upload.js    | Not implemented            |
| Message Attachments      | ⚠️ Local only      | Medium   | messaging UI                | Local filesystem only      |
| Ticketing                | ✅ Complete        | High     | ticketing.js                | Fully functional           |
| Distance Sort            | ⚠️ Stub            | Medium   | Search pages                | Falls back to relevance    |
| Availability Filter      | ❌ Not implemented | Medium   | N/A                         | Not implemented            |
