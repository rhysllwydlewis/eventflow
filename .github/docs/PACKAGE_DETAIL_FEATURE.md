# Package Detail Feature Documentation

## Overview

The Package Detail Feature enables users to browse packages by category, view detailed package information, and message suppliers directly from package pages. This feature implements a marketplace-like experience with authentication-aware messaging capabilities.

## Feature Components

### Data Model

#### Packages

Packages are the core offerings from suppliers. Each package includes:

- **id**: Unique identifier
- **supplierId**: Reference to the supplier
- **slug**: URL-friendly identifier for routing
- **title**: Package name
- **description**: Full package description
- **price**: Display price (e.g., "£1,200" or "£45 pp")
- **location**: Service location
- **image**: Main package image URL
- **gallery**: Array of gallery images with approval status
- **categories**: Array of category slugs this package belongs to
- **tags**: Array of searchable tags
- **approved**: Admin approval status
- **featured** / **isFeatured**: Featured package flag

#### Categories

Categories organize packages for browsing:

- **id**: Unique identifier
- **name**: Display name (e.g., "Venues", "Catering")
- **slug**: URL-friendly identifier
- **description**: Category description
- **heroImage**: Hero image for category pages
- **icon**: Emoji or icon for visual identification
- **order**: Display order for sorting

#### Suppliers

Enhanced supplier information:

- **logo**: Business logo URL
- **blurb**: Short tagline or description
- **phone**: Contact phone number
- All existing supplier fields (name, email, location, description_short, description_long, etc.)

#### Messages

Messages now support package context:

- **packageId**: Optional reference to related package
- **supplierId**: Optional reference to supplier
- **status**: Message status (sent, read, etc.)
- All existing message fields (id, threadId, fromUserId, text, createdAt, etc.)

#### Threads

Threads now support package context:

- **packageId**: Optional reference to related package when starting conversation

## API Endpoints

### GET /api/categories

Returns list of all categories sorted by order.

**Response:**

```json
{
  "items": [
    {
      "id": "cat_venues",
      "name": "Venues",
      "slug": "venues",
      "description": "Beautiful venues for your perfect event",
      "heroImage": "/assets/images/collage-venue.jpg",
      "icon": "🏛️",
      "order": 1
    }
  ]
}
```

### GET /api/categories/:slug

Returns category details with all packages in that category, sorted featured-first.

**Response:**

```json
{
  "category": {
    "id": "cat_venues",
    "name": "Venues",
    "slug": "venues",
    "description": "Beautiful venues for your perfect event",
    "heroImage": "/assets/images/collage-venue.jpg",
    "icon": "🏛️"
  },
  "packages": [
    {
      "id": "pkg_123",
      "slug": "barn-exclusive",
      "title": "Barn Exclusive",
      "description": "Full-day venue hire...",
      "price": "£3,500",
      "location": "Monmouthshire, South Wales",
      "categories": ["venues"],
      "tags": ["rustic", "barn"],
      "featured": true,
      "image": "https://...",
      "gallery": [...]
    }
  ]
}
```

### GET /api/packages/:slug

Returns complete package details including supplier information and categories.

**Response:**

```json
{
  "package": {
    "id": "pkg_123",
    "slug": "barn-exclusive",
    "title": "Barn Exclusive",
    "description": "Full-day venue hire...",
    "price": "£3,500",
    "location": "Monmouthshire, South Wales",
    "categories": ["venues"],
    "tags": ["rustic", "barn"],
    "featured": true,
    "gallery": [...]
  },
  "supplier": {
    "id": "sup_456",
    "name": "The Willow Barn Venue",
    "logo": "https://...",
    "blurb": "Your perfect rustic wedding venue",
    "email": "contact@willowbarn.com",
    "phone": "01234 567890",
    "location": "Monmouthshire, South Wales"
  },
  "categories": [
    {
      "id": "cat_venues",
      "name": "Venues",
      "slug": "venues",
      "icon": "🏛️"
    }
  ]
}
```

### POST /api/threads/start

Start a conversation with a supplier (requires authentication).

**Request:**

```json
{
  "supplierId": "sup_456",
  "packageId": "pkg_123",
  "message": "I'm interested in this package..."
}
```

**Response (401 if unauthenticated):**

```json
{
  "error": "Authentication required"
}
```

## Routing

The application uses query parameter-based routing:

- **Home**: `/` - Shows category grid and featured packages
- **Category Listing**: `/category.html?slug=venues` - Shows all packages in a category
- **Package Detail**: `/package.html?slug=barn-exclusive` - Shows package details

## Frontend Components

### CategoryGrid

Displays a grid of category cards with icons, images, and descriptions.

**Usage:**

```javascript
const categoryGrid = new CategoryGrid('container-id');
categoryGrid.loadCategories();
```

### PackageList

Displays packages with featured-first sorting and filtering.

**Usage:**

```javascript
const packageList = new PackageList('container-id', {
  sortFeaturedFirst: true,
  cardLayout: 'grid',
});
packageList.setPackages(packages);
```

### PackageGallery

Image carousel with thumbnails and navigation.

**Usage:**

```javascript
const gallery = new PackageGallery('container-id', images);
```

### SupplierCard

Displays supplier information with logo, contact details, and actions.

**Usage:**

```javascript
const supplierCard = new SupplierCard('container-id', supplier);
```

### MessageSupplierPanel

Authentication-aware message panel for contacting suppliers.

**Usage:**

```javascript
const messagePanel = new MessageSupplierPanel('container-id', {
  supplierId: 'sup_456',
  packageId: 'pkg_123',
  supplierName: 'The Willow Barn',
});
```

### AuthGate

Utility for authentication state management.

**Features:**

- `isAuthenticated()` - Check if user is logged in
- `getUser()` - Get current user object
- `redirectToLogin()` - Redirect to login page
- `storePendingAction()` - Store action to execute after login
- `getPendingAction()` - Retrieve and clear pending action

## Authentication Handling

### Message Supplier Behavior

**When Not Logged In:**

1. User sees a prompt to create account or log in
2. Send button is disabled
3. If user types a message, it's stored in sessionStorage as a pending action
4. After login, user is redirected back with pending message pre-filled

**When Logged In:**

1. User sees active textarea and send button
2. Messages are sent via API with authentication
3. 401 responses trigger redirect to login
4. Successful sends redirect to customer dashboard messages

### Pending Message Flow

1. User visits package page while not authenticated
2. User types message in panel
3. User clicks "Log In" or "Create Account"
4. Message is saved via `AuthGate.storePendingAction('supplier_message', data)`
5. User completes authentication
6. Upon return, message is restored and highlighted
7. User can review and send the message

## Empty States

### Category with No Packages

```
No packages available in this category yet.
Check back soon for new offerings!
```

### Package Not Found

```
Package not found
The package you're looking for could not be found. Return home
```

## Feature-First Sorting

All package listings use featured-first sorting:

```javascript
packages.sort((a, b) => {
  const aFeatured = a.featured || a.isFeatured || false;
  const bFeatured = b.featured || b.isFeatured || false;
  if (aFeatured && !bFeatured) return -1;
  if (!aFeatured && bFeatured) return 1;
  return 0;
});
```

## Security Considerations

1. **Authentication Required for Messaging**: All message endpoints require authentication
2. **CSRF Protection**: Message submission requires CSRF token
3. **Input Validation**: All user inputs are validated and sanitized server-side
4. **XSS Prevention**: All user-generated content is properly escaped
5. **SQL Injection Prevention**: Using parameterized queries (when database is active)

## Browser Support

- Modern browsers with ES6 support
- CSS Grid and Flexbox for layouts
- Fetch API for HTTP requests
- localStorage and sessionStorage for client-side state

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Alt text on all images
- Color contrast ratios meet WCAG AA standards

## Future Enhancements

1. Advanced filtering (price range, location radius)
2. Package comparison feature
3. Reviews and ratings on packages
4. Favorite/save packages functionality
5. Share package via social media
6. Print-friendly package details
7. Package availability calendar
8. Real-time messaging (WebSocket integration)
