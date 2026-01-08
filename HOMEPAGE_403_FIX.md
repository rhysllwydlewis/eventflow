# Homepage 403 Error Fix

## Problem Statement

The EventFlow production homepage (https://www.event-flow.co.uk/) was experiencing 403 Forbidden errors for several API endpoints that should be publicly accessible without authentication. This degraded the user experience and prevented the homepage from loading properly.

### Affected Endpoints

From the browser console logs:

1. `GET /api/csrf-token` - 403 (Forbidden)
2. `GET /api/categories` - 403 (Forbidden)
3. `GET /api/admin/homepage/hero-images_public` - 403 (Forbidden) ← **Primary Issue**
4. `GET /api/packages/featured` - 403 (Forbidden)
5. `GET /api/packages/spotlight` - 403 (Forbidden)
6. `GET /api/auth/me` - 403 (Forbidden)

## Root Cause Analysis

### Endpoints #1, #2, #4, #5, #6: Already Public

After investigation, endpoints 1, 2, 4, 5, and 6 are correctly configured:

- They don't have authentication middleware
- They return appropriate public data
- The 403 errors may be environment-specific (CDN, WAF, or production infrastructure)

### Endpoint #3: Architectural Issue

The hero images endpoint (`/api/admin/homepage/hero-images-public`) had a critical architectural flaw:

**Problem**: A PUBLIC endpoint was located under the `/api/admin/` path

- This violates API design principles
- Infrastructure/security layers may block `/api/admin/*` for unauthenticated requests
- Creates confusion about authentication requirements
- May trigger WAF (Web Application Firewall) rules in production

## Solution Implemented

### 1. Created New Public Endpoint

**File**: `server.js` (line ~2168)

```javascript
/**
 * GET /api/public/homepage/hero-images
 * Public endpoint for homepage hero collage images
 * Returns URLs for the hero collage images with 5-minute cache
 */
app.get('/api/public/homepage/hero-images', async (_req, res) => {
  try {
    // Set cache headers (5 minutes)
    res.set('Cache-Control', 'public, max-age=300');

    const settings = (await dbUnified.read('settings')) || {};
    const heroImages = settings.heroImages || {
      venues: '/assets/images/collage-venue.jpg',
      catering: '/assets/images/collage-catering.jpg',
      entertainment: '/assets/images/collage-entertainment.jpg',
      photography: '/assets/images/collage-photography.jpg',
    };
    res.json(heroImages);
  } catch (error) {
    logger.error('Error reading hero images:', error);
    sentry.captureException(error);
    // Return default images on error
    res.status(200).json({
      venues: '/assets/images/collage-venue.jpg',
      catering: '/assets/images/collage-catering.jpg',
      entertainment: '/assets/images/collage-entertainment.jpg',
      photography: '/assets/images/collage-photography.jpg',
    });
  }
});
```

**Benefits**:

- ✅ Properly located under `/api/public/`
- ✅ Matches existing pattern (see `/api/public/stats`)
- ✅ Includes cache headers to reduce database load
- ✅ Graceful error handling with sensible defaults
- ✅ No authentication required (by design)

### 2. Updated Frontend

**File**: `public/assets/js/pages/home-init.js` (line 319)

```javascript
// Before
const response = await fetch('/api/admin/homepage/hero-images-public');

// After
const response = await fetch('/api/public/homepage/hero-images');
```

### 3. Updated Tests

**File**: `tests/unit/hero-collage-loader.test.js` (line 68)

```javascript
// Before
const response = await mockFetch('/api/admin/homepage/hero-images-public');

// After
const response = await mockFetch('/api/public/homepage/hero-images');
```

## Backward Compatibility

The old endpoint `/api/admin/homepage/hero-images-public` remains in `routes/admin.js` for backward compatibility. It can be removed in a future release after verifying production deployment is successful.

## Verification

### Linting

```bash
npm run lint
# Result: ✅ 0 errors, 3 warnings (unrelated to changes)
```

### Code Quality

- ✅ Follows existing patterns in codebase
- ✅ Proper error handling
- ✅ Appropriate cache headers
- ✅ Security best practices

## Deployment Verification Checklist

After deploying this fix to production:

1. **Verify Homepage Loads**
   - [ ] Visit https://www.event-flow.co.uk/
   - [ ] Check that hero collage images load correctly
   - [ ] Verify featured packages section displays
   - [ ] Confirm spotlight packages section displays
   - [ ] Check categories grid renders

2. **Check Browser Console**
   - [ ] Open DevTools Console (F12)
   - [ ] Verify no 403 errors for `/api/public/homepage/hero-images`
   - [ ] Check for any other console errors
   - [ ] Confirm no JSON parsing errors

3. **Monitor Server Logs**
   - [ ] Check Railway/hosting logs for errors
   - [ ] Verify cache headers are working (should see fewer requests after first load)
   - [ ] Confirm no authentication errors for public endpoints

4. **Performance Check**
   - [ ] Verify 5-minute cache is working (check `Cache-Control` header)
   - [ ] Test page load time improvements
   - [ ] Check database query metrics (should be lower)

## Additional Notes

### Why Other Endpoints May Still Show 403

If `/api/csrf-token`, `/api/categories`, etc. still show 403 errors in production, possible causes include:

1. **CDN/WAF Rules**: Cloudflare or other security services may be blocking requests
2. **CORS Configuration**: Check `BASE_URL` and `ALLOWED_ORIGINS` environment variables
3. **Rate Limiting**: May be hitting rate limits (unlikely for homepage)
4. **Infrastructure**: Railway or hosting platform may have security rules

### Environment Variables to Check

```env
BASE_URL=https://www.event-flow.co.uk
ALLOWED_ORIGINS=https://event-flow.co.uk,https://www.event-flow.co.uk
NODE_ENV=production
```

## Future Improvements

1. **API Audit**: Review all `/api/admin/*` endpoints to ensure none are incorrectly public
2. **Monitoring**: Add monitoring for 403 errors on public endpoints
3. **Documentation**: Update API documentation to clearly distinguish public vs authenticated endpoints
4. **Testing**: Add E2E tests for homepage public API calls

## Related Files

- `server.js` - New public endpoint
- `public/assets/js/pages/home-init.js` - Frontend caller
- `routes/admin.js` - Old endpoint (backward compatibility)
- `tests/unit/hero-collage-loader.test.js` - Unit test
- `middleware/security.js` - CORS configuration
- `middleware/auth.js` - Authentication middleware

## References

- Issue: Homepage 403 errors
- PR: [Link to PR]
- Commit: `Move hero-images endpoint from /api/admin to /api/public`
