# Category Grid Implementation - 2x3 Layout

## Overview

This document describes the implementation of the 2x3 category cards grid on the homepage with admin management capabilities and Pexels API integration.

## Changes Summary

### 1. Homepage Category Grid (2x3 Layout)

#### Frontend Changes

- **File**: `public/assets/js/components/category-grid.js`
- **Grid Layout**: Changed from flexible auto-fill to fixed 2-column layout
- **Card Size**: Increased by 20% (image height: 200px → 240px, font sizes increased proportionally)
- **Responsive**:
  - Desktop: 2 columns
  - Mobile: 1 column
- **Features**:
  - Visibility filtering (only shows categories with `visible: true`)
  - Pexels attribution support
  - Lazy loading for images
  - Hover effects and transitions

### 2. Category Data Structure

#### Updated Fields

```javascript
{
  id: string,                    // Unique identifier
  name: string,                  // Display name
  slug: string,                  // URL-friendly identifier
  description: string,           // Category description
  icon: string,                  // Emoji icon
  heroImage: string,             // Image URL
  pexelsAttribution: string,     // Pexels photo credit (HTML)
  order: number,                 // Display order
  visible: boolean               // Show/hide on homepage
}
```

### 3. Admin Panel - Category Management

#### Location

`public/admin-homepage.html` - New "Category Cards Management" section

#### Features Implemented

**3.1 Category CRUD Operations**

- ✅ Create new categories
- ✅ Edit existing categories
- ✅ Delete categories (with confirmation)
- ✅ Toggle visibility (show/hide)
- ✅ Auto-generate slugs from names

**3.2 Pexels Image Integration**

- ✅ Search Pexels for category images
- ✅ Visual image selection grid (3 columns)
- ✅ Image preview before saving
- ✅ Automatic attribution generation
- ✅ Proper Pexels credit links

**3.3 User Interface**

- ✅ Modal dialog for add/edit
- ✅ Responsive grid display of existing categories
- ✅ Visual feedback (hover states, selected images)
- ✅ Error handling and validation
- ✅ CSRF protection for all API calls

### 4. API Endpoints

#### New Endpoints (Server.js)

**4.1 Create Category**

```
POST /api/admin/categories
```

- Requires: `name`, `slug`
- Optional: `description`, `icon`, `heroImage`, `pexelsAttribution`, `visible`
- Auto-generates unique ID
- Validates slug uniqueness

**4.2 Update Category**

```
PUT /api/admin/categories/:id
```

- Updates any category fields
- Validates slug uniqueness (excluding self)
- Preserves unmodified fields

**4.3 Delete Category**

```
DELETE /api/admin/categories/:id
```

- Removes category completely
- Returns deleted category data

**4.4 Reorder Categories**

```
PUT /api/admin/categories/reorder
Body: { orderedIds: [id1, id2, ...] }
```

- Updates `order` field for all categories
- Maintains sort order

**4.5 Toggle Visibility**

```
PUT /api/admin/categories/:id/visibility
Body: { visible: boolean }
```

- Shows/hides category on homepage
- Instant feedback

### 5. Database/Seed Updates

#### File: `seed.js`

- Updated to create 6 visible categories
- Added 4 hidden categories for future use
- All categories include `visible` field
- Default categories:
  1. Venues (visible)
  2. Catering (visible)
  3. Entertainment (visible)
  4. Photography (visible)
  5. Videography (visible)
  6. Decorations (visible)
  7. Floristry (hidden)
  8. Music & DJs (hidden)
  9. Lighting (hidden)
  10. Transport (hidden)

### 6. CSS Styling

#### File: `public/assets/css/admin-homepage-enhanced.css`

Added 400+ lines of new styles:

- `.admin-category-cards-grid` - Grid container
- `.admin-category-card` - Individual card styling
- `.modal` - Modal dialog with animations
- `.pexels-image-option` - Pexels image selection
- Responsive breakpoints for mobile

### 7. Security Features

- ✅ CSRF protection on all mutations
- ✅ Admin role required for all endpoints
- ✅ Input validation (slug format, required fields)
- ✅ XSS prevention (HTML escaping)
- ✅ Slug uniqueness validation

### 8. Environment Variables

#### Pexels API (Optional)

```
PEXELS_API_KEY=your_api_key_here
```

- Required for Pexels image search
- Get free API key at: https://www.pexels.com/api/
- Gracefully degrades if not configured

## Usage Instructions

### Admin: Adding a New Category

1. Navigate to `/admin-homepage.html`
2. Scroll to "Category Cards Management" section
3. Click "Add Category" button
4. Fill in category details:
   - **Name**: Display name (e.g., "Floristry")
   - **Slug**: Auto-generated from name (e.g., "floristry")
   - **Description**: Brief description
   - **Icon**: Emoji character
5. Search for an image:
   - Enter search term in "Search Pexels" field
   - Click "Search" button
   - Select image from grid
6. Set visibility (checked = visible on homepage)
7. Click "Save Category"

### Admin: Editing a Category

1. Find the category card in the grid
2. Click "✏️ Edit" button
3. Modify any fields
4. Update image if needed (search Pexels again)
5. Click "Save Category"

### Admin: Toggling Visibility

- Use the toggle switch on each category card
- Changes take effect immediately
- Hidden categories don't appear on homepage

### Admin: Deleting a Category

1. Click "🗑️ Delete" button on category card
2. Confirm deletion in dialog
3. Category is permanently removed

## Technical Notes

### Grid Responsiveness

The 2x3 grid adapts to screen size:

- **Desktop (>768px)**: 2 columns, 3 rows
- **Mobile (≤768px)**: 1 column, 6 rows

Card sizing (20% larger than original):

- Image height: 240px (was 200px)
- Padding: 24px (was 20px)
- Icon: 38px (was 32px)
- Title: 1.5rem (was 1.25rem)
- Description: 1.08rem (was 0.9rem)

### Pexels Attribution

When using Pexels images, attribution is automatically generated:

```html
Photo by <a href="{photographer_url}">{photographer}</a> on
<a href="https://www.pexels.com">Pexels</a>
```

This is stored in the `pexelsAttribution` field and displayed on category cards.

### Performance Considerations

- Lazy loading for category card images
- Pexels search results cached server-side (1 hour TTL)
- Image URLs stored directly (no local file storage)
- Async loading of category data

## Testing

### Manual Testing Checklist

- [ ] Homepage displays 6 category cards in 2x3 grid
- [ ] Cards are 20% larger than original
- [ ] Grid is responsive on mobile
- [ ] Only visible categories appear
- [ ] Admin can add new category
- [ ] Admin can edit existing category
- [ ] Admin can delete category
- [ ] Admin can toggle visibility
- [ ] Pexels search returns results
- [ ] Selected image appears in preview
- [ ] Pexels attribution is displayed correctly
- [ ] Slug auto-generation works
- [ ] Validation prevents duplicate slugs
- [ ] CSRF protection works

### API Testing

```bash
# Get all categories
curl http://localhost:3000/api/categories

# Create category (requires auth + CSRF token)
curl -X POST http://localhost:3000/api/admin/categories \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: {token}" \
  --cookie "session={session}" \
  -d '{"name":"Test","slug":"test","visible":true}'

# Update visibility
curl -X PUT http://localhost:3000/api/admin/categories/cat_test/visibility \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: {token}" \
  --cookie "session={session}" \
  -d '{"visible":false}'
```

## Future Enhancements

Potential improvements:

- Drag-and-drop reordering in admin UI
- Bulk operations (hide all, show all)
- Category image upload (in addition to Pexels)
- Category analytics (view counts, click-through rates)
- Multiple image sources per category
- Category hierarchy/subcategories
- Color themes per category

## Files Modified

### Core Functionality

- `public/assets/js/components/category-grid.js` - Category grid component
- `public/assets/js/pages/admin-homepage-init.js` - Admin functionality
- `public/admin-homepage.html` - Admin UI
- `public/assets/css/admin-homepage-enhanced.css` - Admin styles
- `server.js` - API endpoints
- `seed.js` - Initial category data

### Data

- `data/categories.json` - Category storage (created on first run)

## Support

For issues or questions:

- Check server logs for error messages
- Verify PEXELS_API_KEY is set (optional but recommended)
- Ensure admin role is assigned to user
- Check browser console for client-side errors
