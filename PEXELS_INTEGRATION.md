# Pexels Stock Photos Integration

EventFlow integrates with Pexels API to provide access to high-quality stock photos for category images, hero banners, and other site content.

## Overview

- **Admin Only**: Stock photo browsing is restricted to admin users
- **Supplier Uploads**: Suppliers continue to upload their own profile and package photos
- **Stock Photos**: Used for category images, banners, and other EventFlow-managed content
- **Free Photos**: All Pexels photos are free to use (attribution is shown automatically)

## Setup

### 1. Get Pexels API Key

1. Go to [https://www.pexels.com/api/](https://www.pexels.com/api/)
2. Sign up or log in to your Pexels account
3. Create a new API key
4. Copy your API key

### 2. Configure Environment Variable

Add your Pexels API key to your `.env` file:

```bash
PEXELS_API_KEY=your-pexels-api-key-here
```

Or set it in your deployment platform's environment variables.

### 3. Restart Server

Restart your EventFlow server to load the new configuration.

## Usage

### Admin Interface

Access the stock photo browser at: `/admin-pexels.html`

Features:

- **Search**: Find photos by keyword (e.g., "wedding", "venue", "catering")
- **Quick Categories**: Pre-defined searches for EventFlow categories
- **Curated Photos**: Browse editor-picked photos from Pexels
- **View & Copy**: Click any photo to view details and copy the image URL
- **Pagination**: Browse through thousands of results

### API Endpoints

All endpoints require admin authentication.

#### Search Photos

```
GET /api/pexels/search?q=wedding&page=1&perPage=15
```

#### Get Curated Photos

```
GET /api/pexels/curated?page=1&perPage=15
```

#### Get Photo by ID

```
GET /api/pexels/photo/:id
```

#### Search Videos

```
GET /api/pexels/videos/search?q=wedding&page=1&perPage=15
```

#### Get Popular Videos

```
GET /api/pexels/videos/popular?page=1&perPage=15
```

#### Get Video by ID

```
GET /api/pexels/videos/:id
```

#### Get Featured Collections

```
GET /api/pexels/collections/featured?page=1&perPage=15
```

Returns a list of featured (curated) collections from Pexels.

#### Get All Collections

```
GET /api/pexels/collections?page=1&perPage=15
```

Returns all available collections (requires authentication).

#### Get Collection Media

```
GET /api/pexels/collections/:id?page=1&perPage=15&type=photos
```

Retrieves all media (photos and/or videos) from a specific collection.
- `type` parameter (optional): Filter by media type ('photos' or 'videos')

#### Get Category Suggestions

```
GET /api/pexels/categories
```

#### Check API Status

```
GET /api/pexels/status
```

Returns whether Pexels API key is configured (but not the key itself).

#### Get Service Metrics (NEW)

```
GET /api/pexels/metrics
```

Returns service metrics including:
- Total/successful/failed requests
- Success rate
- Cache hit rate
- Average response time
- Circuit breaker state

#### Clear Cache (NEW)

```
POST /api/pexels/cache/clear
```

Clears the response cache. Requires CSRF protection.

#### Test API Connection (NEW)

```
GET /api/pexels/test
```

Tests the Pexels API connection and validates the API key. Returns detailed status including:
- Connection success/failure
- Response time
- Error categorization (authentication, rate limit, timeout, network)
- API version information

**Example Response (Success):**
```json
{
  "success": true,
  "message": "Pexels API is configured and working",
  "details": {
    "configured": true,
    "responseTime": 250,
    "totalResults": 8000,
    "apiVersion": "v1"
  },
  "timestamp": "2026-01-14T20:00:00.000Z"
}
```

**Example Response (Failure):**
```json
{
  "success": false,
  "message": "Invalid API key. Please check your PEXELS_API_KEY",
  "details": {
    "configured": true,
    "error": "Pexels API error: 401 Unauthorized",
    "errorType": "authentication"
  },
  "timestamp": "2026-01-14T20:00:00.000Z"
}
```

## Admin Settings Integration (NEW)

### Feature Flag: Pexels Dynamic Collage

Admins can now enable/disable the Pexels dynamic collage feature from the Admin Settings page:

1. Navigate to Admin Settings (`/admin-settings.html`)
2. Scroll to "Feature Flags" section
3. Toggle "Pexels Dynamic Collage"
4. Click "Save Feature Flags"
5. A "Test Connection" button will appear
6. Click to verify your API key is working

### Test Connection Button

After enabling the Pexels feature flag, you can test the API connection directly from the admin UI:

- **Green (Success)**: Shows response time, API version, and confirms connection
- **Red (Error)**: Shows specific error type and troubleshooting details

Error types:
- `authentication`: Invalid API key
- `rate_limit`: Too many requests
- `timeout`: Connection timeout
- `network`: Cannot reach Pexels API

### Health Monitoring

The Pexels API status is included in the system health check:

```
GET /api/health
```

Response includes:
```json
{
  "status": "ok",
  "services": {
    "pexels": "configured"  // or "not_configured" or "unavailable"
  }
}
```

### Server Startup Logs

When the server starts, it automatically checks Pexels configuration:

```
🔧 Checking optional services...
   ✅ Pexels API: Configured
   Use admin settings to test connection and enable dynamic collage
```

Or if not configured:
```
   ℹ️  Pexels API: Not configured (optional)
   Set PEXELS_API_KEY to enable stock photo integration
```

## Usage in Code

To use a Pexels photo in your HTML/CSS:

```html
<!-- Copy the image URL from the admin interface -->
<img src="https://images.pexels.com/photos/1234567/..." alt="Category image" />
```

For categories:

```css
.category-venues {
  background-image: url('https://images.pexels.com/photos/1234567/...');
}
```

## Photo Attribution

All Pexels photos require attribution to the photographer. The admin interface automatically shows photographer names when you select photos. When using photos in your code, include attribution in accessible ways:

```html
<!-- Visible attribution -->
<p>Photo by John Doe from Pexels</p>

<!-- Alt text attribution -->
<img src="..." alt="Wedding venue. Photo by John Doe from Pexels" />
```

## Best Practices

1. **Use Appropriate Sizes**: Pexels provides multiple sizes (tiny, small, medium, large, large2x). Choose the right size for your use case
2. **Lazy Loading**: Use `loading="lazy"` attribute for images below the fold
3. **Caching**: Pexels URLs are CDN-backed and safe to cache
4. **Search Terms**: Be specific in your searches (e.g., "outdoor wedding venue" vs just "venue")
5. **Quality**: Use large or large2x sizes for hero images, medium for thumbnails

## Rate Limits

Pexels free tier includes:

- 200 requests per hour
- 20,000 requests per month

The admin interface automatically handles pagination and caching to stay within limits.

## Troubleshooting

### "Pexels API not configured" Error

1. Check that `PEXELS_API_KEY` is set in your environment variables
2. Verify the API key is correct (no extra spaces)
3. Restart your server after adding the environment variable
4. Check server startup logs for Pexels status
5. Use the "Test Connection" button in Admin Settings to verify

### Testing Your API Key

The easiest way to verify your Pexels API key:

1. Log in to EventFlow as admin
2. Go to Admin Settings (`/admin-settings.html`)
3. Enable "Pexels Dynamic Collage" feature flag
4. Click "Save Feature Flags"
5. Click the "Test Connection" button that appears
6. Review the results:
   - ✅ Green = API key is working
   - ❌ Red = Check error details for troubleshooting

### Common Error Types

#### Authentication Error
- **Cause**: Invalid or missing API key
- **Solution**: Verify `PEXELS_API_KEY` in environment variables, get a new key from pexels.com/api

#### Rate Limit Error
- **Cause**: Exceeded 200 requests/hour or 20,000 requests/month
- **Solution**: Wait for rate limit to reset, or upgrade your Pexels plan

#### Timeout Error
- **Cause**: Slow network or Pexels API is slow to respond
- **Solution**: Check network connection, try again in a moment

#### Network Error
- **Cause**: Cannot reach Pexels API (firewall, DNS issues)
- **Solution**: Check firewall settings, verify DNS resolution for api.pexels.com

### Photos Not Loading

1. Check your internet connection
2. Verify the API key is valid at [https://www.pexels.com/api/](https://www.pexels.com/api/)
3. Check rate limits haven't been exceeded
4. View browser console for specific error messages
5. Check `/api/health` endpoint for Pexels status

### Authentication Errors

The admin stock photo browser requires admin role. Ensure you're logged in as an admin user.

## Support

For Pexels API issues, visit:

- [Pexels API Documentation](https://www.pexels.com/api/documentation/)
- [Pexels API Support](https://help.pexels.com/hc/en-us/sections/900000771146-API)

For EventFlow-specific issues, contact the development team.
