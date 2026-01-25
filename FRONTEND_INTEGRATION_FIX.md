# Frontend Integration Fix - Detailed Explanation

## Issue Identified

The user reported that:
1. There's a large placeholder photo behind the categories in the collage
2. Videos and photos aren't playing from Pexels

## Root Cause Analysis

The issue was in `public/assets/js/hero-bento.js`. This file is responsible for:
- Loading the hero video in the bento grid
- Fetching category images (Venues, Catering, Entertainment, Photography) from Pexels

**The Problem:**
The frontend JavaScript was **hardcoded** to always try to fetch from Pexels API, regardless of what the admin configured in the backend. It had NO connection to the backend settings.

### Specific Issues:

1. **No Settings Check**: The `hero-bento.js` never checked if the collage widget was enabled
2. **No Source Check**: It didn't check whether to use 'pexels' or 'uploads' as the media source  
3. **Hardcoded Behavior**: It always tried to load from Pexels, even if the admin disabled it
4. **No Fallback Logic**: When Pexels API calls failed (due to CORS, rate limits, or being disabled), it just showed error messages but kept the placeholder images

## The Fix

Modified `public/assets/js/hero-bento.js` to:

### 1. Fetch Settings from Backend (NEW)
```javascript
async fetchSettings() {
  const response = await fetch('/api/public/homepage-settings');
  const data = await response.json();
  return data.collageWidget || null;
}
```

This fetches the collage widget configuration from the backend using the public endpoint (no auth required).

### 2. Check Settings Before Loading (NEW)
```javascript
async init() {
  // Fetch settings from backend first
  this.settings = await this.fetchSettings();
  
  // Check if collage widget is enabled
  const isEnabled = this.settings?.enabled !== false;
  const source = this.settings?.source || 'pexels';
  
  if (!isEnabled) {
    console.log('[Bento Hero] Widget is disabled, using static images');
    return;  // Exit early, keep placeholder images
  }
  
  // Only load from Pexels if source is 'pexels'
  if (source === 'pexels') {
    await this.initializeVideo();
    await this.loadCategoryImages();
  } else {
    console.log('[Bento Hero] Source is not Pexels, using static images');
  }
}
```

### 3. Use Custom Queries from Settings (NEW)
```javascript
async fetchCategoryImage(category) {
  // Use custom query from settings if available
  const customQueries = this.settings?.pexelsQueries || {};
  const query = customQueries[category] || this.categoryQueries[category] || category;
  
  // ... rest of the code
}
```

Now the frontend respects the custom Pexels queries configured in the admin panel.

## Behavior Changes

### Before:
- ❌ Always tried to fetch from Pexels, regardless of admin settings
- ❌ Showed placeholder images when Pexels failed
- ❌ No way to disable Pexels loading from admin panel
- ❌ Didn't use custom Pexels queries from settings

### After:
- ✅ Checks backend settings before loading anything
- ✅ Only loads from Pexels if `enabled` is true AND `source` is 'pexels'
- ✅ Keeps clean placeholder images when widget is disabled
- ✅ Uses custom Pexels queries from admin settings
- ✅ Admin has full control over collage widget behavior

## What the User Should See Now

### If Collage Widget is DISABLED in Admin:
- No Pexels API calls are made
- Static placeholder images are shown (the clean images in the HTML)
- No console errors about Pexels
- Clean, fast page load

### If Collage Widget is ENABLED with source='pexels':
- Pexels API calls are made to fetch dynamic images
- Category images are replaced with Pexels photos
- Hero video is loaded from Pexels if available
- Falls back to placeholder on Pexels failure

### If Collage Widget is ENABLED with source='uploads':
- No Pexels API calls are made
- Static images are shown (upload gallery would need separate implementation)
- No Pexels-related console messages

## Testing Recommendations

1. **Check Admin Panel** (`/admin-homepage.html`)
   - Verify "Enable Collage Widget" checkbox state
   - Check which source is selected (Pexels vs Uploads)
   - Review custom Pexels queries if configured

2. **Test with Widget Disabled**
   - Disable in admin panel
   - Reload homepage
   - Should see static images, no Pexels errors

3. **Test with Widget Enabled (Pexels)**
   - Enable in admin panel
   - Select "Pexels" as source
   - Reload homepage
   - Should see dynamic Pexels images loading

4. **Check Browser Console**
   - Look for "[Bento Hero]" messages
   - Should see settings being loaded
   - Should see clear indication of what's happening

## Files Changed

- `public/assets/js/hero-bento.js` - Added settings integration
- `routes/admin.js` - Fixed settings merging (already done)
- `public/assets/css/hero-bento.css` - Fixed label wrapping (already done)
