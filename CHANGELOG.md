# Changelog

All notable changes to EventFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
