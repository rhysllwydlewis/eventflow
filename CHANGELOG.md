# Changelog

All notable changes to EventFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Server Architecture Refactoring**: Modular architecture with 24% reduction in server.js size
  - Extracted inline middleware to dedicated files (`middleware/seo.js`, `middleware/adminPages.js`)
  - Enhanced `middleware/auth.js` with `userExtractionMiddleware()`
  - Enhanced `middleware/cache.js` with API cache control and static caching middleware
  - Extracted route handlers to modular files (`routes/static.js`, `routes/dashboard.js`, `routes/settings.js`)
  - Enhanced `routes/photos.js` with GET /photos/:id endpoint for MongoDB photo serving
  - Removed duplicate route definitions (auth, photos, public stats)
  - Reduced server.js from 4904 lines (152KB) to 3760 lines (117KB)
  - Improved code maintainability and organization
  - Preserved all existing functionality and backward compatibility
  - Maintained deferred middleware patterns for MongoDB initialization

### Added

- **Documentation**: Created `REFACTORING_SUMMARY.md` documenting architecture improvements

## [18.1.0] - 2026-01-24

### Added

- **Gold Standard Homepage Redesign**: Apple-inspired Liquid Glass UI transformation
  - **Design System Foundation**: New `design-system.css` with 8px grid spacing scale and fluid typography tokens
  - **Liquid Glass Components**: New `liquid-glass.css` with reusable glass effect classes (ef-glass, variants, fallbacks)
  - **Enhanced Glass Effects**: Multi-layer depth with improved backdrop filters, borders, and shadows
  - **Premium Input Styling**: Search input with enhanced glass effect, multi-layer shadows, and GPU acceleration
  - **Liquid Button Effects**: Search button with premium gradient, glass-like depth, and idle glow animation
  - **Uniform CTA Buttons**: Consistent 48px height CTAs with proper alignment and responsive behavior
  - **6-Tier Responsive Design**: Optimized breakpoints (<320px, 320-479px, 480-639px, 640-767px, 768-1023px, 1024px+)
  - **Premium Animations**: Staggered entrance animations (efGlassEnter) with blur and scale effects
  - **Floating Background Blobs**: Organic blob animations for visual depth
  - **Accessibility Enhancements**:
    - Enhanced focus-visible indicators (3px outline with offset)
    - High contrast mode support with solid colors
    - Windows forced colors mode compatibility
    - Comprehensive reduced motion support
  - **Performance Optimizations**:
    - GPU acceleration hints (translateZ, backface-visibility)
    - CSS containment for better paint performance
    - Strategic will-change management on interactions only

### Changed

- **Hero Search Input**: Upgraded to 56px height with enhanced glass effects
- **Hero Search Button**: Upgraded to 56px square with premium gradient and glow
- **CTA Styling**: Modernized with design system tokens and uniform sizing
- **Version**: Bumped to v18.1.0 across all files (package.json, server.js, sw.js)
- **CSS Imports**: Added design-system.css and liquid-glass.css as critical stylesheets

### Design System

- **Spacing Scale**: 8px-based grid system (--space-1 through --space-10)
- **Typography Scale**: Fluid clamp() values for responsive text sizing
- **Color Tokens**: Glass backgrounds, borders, shadows, and brand gradients
- **Animation Tokens**: Cubic-bezier easing functions and duration constants

## [18.0.2] - 2026-01-24

### Added

- **Search Rating Sorting**: Supplier search now uses actual review data for rating-based sorting
  - Reviews fetched and aggregated in real-time
  - `calculatedRating` and `reviewCount` added to search results
- **Photo Management Endpoints**: Complete photo gallery API
  - `GET /api/me/suppliers/:id/photos` - List supplier photos
  - `DELETE /api/me/suppliers/:id/photos/:photoId` - Delete specific photo
  - Automatic file cleanup on deletion
- **Analytics Service**: Track supplier profile views and enquiries
  - `services/analyticsService.js` - New service for analytics tracking
  - Daily aggregation with detailed tracking
  - 7/30/90 day period support
- **Pagination Utilities**: Standardized pagination across all list endpoints
  - `utils/pagination.js` - Reusable pagination helpers
  - Consistent response format with `hasNextPage`, `hasPrevPage`, etc.
- **Push Notification Infrastructure**: Firebase Cloud Messaging support
  - FCM integration in notificationService
  - Device token management
  - Automatic invalid token cleanup

### Changed

- **Gallery Page**: Now uses actual photos API instead of empty state
  - Delete functionality wired up
  - Proper error handling
- **Security Documentation**: CSP inline handler risk documented with remediation plan

### Fixed

- **Search Sorting**: Rating sort now uses live review data instead of stale supplier field
- **MOP_UP Items**: Addressed all items from MOP_UP_REVIEW_COMPREHENSIVE.md

### Security

- **CSRF Protection**: Verified all state-changing routes have CSRF middleware
- **CSP Documentation**: Documented inline handler risks and remediation plan
- **Path Traversal Protection**: Photo deletion validates resolved paths stay within public directory

## [18.0.1] - 2026-01-24

### Added

- **Complete Auth Navigation System**: Full-featured auth-nav.js implementation
  - `handleLogout()` function with proper verification
  - Duplicate event handler prevention using cloneNode pattern
  - Cache-busting on /api/auth/me calls with timestamp and headers
  - Periodic auth state validation every 30 seconds
  - Cross-tab logout synchronization via localStorage events
  - Immediate navbar update on logout before redirect
- **WebSocket v2 E2E Tests**: End-to-end tests for real-time features
  - Connection and endpoint availability tests
  - Messaging UI load tests
  - Documentation verification tests
- **Email Webhook Handlers**: Complete implementation of Postmark webhook handlers
  - Delivery tracking in `email_logs` collection
  - Bounce logging in `email_bounces` collection with user marking for hard bounces
  - Spam complaint handling with automatic unsubscribe in `email_complaints` collection
  - Subscription change tracking via link tracker
  - Email open tracking in `email_opens` collection
  - Link click tracking in `email_clicks` collection

### Fixed

- **Auth State Tests**: All 8 auth-state-fixes integration tests now pass
  - `handleLogout` function properly defined and exported
  - cloneNode pattern for duplicate handler prevention
  - Cache-Control headers on auth API calls
  - Logout verification before redirect
  - Periodic validation with setInterval
  - Cross-tab synchronization with storage events

### Changed

- **Version Bump**: Updated to v18.0.1 across all version references
  - package.json version
  - server.js APP_VERSION
  - home-init.js version label
  - sw.js CACHE_VERSION

### Security

- **Email Bounce Handling**: Hard bounces now mark user emails as invalid to prevent repeated delivery attempts
- **Spam Complaint Response**: Automatic unsubscription on spam complaints to maintain sender reputation
- **Auth State Verification**: Logout now verifies completion before redirect to prevent stale sessions

## [18.0.0] - 2026-01-23

### Added

- **Subscription-Based Messaging Limits**: Message and thread creation limits based on subscription tier
  - Free tier: 10 messages/day, 3 threads/day, 500 char limit
  - Starter tier: 50 messages/day, 10 threads/day, 2000 char limit
  - Pro tier: Unlimited messages, unlimited threads, 10000 char limit
  - Enterprise tier: Unlimited messages, unlimited threads, 50000 char limit
  - New `/api/v2/messages/limits` endpoint to check remaining limits
  - 429 status code responses with upgrade prompts when limits reached
- **Subscription Audit Logging**: Complete audit trail for subscription lifecycle
  - SUBSCRIPTION_CREATED: New subscription creation tracking
  - SUBSCRIPTION_UPGRADED: Plan upgrade tracking with before/after comparison
  - SUBSCRIPTION_DOWNGRADED: Plan downgrade tracking with scheduling details
  - SUBSCRIPTION_CANCELLED: Cancellation tracking with reason and timing
  - All events include Stripe subscription IDs, timestamps, and user details
- **WebSocket v1 Deprecation Notice**: Added deprecation warnings
  - JSDoc deprecation notice in websocket-server.js
  - Console warning when v1 mode is initialized
  - Migration guide reference to REALTIME_MESSAGING.md
- **Release Tagging Script**: Automated version tagging
  - npm script: `npm run release:tag`
  - Bash script: `scripts/create-release-tag.sh`

### Changed

- **Version Bump**: Updated to v18.0.0 across the project
- **MessagingService**: Enhanced with subscription tier support
  - `sendMessage()` now accepts optional subscriptionTier parameter
  - `createThread()` now accepts optional subscriptionTier parameter
  - New `checkMessageLimit()` method for rate limit validation
  - New `checkThreadLimit()` method for creation limit validation
- **Messaging Routes**: Enhanced with limit enforcement
  - POST `/api/v2/messages/:threadId` enforces message limits
  - POST `/api/v2/messages/threads` enforces thread creation limits
  - Both routes return 429 with upgrade URL when limits reached

### Removed

- **Unused Code Cleanup**: Removed unused variables and functions
  - navbar.js: Removed unused mobile menu functions (toggleMobileMenu, openMobileMenu, closeMobileMenu)
  - reviewService.js: Removed unused `_metadata` parameter
  - websocket-server-v2.js: Removed unused `_data` parameter

### Fixed

- **Linting Warnings**: Resolved unused variable/function warnings
  - Fixed 3 linting warnings related to unused code
  - All code follows ESLint best practices

### Security

- **Audit Trail Enhancements**: Complete subscription lifecycle tracking
  - All subscription changes now logged with full context
  - IP addresses and user agents tracked for security analysis
  - Changes tracked with before/after comparisons
- **Rate Limiting**: Message spam prevention through tier-based limits
  - Prevents abuse of messaging system
  - Encourages subscription upgrades for power users
  - Graceful error handling on limit errors

### Migration Notes

- **WebSocket v1 Users**: Plan migration to WebSocket v2
  - v1 will be removed in a future major version
  - Set `WEBSOCKET_MODE=v2` to use enhanced WebSocket server
  - See REALTIME_MESSAGING.md for migration guide
- **Messaging Service Consumers**: Update method signatures if needed
  - `sendMessage()` and `createThread()` now accept optional subscriptionTier
  - Existing code works without changes (defaults to 'free' tier)
  - Update callers to pass user's actual subscription tier for proper limits

## [v5.2.0] - Previous Version

Earlier changes are documented in individual PR summaries and documentation files.
