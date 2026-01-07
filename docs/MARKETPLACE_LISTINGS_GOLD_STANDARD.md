# Marketplace Listings - Gold Standard Implementation

## Overview

This document describes the gold-standard implementation for the EventFlow marketplace supplier experience, specifically the "My Marketplace Listings" page and the "+ List an Item" workflow.

**Status**: ✅ Implemented (January 2026)  
**Related PRs**: #[TBD]  
**Pages Affected**:
- `/my-marketplace-listings.html`
- `/supplier/marketplace-new-listing.html`
- `/marketplace.html` (tag display improvements)

## Table of Contents

1. [Key Improvements](#key-improvements)
2. [Authentication & Authorization](#authentication--authorization)
3. [The "+ List an Item" Button](#the--list-an-item-button)
4. [Tagging System](#tagging-system)
5. [Error Handling](#error-handling)
6. [Technical Implementation](#technical-implementation)
7. [Testing](#testing)
8. [Known Limitations](#known-limitations)
9. [Future Enhancements](#future-enhancements)

## Key Improvements

### Before

- ❌ Dead "+ List an Item" button (no click handler)
- ❌ 404 errors for non-existent component scripts
- ❌ Inconsistent navbar/footer with rest of site
- ❌ Poor 401 error handling (silent failures)
- ❌ Unclear messaging when not authorized
- ❌ Modal-based listing creation (fragile UX)

### After

- ✅ "+ List an Item" button always functional
- ✅ Modern navbar/footer matching site standards
- ✅ Graceful 401/403 handling with clear user messaging
- ✅ Dedicated listing creation page with clean form
- ✅ Auth-aware UX (logged out, logged in non-supplier, logged in supplier)
- ✅ Tags displayed on listing cards (category, location, condition)
- ✅ Improved server-side logging for debugging
- ✅ No 404s for JS/CSS assets

## Authentication & Authorization

### Auth Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User visits /my-marketplace-listings.html                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Check Auth    │──────────────┐
            │ /api/user     │              │
            └───────┬───────┘              │
                    │                      │
        ┌───────────┴───────────┐         │
        │                       │         │
        ▼                       ▼         │
  ┌──────────┐           ┌──────────┐   │
  │ 200 OK   │           │ 401 Unauth│   │
  └────┬─────┘           └────┬──────┘   │
       │                      │           │
       ▼                      ▼           │
  Parse user            Show login CTA   │
  data                  + redirect link   │
       │                                  │
       ▼                                  │
  Load listings                           │
  /api/marketplace/my-listings            │
       │                                  │
   ┌───┴───┐                              │
   │       │                              │
   ▼       ▼                              │
 200 OK  401/403                          │
   │       │                              │
   ▼       ▼                              │
Display  Show appropriate                 │
listings message                          │
```

### Response Format Handling

The implementation handles both wrapped and unwrapped API responses:

```javascript
// Wrapped format
{ user: { id: '...', name: '...', role: '...' } }

// Unwrapped format
{ id: '...', name: '...', role: '...' }

// Null user (logged out)
{ user: null }
```

**Logic**:
```javascript
if (data.user !== undefined) {
  currentUser = data.user;  // Could be null!
} else if (data.id) {
  currentUser = data;  // Direct user object
} else {
  currentUser = null;  // No user data
}
```

### Status Code Meanings

| Code | Meaning | User Experience |
|------|---------|----------------|
| `200` | Authenticated & authorized | Show listings |
| `401` | Not authenticated | "Log in to manage listings" + redirect |
| `403` | Authenticated but not supplier | "You need a supplier account" + support link |
| `500` | Server error | "Failed to load listings" + retry button |

## The "+ List an Item" Button

### Gold Standard UX

The button always works, regardless of listings load state or auth errors.

#### State 1: Logged Out

**Behavior**:
1. Show toast: "Please log in to list items"
2. After 1.5 seconds, redirect to `/auth.html?redirect=/my-marketplace-listings.html`

**Code**:
```javascript
showToast('Please log in to list items');
setTimeout(() => {
  window.location.href = '/auth.html?redirect=/my-marketplace-listings.html';
}, 1500);
```

#### State 2: Logged In (any role)

**Behavior**:
1. Navigate immediately to `/supplier/marketplace-new-listing.html`
2. User can create listing (will be reviewed before appearing)

**Code**:
```javascript
window.location.href = '/supplier/marketplace-new-listing.html';
```

#### State 3: Logged In but Not Supplier (Optional Check)

If role-based restrictions are added in the future:

**Behavior**:
1. Show toast: "You need a supplier account to list items"
2. Optionally redirect to supplier onboarding or contact page

**Note**: Currently, any authenticated user can list items. They just need to be logged in.

### Button Attachment

The button handler is attached during page initialization, not dependent on listings loading:

```javascript
function initAddListingButton() {
  const btn = document.getElementById('add-listing-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    // Re-check auth state in case it changed
    if (!currentUser) {
      await checkAuth();
    }

    if (!currentUser) {
      // Handle logged-out state
    } else {
      // Navigate to listing creation page
    }
  });
}

// Called early in init(), before loadListings()
init() {
  await checkAuth();
  initAddListingButton();  // ← Button always works
  // ...
  if (currentUser) {
    await loadListings();  // ← May fail, but button still works
  }
}
```

## Tagging System

### Core Tag Fields

Each marketplace listing can have the following tags displayed:

1. **Category** (required): `attire`, `decor`, `av-equipment`, `photography`, `party-supplies`, `florals`
2. **Location** (optional): City or region (e.g., "London", "North West")
3. **Condition** (required): `new`, `like-new`, `good`, `fair`

### Tag Rendering

Tags appear below the title on listing cards:

```
┌─────────────────────────────────┐
│  📸 [Image]                     │
├─────────────────────────────────┤
│  £150.00                        │
│  Ivory Wedding Dress, Size 10   │
│  ┌──────────┬─────────┬────────┐│
│  │ Attire   │📍London │Like New││
│  └──────────┴─────────┴────────┘│
│  Listed 2 days ago              │
└─────────────────────────────────┘
```

**HTML**:
```html
<div class="marketplace-item-tags">
  <span class="marketplace-tag">Attire</span>
  <span class="marketplace-tag">📍 London</span>
  <span class="marketplace-tag">Like New</span>
</div>
```

**CSS**:
```css
.marketplace-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.marketplace-tag {
  display: inline-block;
  padding: 4px 10px;
  background: #f3f4f6;
  color: #374151;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

/* First tag (category) gets highlighted */
.marketplace-tag:first-child {
  background: #dbeafe;
  color: #1e40af;
}
```

### Tag-Based Filtering (Phase 1)

Currently, filtering is done via the existing sidebar filters on `/marketplace.html`:

- **Category** dropdown
- **Condition** dropdown
- **Location** (via location search)
- **Price** range

Client-side filtering can be added in the future by:
1. Adding clickable tag chips at the top of results
2. Filtering `allListings` array based on selected tags
3. Re-rendering filtered results

## Error Handling

### Principle: No Silent Failures

Every error state shows a clear message with actionable next steps.

### Error States & Messages

#### 1. Logged Out (401 from auth check)

```
┌──────────────────────────────────────────────────────┐
│ ℹ️ Log in to manage your marketplace listings       │
│                                                      │
│ You need to be logged in to view and manage your    │
│ marketplace listings.                                │
│                                                      │
│ [Log in or Sign up] ←──────────────────────────────┐│
└──────────────────────────────────────────────────────┘
```

#### 2. Not a Supplier (403 from /api/marketplace/my-listings)

```
┌──────────────────────────────────────────────────────┐
│ ⚠️ Supplier account required                         │
│                                                      │
│ You need a supplier account to manage marketplace   │
│ listings. Learn more about becoming a supplier or   │
│ contact support for help.                           │
└──────────────────────────────────────────────────────┘
```

#### 3. Network Error

```
┌──────────────────────────────────────────────────────┐
│ ❌ Unable to verify your login status                │
│                                                      │
│ There was a problem connecting to the server.       │
│ Please check your internet connection and try again.│
│                                                      │
│ [Reload Page]                                       │
└──────────────────────────────────────────────────────┘
```

#### 4. Failed to Load Listings

```
┌──────────────────────────────────────────────────────┐
│ ❌ Failed to load your listings                      │
│                                                      │
│ An unexpected error occurred. Please try again.     │
│                                                      │
│ [Reload Page]                                       │
└──────────────────────────────────────────────────────┘
```

### Server-Side Logging

Improved logging helps debug issues in production:

```javascript
// In /api/marketplace/my-listings
logger.info('Fetching marketplace listings', {
  userId: req.user.id,
  userRole: req.user.role,
  endpoint: '/api/marketplace/my-listings'
});

// In auth middleware (401 responses)
logger.warn('Authentication required but no valid user found', {
  path: req.path,
  method: req.method,
  ip: req.ip,
  userAgent: req.get('user-agent')
});
```

## Technical Implementation

### Files Modified

1. **`public/my-marketplace-listings.html`**
   - Replaced old navbar with modern header (matching `pricing.html`)
   - Removed non-existent component script references
   - Added `auth-nav.js` for consistent auth state
   - Updated footer to match site-wide standard
   - Removed inline JavaScript
   - Added auth message container

2. **`public/assets/js/my-marketplace-listings.js`** (NEW)
   - Dedicated module for My Marketplace Listings page
   - Handles auth checking, listing loading, tab filtering
   - Manages "+ List an Item" button with gold-standard UX
   - Renders tags on listing cards
   - Exports functions for inline onclick handlers

3. **`public/supplier/marketplace-new-listing.html`** (NEW)
   - Clean, dedicated listing creation page
   - Modern form with image upload (drag & drop)
   - Character counter for description
   - Auth-protected (redirects if not logged in)
   - Edit mode support via `?edit=<listingId>` query param

4. **`public/assets/js/marketplace-new-listing.js`** (NEW)
   - Handles form submission for creating/editing listings
   - Image upload with preview and validation
   - CSRF token integration
   - Error handling with user-friendly messages

5. **`public/assets/js/marketplace.js`**
   - Updated `createListingCard()` to render tags
   - Tags include category, location, condition

6. **`public/assets/css/marketplace.css`**
   - Added styles for `.marketplace-item-tags` and `.marketplace-tag`
   - Responsive adjustments for mobile

7. **`server.js`**
   - Enhanced logging for `/api/marketplace/my-listings` endpoint
   - Logs user ID, role, and request details

8. **`middleware/auth.js`**
   - Added logging for 401 responses in `authRequired` middleware
   - Helps debug unauthorized access issues

### Dependencies

- Uses existing auth flow (`/api/user`, JWT cookies)
- Uses existing marketplace API endpoints
- Uses existing CSRF protection
- No new external dependencies

## Testing

### Unit Tests

**File**: `tests/unit/my-marketplace-listings.test.js`

Tests cover:
- ✅ User data parsing (wrapped, unwrapped, null)
- ✅ Auth state messaging logic
- ✅ Button behavior in different auth states
- ✅ Error handling for 401, 403, 500, network errors
- ✅ Tag rendering with missing fields
- ✅ Tab filtering logic
- ✅ Format helper functions

**Run tests**:
```bash
npm run test:unit -- my-marketplace-listings
```

### Manual Testing Checklist

- [ ] **Logged out**: Visit `/my-marketplace-listings.html`
  - [ ] Shows "Log in to manage listings" message
  - [ ] "+ List an Item" button shows toast and redirects to `/auth.html?redirect=...`
  - [ ] No 404 errors in console
  - [ ] Navbar shows "Log in" link

- [ ] **Logged in**: After logging in
  - [ ] Listings load and display correctly
  - [ ] Tags render on each listing card (category, location, condition)
  - [ ] "+ List an Item" button navigates to `/supplier/marketplace-new-listing.html`
  - [ ] Tabs (All, Pending, Active, Sold) filter correctly
  - [ ] Edit/Delete/Mark as Sold buttons work
  - [ ] Navbar shows "Log out" and "Dashboard"

- [ ] **Create listing**:
  - [ ] Form loads without errors
  - [ ] Image upload works (drag & drop, click, multiple images)
  - [ ] Character counter updates as you type
  - [ ] Form validation prevents submission with missing fields
  - [ ] Successful submission shows toast and redirects to `/my-marketplace-listings.html`

- [ ] **Production considerations**:
  - [ ] No hardcoded `localhost` URLs
  - [ ] Auth works on production domain (`www.event-flow.co.uk`)
  - [ ] No 404s for JS/CSS assets

## Known Limitations

1. **Role-Based Access**: Currently, any authenticated user can list items. There's no strict "supplier role" requirement on the frontend (though one could be added server-side).

2. **Image Storage**: Images are stored as base64 in the database. For production at scale, consider migrating to cloud storage (S3, Cloudinary, etc.).

3. **Marketplace Filters**: Tag-based filtering on the main marketplace is basic. More advanced filters (e.g., multi-select tags, location radius) could be added.

4. **Edit Mode**: Editing listings currently navigates to the new listing page with `?edit=<id>`. An inline edit modal could improve UX.

5. **No Listing Analytics**: Sellers can't see views, clicks, or inquiries for their listings yet.

## Future Enhancements

### Phase 2: Advanced Tagging

- **Additional Fields**:
  - `locationRegion` (e.g., "South East", "North West")
  - `locationCity` (e.g., "London", "Manchester")
  - `features` (array): `["outdoor-friendly", "licensed-for-ceremonies", "under-2000"]`
  - `badges` (array): `["featured", "verified-seller", "fast-response"]`

- **Tag-Based Filters**:
  - Chip row at top of marketplace results
  - Click to filter by category, location, features
  - Multi-select support
  - URL params for shareable filtered views

### Phase 3: Supplier Dashboard Integration

- Link "My Marketplace Listings" from supplier dashboard
- Show listing analytics (views, inquiries)
- Bulk actions (mark multiple as sold, delete, etc.)

### Phase 4: Listing Promotion

- Allow suppliers to "boost" a listing (paid feature)
- Featured listings appear first in search results
- Show "Featured" badge on listing cards

### Phase 5: Buyer-Seller Messaging

- Buyers can message sellers about a listing
- Thread linked to specific listing
- Listing image and title shown in message thread

---

## Appendix: Code Snippets

### Auth Check (Consistent Pattern)

```javascript
async function checkAuth() {
  try {
    const res = await fetch('/api/user', { 
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (res.status === 401) {
      currentUser = null;
      showAuthMessage('logged-out');
      return false;
    }
    
    if (!res.ok) {
      currentUser = null;
      showAuthMessage('error');
      return false;
    }

    const data = await res.json();
    
    // Handle both wrapped ({user: ...}) and unwrapped response formats
    if (data.user !== undefined) {
      currentUser = data.user;
    } else if (data.id) {
      currentUser = data;
    } else {
      currentUser = null;
    }

    if (!currentUser) {
      showAuthMessage('logged-out');
      return false;
    }

    clearAuthMessage();
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    currentUser = null;
    showAuthMessage('error');
    return false;
  }
}
```

### Load Listings with Error Handling

```javascript
async function loadListings() {
  const container = document.getElementById('my-listings-container');
  if (!container) return;

  try {
    const res = await fetch('/api/marketplace/my-listings', {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (res.status === 401) {
      currentUser = null;
      showAuthMessage('logged-out');
      return;
    }

    if (res.status === 403) {
      showAuthMessage('not-supplier');
      container.innerHTML = '';
      return;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch listings: ${res.status}`);
    }

    const data = await res.json();
    allListings = data.listings || [];
    renderListings();
  } catch (error) {
    console.error('Error loading listings:', error);
    container.innerHTML = `
      <div class="card">
        <p class="error">
          <strong>Failed to load your listings</strong><br>
          ${error.message || 'Please try again.'}
        </p>
        <button onclick="window.location.reload()" class="cta secondary">
          Reload Page
        </button>
      </div>
    `;
  }
}
```

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Author**: EventFlow Development Team
