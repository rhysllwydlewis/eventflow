# Route Migration Compatibility Map

This document maps legacy route areas to their modularized route files and the stable API contracts tests should assert.

## Goals

- Keep tests bound to **HTTP contracts** (status, body, side effects), not source file text.
- Make route moves/refactors low-risk for test stability.

## Mapping

| Domain                 | Legacy Area                                    | Current Module(s)                                                | Stable Contract Targets                                                                                    |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Plans                  | `routes/plans-legacy.js` + monolith references | `routes/plans.js`                                                | `POST /api/me/plans`, `GET /api/me/plans`, `POST /api/plans/guest`, `POST /api/me/plans/claim`             |
| Admin users            | historical `routes/admin.js` user handlers     | `routes/admin-user-management.js`                                | `POST /api/admin/users/bulk-delete`, `bulk-verify`, `bulk-suspend`, response counters + audit side effects |
| Admin batch operations | `routes/admin.js` inline batch handlers        | `routes/admin.js`, `routes/admin-v2.js`                          | batch-size validation (`400`), structured v2 error codes (`BATCH_SIZE_EXCEEDED`, `INVALID_TYPE`)           |
| CSRF                   | mixed checks in route files                    | `middleware/csrf.js` + route usage                               | Double-submit behavior (`cookie == header`) and protected write-route rejection (`403`)                    |
| Reviews                | old `reviews.js` patterns                      | `routes/reviews-v2.js` + `services/reviewService.js`             | eligibility, moderation state transitions, vote/dispute semantics                                          |
| Subscriptions          | old subscription handlers                      | `routes/subscriptions-v2.js` + `services/subscriptionService.js` | lifecycle transitions, feature gating, aggregate stats                                                     |

## Testing guidance

1. Assert endpoint behavior, not route implementation strings.
2. Prefer:
   - status code + response schema assertions,
   - observable persistence side effects,
   - audit/log/event side effects where required.
3. Use deterministic fixtures for IDs/timestamps in service-level integrations.
4. Keep route file location out of assertions so module reshuffles do not break tests.
