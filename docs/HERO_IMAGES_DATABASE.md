# Hero Collage Images - Database Storage Documentation

## Overview

The hero collage images on the homepage are managed through a database-backed system with graceful fallbacks to default static images.

## Database Schema

### Storage Location

Hero images are stored in the `settings` collection/document under the `heroImages` key.

```javascript
{
  "_id": "settings",
  "heroImages": {
    "venues": "string (URL)",
    "catering": "string (URL)",
    "entertainment": "string (URL)",
    "photography": "string (URL)",
    "updatedAt": "ISO 8601 timestamp",
    "updatedBy": "admin email"
  }
}
```

## Default Images

If `heroImages` is not set in the database, the system falls back to these default static images:

- **Venues**: `/assets/images/collage-venue.jpg` (WebP: `collage-venue.webp`)
- **Catering**: `/assets/images/collage-catering.jpg` (WebP: `collage-catering.webp`)
- **Entertainment**: `/assets/images/collage-entertainment.jpg` (WebP: `collage-entertainment.webp`)
- **Photography**: `/assets/images/collage-photography.jpg` (WebP: `collage-photography.webp`)

## API Endpoints

### 1. Get Hero Images (Public)

```
GET /api/admin/homepage/hero-images-public
```

**Response:**

```json
{
  "venues": "/assets/images/collage-venue.jpg",
  "catering": "/assets/images/collage-catering.jpg",
  "entertainment": "/assets/images/collage-entertainment.jpg",
  "photography": "/assets/images/collage-photography.jpg"
}
```

**Behavior:**

- Returns custom images if set in database
- Returns default static images if not set
- No authentication required (public endpoint)

### 2. Get Hero Images (Admin)

```
GET /api/admin/homepage/hero-images
```

**Authentication:** Required (Admin role)

**Response:** Same as public endpoint

### 3. Upload Hero Image

```
POST /api/admin/homepage/hero-images/:category
```

**Authentication:** Required (Admin role)

**Parameters:**

- `category` (path): One of `venues`, `catering`, `entertainment`, `photography`
- `image` (file): Image file to upload

**Behavior:**

- Uploads to Cloudinary with 800x600 transformation
- Stores URL in database under `settings.heroImages[category]`
- Initializes `heroImages` with defaults if not present

### 4. Reset Hero Image

```
DELETE /api/admin/homepage/hero-images/:category
```

**Authentication:** Required (Admin role)

**Behavior:**

- Resets specific category to default image path

## Frontend Loading Flow

### 1. Initial HTML Load

```html
<img
  src="/assets/images/collage-venue.jpg"
  onerror="this.style.background='linear-gradient(...)'; this.src=''; this.onerror=null;"
/>
```

The HTML contains:

- Default image paths as `src`
- Inline `onerror` handlers for immediate fallback
- Unique gradient colors per category

### 2. JavaScript Enhancement

On DOMContentLoaded, `home-init.js`:

```javascript
// 1. Check if Pexels dynamic collage is enabled
const settings = await fetch('/api/public/homepage-settings');
if (settings.pexelsCollageEnabled) {
  // Use Pexels dynamic images
  initPexelsCollage();
  return;
}

// 2. Load static/custom hero images
const response = await fetch('/api/admin/homepage/hero-images-public');
const heroImages = await response.json();

// 3. Update images if different from defaults
// (skips update if already showing correct defaults)
```

### 3. Error Handling

**Layer 1: HTML onerror (Immediate)**

- Fires if initial src fails to load
- Shows gradient placeholder
- Prevents infinite loops with `this.onerror=null`

**Layer 2: JavaScript onerror (Dynamic)**

- Added programmatically after API fetch
- Attempts fallback to default image
- Shows gradient if default also fails
- Unique gradient per category

### 4. Fallback Hierarchy

```
Custom Image (from Cloudinary)
    ↓ (if fails)
Default Static Image (/assets/images/collage-*.jpg)
    ↓ (if fails)
Gradient Placeholder (unique color per category)
```

## Database Operations

### Read Hero Images

```javascript
const settings = (await dbUnified.read('settings')) || {};
const heroImages = settings.heroImages || {
  venues: '/assets/images/collage-venue.jpg',
  catering: '/assets/images/collage-catering.jpg',
  entertainment: '/assets/images/collage-entertainment.jpg',
  photography: '/assets/images/collage-photography.jpg',
};
```

### Write Hero Images

```javascript
const settings = (await dbUnified.read('settings')) || {};
if (!settings.heroImages) {
  settings.heroImages = {
    /* defaults */
  };
}
settings.heroImages[category] = newImageUrl;
settings.heroImages.updatedAt = new Date().toISOString();
settings.heroImages.updatedBy = adminEmail;
await dbUnified.write('settings', settings);
```

## Testing

### Unit Tests

- `tests/unit/hero-collage-loader.test.js` - Tests image loading logic

### Integration Tests

- `tests/integration/hero-images-api.test.js` - Tests database storage and retrieval

### E2E Tests

- `e2e/hero-collage-images.spec.js` - Tests full flow including visual regression

## Performance Considerations

1. **WebP Support**: HTML uses `<picture>` elements with WebP sources for modern browsers
2. **Lazy Loading**: Images use `loading="lazy"` attribute
3. **Cache Busting**: Custom images get timestamp query param for fresh loads
4. **Default Images**: Skip update if already showing correct defaults (no unnecessary DOM manipulation)

## Troubleshooting

### Images Not Displaying

1. **Check API endpoint:**

   ```bash
   curl http://localhost:3000/api/admin/homepage/hero-images-public
   ```

2. **Check database:**

   ```javascript
   const settings = await dbUnified.read('settings');
   console.log(settings.heroImages);
   ```

3. **Check browser console** for:
   - Network errors (404, 500)
   - JavaScript errors (TypeError)
   - Failed image loads

4. **Verify static files exist:**
   ```bash
   ls -la public/assets/images/collage-*.{jpg,webp}
   ```

### Common Issues

**TypeError: Cannot read properties of undefined (reading 'indexOf')**

- Fixed: Added null checks before calling string methods
- Location: `public/assets/js/pages/home-init.js`

**Images showing blank/empty**

- Fixed: Added onerror handlers for graceful fallback
- Location: `public/index.html` and `public/assets/js/pages/home-init.js`

**Database not returning images**

- Check database connection
- Verify settings document exists
- API falls back to defaults automatically

## Security Considerations

1. **Upload Validation**: Only admins can upload images
2. **CSRF Protection**: POST/DELETE endpoints require CSRF token
3. **Cloudinary**: Uploaded images stored externally with transformations
4. **URL Sanitization**: Frontend sanitizes URLs to prevent XSS
5. **Audit Logging**: All hero image changes are logged

## Future Enhancements

1. **Image Optimization**: Automatic compression and format conversion
2. **CDN Integration**: Serve static defaults from CDN
3. **A/B Testing**: Test different hero images
4. **Analytics**: Track which images perform best
5. **Scheduled Changes**: Auto-update hero images on schedule
