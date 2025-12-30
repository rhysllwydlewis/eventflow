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

#### Get Category Suggestions

```
GET /api/pexels/categories
```

#### Check API Status

```
GET /api/pexels/status
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

1. Check that `PEXELS_API_KEY` is set in your `.env` file
2. Verify the API key is correct (no extra spaces)
3. Restart your server after adding the environment variable

### Photos Not Loading

1. Check your internet connection
2. Verify the API key is valid at [https://www.pexels.com/api/](https://www.pexels.com/api/)
3. Check rate limits haven't been exceeded
4. View browser console for specific error messages

### Authentication Errors

The admin stock photo browser requires admin role. Ensure you're logged in as an admin user.

## Support

For Pexels API issues, visit:

- [Pexels API Documentation](https://www.pexels.com/api/documentation/)
- [Pexels API Support](https://help.pexels.com/hc/en-us/sections/900000771146-API)

For EventFlow-specific issues, contact the development team.
