# Missing Backend APIs

This document tracks frontend features that currently use mock data or incomplete backend implementations.

## 🔴 Critical: Supplier Analytics API

**Frontend Location:** `public/assets/js/supplier-analytics-chart.js` (line 260)

**Status:** Uses mock data only

**Issue:** The `fetchAnalyticsData()` function returns hardcoded random values instead of real supplier metrics.

### Required Backend Endpoint

```
GET /api/me/suppliers/:id/analytics?period=7|30|90
```

**Expected Response:**

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

**Data to Track:**

- Profile views (daily counts)
- Customer enquiries/messages (daily counts)
- Response rate percentage
- Average response time (hours)

### Implementation Notes

Backend needs to:

1. Track supplier profile view events
2. Count enquiries/messages per supplier per day
3. Calculate response metrics from messaging system
4. Support date range filtering (7/30/90 days)
5. Return aggregated daily data for charts

---

## 🟡 Enhancement: Photo Management APIs

**Frontend Location:** `public/assets/js/supplier-photo-upload.js`

**Status:** Partially implemented

### Currently Available:

- ✅ POST `/api/me/suppliers/:id/photos` - Upload photo

### Missing:

- ❌ GET `/api/me/suppliers/:id/photos` - List photos
- ❌ DELETE `/api/me/suppliers/:id/photos/:photoId` - Delete specific photo

**Current Workaround:** Photos are stored in supplier's `photosGallery` array and accessed via supplier GET endpoint.

**Recommendation:** Add dedicated endpoints for better photo management and separation of concerns.

---

## Summary

| Feature            | Status        | Priority | Frontend File               | Backend Status        |
| ------------------ | ------------- | -------- | --------------------------- | --------------------- |
| Supplier Analytics | ❌ Missing    | High     | supplier-analytics-chart.js | Mock data only        |
| Photo Gallery GET  | ⚠️ Workaround | Medium   | supplier-photo-upload.js    | Via supplier endpoint |
| Photo DELETE       | ❌ Missing    | Medium   | supplier-photo-upload.js    | Not implemented       |

---

**Last Updated:** 2026-01-15
