# Route Migration Plan for EventFlow Server.js

## Executive Summary

This document outlines a systematic approach to migrating the remaining inline routes from `server.js` into modular route files. The migration is designed to be completed incrementally over 6-8 PRs, maintaining stability and test coverage at each step.

## Current State (After Hybrid Migration)

### Completed ✅

- **Configuration modules**: 4 files (database, email, stripe, storage)
- **Middleware modules**: 3 new files (security, errorHandler, index)
- **Service modules**: 2 files (email, upload)
- **Utility modules**: 3 files (logger, validators, helpers)
- **System routes**: Extracted to `routes/system.js` (health, ready, config, csrf-token, meta)
- **Specialized routes**: Already in dedicated files (auth, admin, messages, payments, pexels, profile, reports, tickets, webhooks)

### File Size Progress

- **Original**: 190KB (6,195 lines)
- **After initial refactoring**: 178KB (5,803 lines)
- **After hybrid migration**: 168KB (5,618 lines)
- **Total reduction**: 22KB (11.6%)

### Remaining to Migrate

**64 inline routes** across the following categories:

- Suppliers API (4 routes)
- Packages API (4 routes)
- Categories API (2 routes)
- Plans API (8 routes)
- Notes API (2 routes)
- Marketplace API (6 routes)
- Threads API (3 routes)
- Discovery API (4 routes)
- Search API (4 routes)
- Reviews API (4 routes)
- Photos API (8 routes)
- Metrics API (3 routes)
- Cache API (2 routes)
- Miscellaneous API (10 routes)

## Migration Strategy

### Phase-Based Approach

Each phase represents a single PR with focused changes, comprehensive testing, and rollback capability.

### Principles

1. **One category per PR** - Reduces complexity and risk
2. **Test after each migration** - Ensure 473/473 tests pass
3. **Incremental validation** - Server must start and function correctly
4. **Dependency injection** - Use the pattern established in system.js
5. **Backward compatibility** - Zero breaking changes

## Detailed Migration Plan

### Phase 1: Suppliers & Packages Routes (PR #5)

**Time estimate**: 45-60 minutes  
**Risk**: Low  
**Routes**: 8 total

#### Files to Create

- `routes/suppliers.js` - Supplier listing, detail, and package endpoints

#### Routes to Extract

```javascript
GET  /api/suppliers              // List all suppliers
GET  /api/suppliers/:id          // Get supplier details
GET  /api/suppliers/:id/packages // Get supplier's packages
GET  /api/me/suppliers           // Get current user's suppliers (supplier role)

GET  /api/packages/featured      // Featured packages
GET  /api/packages/spotlight     // Spotlight packages
GET  /api/packages/search        // Search packages
GET  /api/packages/:slug         // Get package by slug
```

#### Dependencies Needed

- `dbUnified` - Database access
- `authRequired`, `roleRequired` - Authentication middleware
- `searchSystem` - Search functionality
- `reviewsSystem` - Reviews integration

#### Testing Focus

- Supplier listing with pagination
- Package search functionality
- Featured/spotlight packages
- Authenticated supplier access

---

### Phase 2: Categories Routes (PR #6)

**Time estimate**: 20-30 minutes  
**Risk**: Very Low  
**Routes**: 2 total

#### Files to Create

- `routes/categories.js` - Category listing and detail endpoints

#### Routes to Extract

```javascript
GET /api/categories      // List all categories
GET /api/categories/:slug // Get category by slug
```

#### Dependencies Needed

- `dbUnified` - Database access

#### Testing Focus

- Category listing
- Category detail retrieval
- Slug-based lookup

---

### Phase 3: Plans & Notes Routes (PR #7)

**Time estimate**: 60-75 minutes  
**Risk**: Medium (complex business logic)  
**Routes**: 10 total

#### Files to Create

- `routes/plans.js` - Plan management endpoints

#### Routes to Extract

```javascript
GET    /api/plan                    // Get user's plan
POST   /api/plan                    // Create plan
DELETE /api/plan/:supplierId        // Remove supplier from plan
POST   /api/plans/guest             // Create guest plan
POST   /api/me/plans/claim          // Claim guest plan

GET    /api/notes                   // Get user's notes
POST   /api/notes                   // Create note
PUT    /api/notes/:id               // Update note
DELETE /api/notes/:id               // Delete note
GET    /api/notes/export            // Export notes (PDF)
```

#### Dependencies Needed

- `dbUnified` - Database access
- `authRequired` - Authentication
- `uid` - ID generation
- `csrfProtection` - CSRF middleware
- `PDFDocument` - PDF generation
- `writeLimiter` - Rate limiting

#### Testing Focus

- Guest plan creation and claiming
- Plan CRUD operations
- Notes management
- PDF export functionality

---

### Phase 4: Marketplace & Threads Routes (PR #8)

**Time estimate**: 60-75 minutes  
**Risk**: Medium  
**Routes**: 9 total

#### Files to Create

- `routes/marketplace.js` - Marketplace listing endpoints
- `routes/threads.js` - Thread/messaging endpoints

#### Routes to Extract

```javascript
// Marketplace
GET  /api/marketplace/listings        // List marketplace items
GET  /api/marketplace/listings/:id    // Get listing details
GET  /api/marketplace/my-listings     // Get user's listings
POST /api/marketplace/listings        // Create listing
PUT  /api/marketplace/listings/:id    // Update listing
DELETE /api/marketplace/listings/:id  // Delete listing

// Threads
POST /api/threads/start               // Start new thread
GET  /api/threads/my                  // Get user's threads
GET  /api/threads/:id/messages        // Get thread messages
```

#### Dependencies Needed

- `dbUnified` - Database access
- `authRequired` - Authentication
- `csrfProtection` - CSRF middleware
- `writeLimiter` - Rate limiting
- `uid` - ID generation

#### Testing Focus

- Marketplace CRUD operations
- Thread creation and retrieval
- Message threading
- Authorization checks

---

### Phase 5: Discovery, Search & Reviews Routes (PR #9)

**Time estimate**: 60-75 minutes  
**Risk**: Medium (search complexity)  
**Routes**: 12 total

#### Files to Create

- `routes/discovery.js` - Discovery and recommendation endpoints
- `routes/search.js` - Search endpoints
- `routes/reviews.js` - Review management endpoints

#### Routes to Extract

```javascript
// Discovery
GET  /api/discovery/recommended       // Get recommendations
GET  /api/discovery/trending          // Trending items
GET  /api/discovery/nearby            // Nearby suppliers
POST /api/discovery/track             // Track user interaction

// Search
GET  /api/search                      // Global search
GET  /api/search/suppliers            // Search suppliers
GET  /api/search/packages             // Search packages
GET  /api/venues/near                 // Nearby venues (geocoding)

// Reviews
GET    /api/reviews                   // List reviews
POST   /api/reviews                   // Create review
PUT    /api/reviews/:id               // Update review
DELETE /api/reviews/:id               // Delete review
```

#### Dependencies Needed

- `dbUnified` - Database access
- `authRequired` - Authentication
- `searchSystem` - Search functionality
- `reviewsSystem` - Review system
- `geocoding` - Location services
- `csrfProtection` - CSRF middleware

#### Testing Focus

- Search functionality
- Review CRUD operations
- Geocoding accuracy
- Discovery recommendations

---

### Phase 6: Photos & Media Routes (PR #10)

**Time estimate**: 75-90 minutes  
**Risk**: Medium-High (file uploads, image processing)  
**Routes**: 8 total

#### Files to Create

- `routes/photos.js` - Photo upload and management endpoints

#### Routes to Extract

```javascript
POST   /api/photos/upload            // Upload photo
GET    /api/photos/:id               // Get photo
DELETE /api/photos/:id               // Delete photo
POST   /api/photos/:id/approve       // Approve photo (admin)
POST   /api/photos/:id/reject        // Reject photo (admin)
GET    /api/photos/pending           // Get pending photos (admin)
GET    /api/me/photos                // Get user's photos
POST   /api/photos/:id/set-primary   // Set as primary photo
```

#### Dependencies Needed

- `dbUnified`, `mongoDb` - Database access
- `authRequired`, `roleRequired` - Authentication
- `photoUpload` - Photo upload utilities
- `csrfProtection` - CSRF middleware
- `writeLimiter` - Rate limiting
- `sharp` - Image processing

#### Testing Focus

- Photo upload functionality
- Image processing (thumbnails, optimization)
- Admin approval workflow
- Storage backend (Cloudinary/local)

---

### Phase 7: Metrics, Cache & Miscellaneous Routes (PR #11)

**Time estimate**: 45-60 minutes  
**Risk**: Low  
**Routes**: 15 total

#### Files to Create

- `routes/metrics.js` - Metrics and analytics endpoints
- `routes/cache.js` - Cache management endpoints
- `routes/misc.js` - Miscellaneous utility endpoints

#### Routes to Extract

```javascript
// Metrics
POST / api / metrics / track; // Track metric
GET / api / admin / metrics / timeseries; // Get timeseries data
GET / api / admin / metrics; // Get metrics summary

// Cache
GET / api / admin / cache / stats; // Cache statistics
DELETE / api / admin / cache / clear; // Clear cache

// Miscellaneous
GET / api / user; // Get user info (alias)
POST / api / verify - captcha; // Verify hCaptcha
POST / api / csp - report; // CSP violation reporting
GET / api / me / settings; // Get user settings
POST / api / me / settings; // Update user settings
POST / api / maintenance / enable; // Enable maintenance mode
POST / api / maintenance / disable; // Disable maintenance mode
GET / api / maintenance / status; // Check maintenance status
```

#### Dependencies Needed

- `dbUnified` - Database access
- `authRequired`, `roleRequired` - Authentication
- `cache` - Cache system
- `verifyHCaptcha` - Captcha verification
- `csrfProtection` - CSRF middleware
- `writeLimiter` - Rate limiting

#### Testing Focus

- Metrics tracking
- Cache operations
- Settings management
- Maintenance mode

---

### Phase 8: Final Cleanup & Documentation (PR #12)

**Time estimate**: 30-45 minutes  
**Risk**: Very Low

#### Tasks

1. Remove backup files (server.js.bak, server.js.original, server.js.backup2)
2. Update README with new architecture documentation
3. Create API documentation using Swagger
4. Add migration notes to CHANGELOG
5. Verify all 473 tests pass
6. Run performance benchmarks
7. Update deployment documentation

---

## Technical Implementation Pattern

### Route File Template

```javascript
/**
 * [Category] Routes
 * Description of what these routes handle
 */

'use strict';

const express = require('express');
const router = express.Router();

// Dependencies injected by server.js
let dependencies = {};

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  dependencies = deps;
}

// Route definitions
router.get('/endpoint', async (req, res) => {
  // Use dependencies.dbUnified, etc.
});

// Export router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
```

### Server.js Integration Pattern

```javascript
// In server.js, prepare dependencies
const categoryDeps = {
  dbUnified,
  authRequired,
  roleRequired,
  // ... other dependencies
};

// In routes/index.js
const categoryRoutes = require('./category');
if (deps.category) {
  categoryRoutes.initializeDependencies(deps.category);
}
app.use('/api/category', categoryRoutes);
```

---

## Testing Strategy

### For Each Phase

1. **Unit Tests** - Verify individual route handlers
2. **Integration Tests** - Test route interactions
3. **Regression Tests** - Ensure existing functionality works
4. **Performance Tests** - Check for performance degradation

### Test Checklist (Per Phase)

- [ ] All existing tests pass (473/473)
- [ ] Server starts without errors
- [ ] Routes respond correctly
- [ ] Authentication/authorization works
- [ ] Rate limiting functions
- [ ] Error handling works
- [ ] Database operations succeed
- [ ] File uploads work (if applicable)
- [ ] External services integrate (if applicable)

---

## Rollback Strategy

### For Each Phase

1. Keep original server.js as `server.js.phase-N.backup`
2. If issues occur:
   - Restore backup: `cp server.js.phase-N.backup server.js`
   - Remove new route files
   - Revert routes/index.js changes
3. Run tests to verify rollback

---

## Time Management & Constraints

### Working Within AI Limitations

Given typical AI session time constraints (15-30 minutes of focused work), here's how to structure each phase:

#### Session 1 (15-20 min): Planning & Setup

- Review phase requirements
- Create route file skeleton
- Identify all dependencies
- Set up test environment

#### Session 2 (15-20 min): Core Implementation

- Extract first half of routes
- Implement dependency injection
- Update routes/index.js
- Initial testing

#### Session 3 (15-20 min): Complete & Validate

- Extract remaining routes
- Run full test suite
- Fix any issues
- Document changes

#### Session 4 (10-15 min): Review & Commit

- Code review
- Security scan
- Performance check
- Commit and push

### Parallel Work Opportunities

- Multiple developers can work on different phases simultaneously
- Each phase is independent after Phase 1
- Tests prevent conflicts

---

## Risk Mitigation

### High-Risk Areas

1. **Plans/Notes** - Complex business logic
2. **Photos** - File handling and storage
3. **Search** - Performance implications
4. **Discovery** - Algorithm dependencies

### Mitigation Strategies

- Extra testing for high-risk areas
- Feature flags for gradual rollout
- Monitoring and logging
- Quick rollback procedures

---

## Success Metrics

### Per Phase

- ✅ All 473 tests passing
- ✅ Server starts in < 5 seconds
- ✅ No increase in response times
- ✅ Zero production errors
- ✅ Code review approval
- ✅ Security scan clean

### Overall Project

- ✅ Server.js reduced to < 50KB
- ✅ 12+ modular route files
- ✅ 100% test coverage maintained
- ✅ Zero breaking changes
- ✅ Improved code maintainability
- ✅ Better developer experience

---

## Post-Migration Benefits

1. **Maintainability**: Easier to find and modify routes
2. **Testability**: Routes can be tested in isolation
3. **Scalability**: New routes easy to add
4. **Collaboration**: Multiple developers can work on different route files
5. **Documentation**: Each file is self-documenting
6. **Performance**: Potential for lazy-loading routes
7. **Security**: Easier to audit and secure individual route categories

---

## Conclusion

This migration plan provides a clear, systematic approach to completing the server.js refactoring. By following the phase-based strategy, the team can achieve the 20KB server.js target while maintaining stability and confidence at every step.

**Estimated Total Time**: 6-8 hours of focused development work spread across 7 PRs  
**Expected Result**: Fully modular, maintainable EventFlow server architecture  
**Risk Level**: Low to Medium (with proper testing and rollback procedures)

---

## Quick Reference: Next Steps

**Immediate Next Action** (PR #5):

1. Create `routes/suppliers.js`
2. Extract 8 supplier/package routes
3. Test thoroughly
4. Commit and merge
5. Move to Phase 2

**Contact**: For questions or issues during migration, refer to this document and the established patterns in `routes/system.js`.
