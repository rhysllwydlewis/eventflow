# Architecture Improvements Documentation

## Overview

This document describes the comprehensive architecture improvements implemented across the EventFlow application, including service layer extraction, standardized error handling, middleware consolidation, and database optimization.

## Table of Contents

1. [Error Handling System](#error-handling-system)
2. [Service Layer](#service-layer)
3. [Database Optimization](#database-optimization)
4. [Caching Layer](#caching-layer)
5. [Middleware Updates](#middleware-updates)
6. [Migration Guide](#migration-guide)

---

## Error Handling System

### Custom Error Classes

All custom error classes extend `BaseError` and provide consistent error handling across the application.

**Location:** `/errors/`

**Available Error Classes:**

- `BaseError` - Base class for all custom errors
- `ValidationError` (400) - Input validation errors
- `AuthenticationError` (401) - Authentication failures
- `AuthorizationError` (403) - Permission errors
- `NotFoundError` (404) - Resource not found errors
- `ConflictError` (409) - Resource conflict errors
- `InternalError` (500) - Server errors

### Usage Example

```javascript
const { ValidationError, NotFoundError } = require('../errors');

// In a service method
if (!data.name) {
  throw new ValidationError('Name is required');
}

const user = await getUserById(id);
if (!user) {
  throw new NotFoundError('User not found');
}
```

### Error Handler Middleware

The global error handler (`middleware/errorHandler.js`) automatically handles both:

- Custom `BaseError` instances (returns `error.toJSON()`)
- Legacy errors (maintains backward compatibility)

**Features:**

- Proper HTTP status codes
- Sentry integration for 5xx errors
- Environment-aware error details
- Structured JSON responses

---

## Service Layer

### Architecture

Services encapsulate business logic and are separated from HTTP concerns (routes).

**Location:** `/services/`

**Benefits:**

- ✅ Separation of concerns
- ✅ Easier unit testing
- ✅ Code reusability
- ✅ Consistent error handling
- ✅ Better maintainability

### Available Services

#### 1. Auth Service (`auth.service.js`)

Handles user authentication and account management.

**Methods:**

- `register(data)` - Register new user
- `login(email, password)` - Login user
- `requestPasswordReset(email)` - Send password reset email
- `resetPassword(token, newPassword)` - Reset password with token
- `verifyEmail(token)` - Verify email address
- `generateToken(user)` - Generate JWT token
- `validateToken(token)` - Validate JWT token

**Example:**

```javascript
const authService = require('./services/auth.service');

// In a route
router.post('/register', async (req, res, next) => {
  try {
    const { user, token } = await authService.register(req.body);
    res.status(201).json({ user, token });
  } catch (error) {
    next(error); // Handled by global error handler
  }
});
```

#### 2. User Service (`user.service.js`)

Handles user profile management.

**Methods:**

- `getUserById(id)` - Get user by ID
- `getUserByEmail(email)` - Get user by email
- `updateUser(id, updates, requestUserId, requestUserRole)` - Update user
- `changePassword(userId, currentPassword, newPassword)` - Change password
- `deleteUser(id, requestUserId, requestUserRole)` - Delete user
- `listUsers(filters, requestUserRole)` - List users (admin only)
- `updatePreferences(userId, preferences)` - Update user preferences

#### 3. Package Service (`package.service.js`)

Handles package CRUD operations.

**Constructor:**

```javascript
const PackageService = require('./services/package.service');
const packageService = new PackageService(dbUnified, uid);
```

**Methods:**

- `createPackage(data, userId, userRole)` - Create package
- `getPackageById(id)` - Get package details
- `updatePackage(id, updates, userId, userRole)` - Update package
- `deletePackage(id, userId, userRole)` - Delete package
- `searchPackages(filters)` - Search packages
- `getPackagesBySupplier(supplierId)` - Get supplier packages
- `getFeaturedPackages(limit)` - Get featured packages

#### 4. Supplier Service (`supplier.service.js`)

Handles supplier profile management.

**Constructor:**

```javascript
const SupplierService = require('./services/supplier.service');
const supplierService = new SupplierService(dbUnified, uid);
```

**Methods:**

- `createSupplier(data, userId)` - Create supplier profile
- `getSupplierById(id)` - Get supplier details
- `getSupplierByUserId(userId)` - Get supplier by user ID
- `updateSupplier(id, updates, userId, userRole)` - Update supplier
- `deleteSupplier(id, userId, userRole)` - Delete supplier
- `searchSuppliers(filters)` - Search suppliers
- `isProActive(id)` - Check Pro status
- `updateProStatus(id, isPro, expiresAt)` - Update Pro status
- `getFeaturedSuppliers(limit)` - Get featured suppliers

#### 5. Discovery Service (`discovery.service.js`)

Handles package discovery and recommendations.

**Constructor:**

```javascript
const DiscoveryService = require('./services/discovery.service');
const discoveryService = new DiscoveryService(dbUnified);
```

**Methods:**

- `getTrendingPackages(limit)` - Get trending packages (cached)
- `getNewArrivals(limit)` - Get new packages (cached)
- `getPopularPackages(limit)` - Get popular packages (cached)
- `getRecommendations(userId, limit)` - Get personalized recommendations
- `invalidateCaches()` - Invalidate discovery caches

#### 6. Settings Service (`settings.service.js`)

Handles user settings and preferences.

**Constructor:**

```javascript
const SettingsService = require('./services/settings.service');
const settingsService = new SettingsService(dbUnified);
```

**Methods:**

- `getSettings(userId)` - Get user settings
- `updateNotificationSettings(userId, settings)` - Update notifications
- `updateProfileSettings(userId, profile)` - Update profile
- `updatePreferences(userId, preferences)` - Update preferences
- `exportUserData(userId)` - Export user data (GDPR)

---

## Database Optimization

### Database Indexes

Indexes are automatically created on server startup for optimal query performance.

**Location:** `/utils/database.js`

**Indexed Collections:**

**Users:**

- `email` (unique)
- `createdAt`

**Suppliers:**

- `name`
- `category`
- `location`
- `isPro`
- `createdAt`

**Packages:**

- `name`
- `supplierId`
- `category`
- `price`
- `createdAt`
- `rating`
- Text search index on `name` and `description`

**Reviews:**

- `packageId`
- `userId`
- `supplierId`
- `rating`
- `createdAt`

**Messages:**

- `threadId, createdAt` (compound)
- `senderId`
- `recipientId`
- `read`

**Threads:**

- `participants`
- `lastMessageAt`

**Notifications:**

- `userId, read` (compound)
- `createdAt`

### Query Helpers

**Pagination Helper:**

```javascript
const { paginationHelper } = require('../utils/database');

const { skip, limit, page } = paginationHelper(req.query.page, req.query.limit);
// Returns: { skip: 0, limit: 20, page: 1 }
```

**Sort Helper:**

```javascript
const { buildSortObject } = require('../utils/database');

const sort = buildSortObject('createdAt', 'desc');
// Returns: { createdAt: -1 }
```

### Server Integration

Database indexes are created automatically on server startup:

```javascript
// In server.js
const { addDatabaseIndexes } = require('./utils/database');

// Called after database connection
await addDatabaseIndexes();
```

---

## Caching Layer

### In-Memory Cache

Simple in-memory caching for frequently accessed data.

**Location:** `/utils/cache.js`

**Methods:**

```javascript
const {
  getCachedData,
  setCachedData,
  invalidateCache,
  invalidateCachePattern,
  clearCache,
  getCacheStats,
} = require('../utils/cache');

// Set cache with TTL (default: 600 seconds)
setCachedData('user:123', userData, 600);

// Get cached data
const data = getCachedData('user:123');

// Invalidate specific key
invalidateCache('user:123');

// Invalidate pattern
invalidateCachePattern('user:'); // Removes all keys containing 'user:'

// Get cache statistics
const stats = getCacheStats();
// Returns: { size, active, expired }
```

**Features:**

- Automatic TTL expiration
- Pattern-based invalidation
- Automatic cleanup (every 5 minutes)
- Cache statistics

**Usage Example:**

```javascript
// In discovery service
async getTrendingPackages(limit = 20) {
  const cacheKey = `trending:packages:${limit}`;
  const cached = getCachedData(cacheKey);

  if (cached) {
    return cached;
  }

  // Fetch data...
  const result = await fetchTrendingPackages(limit);

  // Cache for 1 hour
  setCachedData(cacheKey, result, 3600);

  return result;
}
```

---

## Middleware Updates

### AsyncHandler Utility

Automatically catches errors in async route handlers.

**Location:** `/middleware/index.js`

**Usage:**

```javascript
const { asyncHandler } = require('../middleware');

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
    // Errors automatically caught and passed to error handler
  })
);
```

### Middleware Exports

All middleware is now exported from a central location:

```javascript
const {
  authRequired,
  roleRequired,
  csrfProtection,
  asyncHandler,
  // ... and more
} = require('../middleware');
```

---

## Migration Guide

### Migrating Routes to Use Services

**Before:**

```javascript
router.post('/packages', authRequired, async (req, res) => {
  try {
    const packages = read('packages');

    // Validation
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Business logic
    const pkg = {
      id: uid('pkg'),
      ...req.body,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    };

    packages.push(pkg);
    write('packages', packages);

    res.status(201).json(pkg);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
```

**After:**

```javascript
const { asyncHandler } = require('../middleware');
const PackageService = require('../services/package.service');
const packageService = new PackageService(dbUnified, uid);

router.post(
  '/packages',
  authRequired,
  asyncHandler(async (req, res) => {
    const pkg = await packageService.createPackage(req.body, req.user.id, req.user.role);
    res.status(201).json(pkg);
    // Errors automatically handled by global error handler
  })
);
```

### Best Practices

1. **Always use asyncHandler** for async routes
2. **Throw custom errors** from services
3. **Let the error handler handle errors** - don't catch in routes
4. **Initialize services** once and reuse
5. **Use caching** for frequently accessed data
6. **Invalidate caches** when data changes

### Example: Complete Route Migration

```javascript
const express = require('express');
const router = express.Router();
const { authRequired, asyncHandler } = require('../middleware');
const { dbUnified, uid } = require('../config/database');
const PackageService = require('../services/package.service');

// Initialize service
const packageService = new PackageService(dbUnified, uid);

// Create package
router.post(
  '/packages',
  authRequired,
  asyncHandler(async (req, res) => {
    const pkg = await packageService.createPackage(req.body, req.user.id, req.user.role);
    res.status(201).json(pkg);
  })
);

// Get package
router.get(
  '/packages/:id',
  asyncHandler(async (req, res) => {
    const pkg = await packageService.getPackageById(req.params.id);
    res.json(pkg);
  })
);

// Update package
router.put(
  '/packages/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const pkg = await packageService.updatePackage(
      req.params.id,
      req.body,
      req.user.id,
      req.user.role
    );
    res.json(pkg);
  })
);

// Delete package
router.delete(
  '/packages/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    await packageService.deletePackage(req.params.id, req.user.id, req.user.role);
    res.status(204).send();
  })
);

// Search packages
router.get(
  '/packages',
  asyncHandler(async (req, res) => {
    const results = await packageService.searchPackages(req.query);
    res.json(results);
  })
);

module.exports = router;
```

---

## Benefits Summary

✅ **Separation of Concerns** - Routes handle HTTP, services handle logic  
✅ **Testability** - Services are easier to unit test  
✅ **Reusability** - Services can be used by different routes/consumers  
✅ **Maintainability** - Clear code organization and responsibility  
✅ **Scalability** - Easy to add new features without modifying routes  
✅ **Error Consistency** - Standardized error responses  
✅ **Performance** - Database indexes and caching  
✅ **Code Quality** - Reduced duplication, better organization

---

## Future Enhancements

1. **Service Unit Tests** - Add comprehensive unit tests for services
2. **Redis Caching** - Replace in-memory cache with Redis for multi-instance deployments
3. **Service Events** - Implement event emitters for cross-service communication
4. **Data Transfer Objects** - Add DTOs for request/response validation
5. **Service Decorators** - Add decorators for logging, caching, etc.
6. **GraphQL Layer** - Add GraphQL API using services
7. **API Documentation** - Auto-generate API docs from services
8. **Performance Monitoring** - Add service-level performance tracking

---

## Questions or Issues?

For questions or issues related to the architecture improvements, please:

1. Check this documentation first
2. Review the existing service implementations in `/services/`
3. Check error handling patterns in `/errors/`
4. Consult the team or open an issue

---

_Last Updated: 2026-02-10_
