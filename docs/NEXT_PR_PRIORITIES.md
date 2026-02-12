# Next PR Priorities (Fix / Improve / Add)

This is a practical, execution-focused backlog to drive upcoming PRs.

## 1) Fix next (stability & risk)

### P0 — Reduce lint debt to zero warnings in touched areas ✅

- **Status:** Done in this PR batch.
- **Outcome:** Repository lint warnings reduced from 70 to 0.
- **Validation:** `npm run lint`

### P0 — Close optional-service production gaps ✅

- **Status:** Done in this PR batch.
- **Outcome:**
  - Added startup integration summary to make optional vs required services explicit.
  - Added production guardrails for missing critical configuration (`MONGODB_URI`, `JWT_SECRET`, `BASE_URL`) with controlled bypass via `ALLOW_DEGRADED_STARTUP=true`.
  - Extended `/api/health` to expose integration and guardrail status.
  - Reduced Redis adapter startup noise when Redis clustering is not configured.
- **Validation:** `npm run test:smoke`

### P1 — Address known `xlsx` security debt with migration plan

- **Why now:** package metadata records known high-severity advisories for `xlsx` with no upstream fix.
- **Suggested PR scope:**
  - Evaluate alternatives (e.g., CSV-only export by default, or safer xlsx writer).
  - Add feature flag to disable XLSX export in hardened environments.
  - Add migration note and deprecation timeline.
- **Acceptance criteria:**
  - Documented replacement path + rollout switch.
  - Export tests updated for chosen path.

## 2) Improve next (quality & maintainability)

### P1 — Complete API versioning follow-through

- **Why now:** roadmap marks API versioning complete, but still lists open tasks for docs and versioning tests.
- **Suggested PR scope:**
  - Add explicit API versioning tests and update API docs to show v1/v2 routing guarantees.
- **Acceptance criteria:**
  - Versioning contract tests in CI.
  - Docs include migration examples and deprecation behavior.

### P1 — Finish Sentry integration end-to-end

- **Why now:** Sentry utility exists, but roadmap tracks incomplete server integration and frontend/source-map configuration.
- **Suggested PR scope:**
  - Ensure backend init path is consistent across environments.
  - Add frontend init with release/version tagging.
  - Publish source maps in CI release flow.
- **Acceptance criteria:**
  - Test error includes release + environment tags.
  - Alerting runbook documented.

### P2 — Strengthen smoke/full regression governance

- **Why now:** remediation backlog indicates sustainment mode is active; this is the right time to harden guardrails.
- **Suggested PR scope:**
  - Keep smoke lane required and add a trend report for flaky/failing full-suite tests.
  - Add PR template checkbox for smoke command evidence.
- **Acceptance criteria:**
  - CI publishes smoke/full result summaries per PR.
  - Flake triage list auto-updated weekly.

## 3) Add next (product capability)

### P2 — Dashboard analytics widgets (already partially prepared)

- **Why now:** roadmap shows export utilities complete and Chart.js installed; widgets/date filtering remain open.
- **Suggested PR scope:**
  - Add 2 high-value widgets first: conversion funnel + supplier response time.
  - Include date-range filtering and empty/loading/error states.
- **Acceptance criteria:**
  - Widget data contracts tested.
  - Lighthouse/UX remains stable on dashboard pages.

### P2 — PWA install prompt completion

- **Why now:** service worker work is done, but install prompt integration is still unchecked.
- **Suggested PR scope:**
  - Add install banner with dismissal persistence and eligibility checks.
- **Acceptance criteria:**
  - Install prompt appears only when installable and not previously dismissed.

### P3 — Media UX upgrades (lightbox/zoom/carousel)

- **Why now:** explicitly listed as medium-priority future work; useful for conversion once core reliability items above are done.
- **Suggested PR scope:**
  - Ship one component at a time (lightbox first), with keyboard/touch support and perf budgets.
- **Acceptance criteria:**
  - Accessibility checks pass.
  - No measurable regression on mobile page performance.

## Recommended PR sequence (next 6 PRs)

1. **PR-A:** Lint warning reduction batch #1 + no-new-warnings policy for changed files.
2. **PR-B:** Integration health visibility + production env guardrails.
3. **PR-C:** API versioning contract tests + docs update.
4. **PR-D:** Sentry full integration + source maps.
5. **PR-E:** Dashboard widget slice 1 (conversion + response-time cards).
6. **PR-F:** PWA install prompt.

## Definition of readiness for each PR

- Problem statement tied to one backlog item.
- Before/after command evidence.
- Risk and rollback note.
- Tests attached to changed contract area.
