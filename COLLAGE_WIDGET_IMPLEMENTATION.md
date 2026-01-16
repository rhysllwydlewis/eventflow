# Collage Widget Implementation Guide

## Overview
This document describes the implementation of the configurable collage widget for the EventFlow homepage. The widget allows administrators to display dynamic photo/video collages using either Pexels API or uploaded media.

## Features

### Core Functionality
- **Dual Source Support**: Choose between Pexels API or uploaded media
- **Media Types**: Support for both photos and videos
- **Video Support**: Videos play muted, looped, with playsinline attribute
- **Configurable Intervals**: Set transition timing (1-60 seconds)
- **Graceful Fallbacks**: Automatic fallback from uploads → Pexels → static images
- **Backward Compatible**: Existing pexelsCollage feature still works

### Accessibility
- **Reduced Motion Support**: Respects `prefers-reduced-motion` media query
- **Proper Video Attributes**: Muted, playsinline for mobile compatibility
- **Lazy Loading**: Progressive enhancement with timeout controls
- **ARIA Labels**: Proper accessibility markup

### Security
- **CSRF Protection**: All admin endpoints protected
- **File Type Validation**: Only images and videos allowed
- **Path Sanitization**: Prevention of directory traversal attacks
- **Size Limits**: 10MB per file for videos, 5MB for images
- **Audit Logging**: All admin actions logged

## API Endpoints

### Admin Endpoints (Authentication Required)

#### Get Widget Configuration
```http
GET /api/admin/homepage/collage-widget
```
Returns the current collage widget configuration.

**Response:**
```json
{
  "enabled": true,
  "source": "pexels",
  "mediaTypes": { "photos": true, "videos": false },
  "intervalSeconds": 2.5,
  "pexelsQueries": {
    "venues": "wedding venue elegant ballroom",
    "catering": "wedding catering food elegant",
    "entertainment": "live band wedding party",
    "photography": "wedding photography professional"
  },
  "uploadGallery": [],
  "fallbackToPexels": true
}
```

#### Update Widget Configuration
```http
PUT /api/admin/homepage/collage-widget
Content-Type: application/json
X-CSRF-Token: <token>
```

**Request Body:**
```json
{
  "enabled": true,
  "source": "uploads",
  "mediaTypes": { "photos": true, "videos": true },
  "intervalSeconds": 3,
  "pexelsQueries": { ... },
  "uploadGallery": ["/uploads/homepage-collage/file1.jpg"],
  "fallbackToPexels": true
}
```

**Validation:**
- `enabled`: boolean
- `source`: "pexels" | "uploads"
- `intervalSeconds`: 1-60
- `mediaTypes`: At least one must be true
- When enabled with uploads source, uploadGallery cannot be empty

#### List Uploaded Media
```http
GET /api/admin/homepage/collage-media
```

**Response:**
```json
{
  "media": [
    {
      "filename": "collage-123456.jpg",
      "url": "/uploads/homepage-collage/collage-123456.jpg",
      "type": "photo",
      "size": 1024000,
      "uploadedAt": "2026-01-16T13:00:00.000Z"
    }
  ]
}
```

#### Upload Media
```http
POST /api/admin/homepage/collage-media
Content-Type: multipart/form-data
X-CSRF-Token: <token>
```

**Form Data:**
- `media`: File(s) - Up to 10 files
- Accepts: image/*, video/*
- Max size: 10MB per file

#### Delete Media
```http
DELETE /api/admin/homepage/collage-media/:filename
X-CSRF-Token: <token>
```

### Public Endpoints (No Authentication)

#### Get Homepage Settings
```http
GET /api/public/homepage-settings
```

**Response:**
```json
{
  "collageWidget": {
    "enabled": true,
    "source": "pexels",
    "mediaTypes": { "photos": true, "videos": false },
    "intervalSeconds": 2.5,
    "pexelsQueries": { ... },
    "uploadGallery": [],
    "fallbackToPexels": true
  },
  "pexelsCollageEnabled": false,
  "pexelsCollageSettings": { ... }
}
```

## Admin UI

### Location
Navigate to: `/admin-homepage.html`

### Configuration Steps

1. **Enable Widget**
   - Toggle "Enable Collage Widget" checkbox
   - Settings are disabled when widget is off

2. **Choose Source**
   - Select either "Pexels API" or "Uploaded Media"
   - Sources are mutually exclusive (radio buttons)

3. **Configure Media Types**
   - Check "Photos" and/or "Videos"
   - At least one must be selected

4. **Set Transition Interval**
   - Enter value between 1-60 seconds
   - Default: 2.5 seconds

5. **Pexels Settings** (if Pexels source selected)
   - Customize search queries for each category:
     - Venues
     - Catering
     - Entertainment
     - Photography

6. **Upload Gallery** (if Uploads source selected)
   - Click "Upload Media" button
   - Select up to 10 files at once
   - Preview uploaded media with delete option
   - Supports: JPG, PNG, WebP, MP4, WebM, MOV

7. **Fallback Option**
   - Check "Fallback to Pexels if uploads unavailable"
   - Recommended for reliability

8. **Save Configuration**
   - Click "Save Configuration"
   - Success/error messages appear below
   - Changes take effect immediately on homepage

## Frontend Behavior

### Initialization Flow
1. Fetch configuration from `/api/public/homepage-settings`
2. Check if `collageWidget.enabled` is true
3. Load media based on `source` setting:
   - **Pexels**: Fetch from `/api/admin/public/pexels-collage`
   - **Uploads**: Use `uploadGallery` URLs
4. Initialize collage frames with first media item
5. Start cycling interval based on `intervalSeconds`

### Media Distribution
For uploaded media, files are distributed across 4 categories in round-robin fashion:
- File 1 → Venues (frame 0)
- File 2 → Catering (frame 1)
- File 3 → Entertainment (frame 2)
- File 4 → Photography (frame 3)
- File 5 → Venues (frame 0)
- And so on...

### Transitions
- Crossfade effect between media items
- Fade out duration: 1 second (configurable via CSS)
- Respects `prefers-reduced-motion` setting
- Videos replaced seamlessly with images and vice versa

### Fallback Hierarchy
1. **Primary Source** (Pexels or Uploads)
2. **Fallback to Pexels** (if enabled and uploads fail)
3. **Static Hero Images** (from hero-images config)
4. **Default Images** (hardcoded fallbacks)

## File Storage

### Upload Directory
```
/public/uploads/homepage-collage/
```

### File Naming
```
collage-{timestamp}-{random}.{ext}
```
Example: `collage-1705410000000-123456789.jpg`

### Supported Formats
- **Images**: JPG, JPEG, PNG, WebP, GIF
- **Videos**: MP4, WebM, MOV

### Size Limits
- **Images**: 5MB
- **Videos**: 10MB

## Database Schema

### Settings Collection
```javascript
{
  collageWidget: {
    enabled: Boolean,
    source: String, // "pexels" | "uploads"
    mediaTypes: {
      photos: Boolean,
      videos: Boolean
    },
    intervalSeconds: Number, // 1-60
    pexelsQueries: {
      venues: String,
      catering: String,
      entertainment: String,
      photography: String
    },
    uploadGallery: [String], // Array of URLs
    fallbackToPexels: Boolean,
    updatedAt: String, // ISO timestamp
    updatedBy: String  // Admin email
  }
}
```

## Testing Guide

### Manual Testing

#### Admin UI Tests
1. **Enable/Disable Widget**
   - Toggle enabled checkbox
   - Verify settings become disabled/enabled
   - Save and check homepage behavior

2. **Source Selection**
   - Switch between Pexels and Uploads
   - Verify correct panel shows/hides
   - Test mutual exclusivity

3. **Media Upload**
   - Upload single image
   - Upload multiple images (up to 10)
   - Upload video file
   - Test file size limits
   - Test invalid file types

4. **Media Management**
   - View uploaded media gallery
   - Delete individual files
   - Verify file is removed from disk and settings

5. **Configuration Save**
   - Update various settings
   - Save configuration
   - Refresh page and verify settings persist

#### Frontend Tests
1. **Pexels Source**
   - Enable widget with Pexels source
   - Visit homepage
   - Verify images load and cycle
   - Check photographer credits appear

2. **Upload Source**
   - Upload media files
   - Enable widget with Upload source
   - Visit homepage
   - Verify uploaded media displays
   - Test photo/video playback

3. **Video Playback**
   - Upload video files
   - Enable videos in media types
   - Verify videos play (muted, looped)
   - Check mobile compatibility

4. **Fallback Behavior**
   - Enable uploads source with no files
   - Enable fallback to Pexels
   - Verify Pexels loads automatically
   - Disable fallback and verify static images load

5. **Accessibility**
   - Enable system "Reduce Motion" setting
   - Visit homepage
   - Verify transitions are instant/minimal
   - Check videos don't autoplay

### Security Testing
1. **Path Traversal**
   - Try deleting file with `../` in filename
   - Verify 400 error returned

2. **CSRF Protection**
   - Attempt POST/PUT/DELETE without CSRF token
   - Verify 403 error returned

3. **File Type Validation**
   - Try uploading .exe or .php file
   - Verify rejection

4. **Authentication**
   - Access admin endpoints without login
   - Verify redirect to auth page

## Troubleshooting

### Widget Not Appearing
1. Check `collageWidget.enabled` is `true`
2. Verify homepage settings endpoint returns data
3. Check browser console for errors
4. Confirm media is available (Pexels or uploads)

### Videos Not Playing
1. Check video file format (MP4 works best)
2. Verify file size under 10MB
3. Check browser console for codec errors
4. Test in different browsers

### Upload Fails
1. Check file size (max 10MB)
2. Verify file type is supported
3. Check disk space on server
4. Review server logs for errors

### Media Not Cycling
1. Verify `intervalSeconds` is set (1-60)
2. Check JavaScript console for errors
3. Ensure multiple media items exist
4. Test with different interval values

## Future Enhancements

### Potential Features
- [ ] Per-category upload assignment (manual distribution)
- [ ] Video thumbnail generation
- [ ] Image optimization on upload
- [ ] Bulk upload progress indicator
- [ ] Media library organization (folders/tags)
- [ ] Preview mode in admin panel
- [ ] Animation effects selection
- [ ] Custom CSS injection for styling
- [ ] Analytics (view counts, click-through rates)
- [ ] Scheduled media rotation

### Performance Optimizations
- [ ] CDN integration for uploaded media
- [ ] WebP conversion for images
- [ ] Video compression/optimization
- [ ] Lazy loading improvements
- [ ] Service worker caching

## Support

For issues or questions:
1. Check browser console for errors
2. Review server logs in production
3. Verify configuration in admin panel
4. Test with default settings
5. Contact development team with:
   - Browser/version
   - Steps to reproduce
   - Error messages
   - Screenshots if applicable
