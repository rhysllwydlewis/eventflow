# Website Remediation Backlog (Execution Tracker)

This file turns the audit plan into a working backlog the team can execute immediately.

## How to use this file

- Move each item through: `todo -> in_progress -> blocked -> done`.
- Keep one owner (DRI) per item.
- Include verification command/output before marking done.
- Link each item to a PR and issue.

## Progress snapshot (current)

- **Overall remediation progress:** **55%** (5/10 backlog workstreams marked done, 1/10 in progress).
- **Core regression repair progress (PR3):** **100%** (lead scoring, subscriptions, and reviews suites all passing assertions).
- **Current focus:** PR4 hardening (coverage uplift and warning reduction) plus CI lane split.

## Status legend

- `todo`
- `in_progress`
- `blocked`
- `done`

---

## PR1 — Stabilize test infrastructure and CI

### 1.1 Jest ESM/parser failures

- **Status:** done
- **Owner:** _unassigned_
- **Issue label:** `infra:test`
- **Definition of done:** suites that currently crash with `Unexpected token 'export'` run to completion.
- **Checklist**
  - [ ] Identify exact package(s) causing ESM parse failures via focused suite run.
  - [ ] Update Jest config (`transformIgnorePatterns` / transform pipeline) for failing dependency chain.
  - [ ] Re-run previously crashing suites.
  - [ ] Document final config rationale in repo docs.
- **Validation commands**
  - `npx jest tests/integration/venue-proximity.test.js --runInBand`
  - `npx jest tests/integration/plan-api.test.js --runInBand`
  - `npx jest tests/integration/ai-plan-route.test.js --runInBand`

### 1.2 Lint error-level fixes

- **Status:** done
- **Owner:** _unassigned_
- **Issue label:** `techdebt:lint`
- **Definition of done:** `npm run lint` has 0 errors.
- **Checklist**
  - [ ] Fix `no-inner-declarations` error in dashboard supplier export script.
  - [ ] Fix `no-case-declarations` error in start-wizard validation script.
  - [ ] Run full lint and capture before/after counts.
- **Validation command**
  - `npm run lint`

### 1.3 CI lane split (smoke vs full)

- **Status:** todo
- **Owner:** _unassigned_
- **Issue label:** `infra:ci`
- **Definition of done:** smoke lane is required + green; full lane runs on push/PR.
- **Checklist**
  - [ ] Define smoke test list (critical user paths only).
  - [ ] Add CI job for smoke + lint.
  - [ ] Keep full regression as separate lane while stabilization is in progress.
  - [ ] Add branch protection requirement for smoke lane.

---

## PR2 — Replace brittle tests with contract tests

### 2.1 Remove source-text assertions

- **Status:** todo
- **Owner:** _unassigned_
- **Issue label:** `techdebt:tests`
- **Definition of done:** affected suites assert behavior/contracts, not source code strings.
- **Checklist**
  - [ ] Inventory tests using `.toContain()` against route file contents.
  - [ ] Replace with endpoint response assertions (status/body/schema/side effects).
  - [ ] Ensure auth and RBAC behavior is covered explicitly.

### 2.2 Route migration compatibility map

- **Status:** todo
- **Owner:** _unassigned_
- **Issue label:** `techdebt:tests`
- **Definition of done:** documented mapping from legacy route locations to modular routes.
- **Checklist**
  - [ ] Add route map doc.
  - [ ] Update tests to reference route contracts, not file location.

---

## PR3 — Repair core business regressions

### 3.1 Lead scoring

- **Status:** done
- **Owner:** _unassigned_
- **Issue label:** `bug:lead-scoring`
- **Definition of done:** medium/spam/postcode-related expectations pass consistently.
- **Checklist**
  - [ ] Reconcile scoring rules with expected thresholds.
  - [ ] Add/adjust boundary tests for spam and postcode cases.
  - [ ] Verify deterministic outcomes with fixed fixtures.
- **Validation command**
  - `npx jest tests/integration/lead-scoring.test.js --runInBand`

### 3.2 Subscription lifecycle

- **Status:** done
- **Owner:** _unassigned_
- **Issue label:** `bug:subscriptions`
- **Definition of done:** lifecycle state transitions and subscription IDs are correct.
- **Checklist**
  - [ ] Fix null subscription ID path.
  - [ ] Verify upgrade/cancel state transitions.
  - [ ] Verify feature gating updates with plan changes.
- **Validation commands**
  - `npx jest tests/integration/subscription-flow.test.js --runInBand`
  - `npx jest tests/integration/subscriptions-v2.test.js --runInBand`

### 3.3 Reviews flow

- **Status:** done
- **Owner:** _unassigned_
- **Issue label:** `bug:reviews`
- **Definition of done:** eligibility/verification + review creation behave as expected.
- **Checklist**
  - [ ] Fix booking verification logic mismatch.
  - [ ] Make generated IDs deterministic in tests when needed.
  - [ ] Re-check moderation outcomes.
- **Validation command**
  - `npx jest tests/integration/reviews-v2.test.js --runInBand`

---

## PR4 — Hardening and maintainability

### 4.1 Lint warning reduction campaign

- **Status:** todo
- **Owner:** _unassigned_
- **Issue label:** `techdebt:lint`
- **Definition of done:** warning count reduced by agreed target; no new warnings policy in place.
- **Checklist**
  - [ ] Batch-fix `curly` warnings.
  - [ ] Remove obvious unused vars.
  - [ ] Modernize callback patterns where low risk.

### 4.2 Coverage uplift in critical modules

- **Status:** in_progress
- **Owner:** _unassigned_
- **Issue label:** `techdebt:tests`
- **Definition of done:** coverage improved for auth/subscriptions/reviews/messaging modules.
- **Checklist**
  - [ ] Add focused tests in critical modules.
  - [ ] Track deltas against baseline.

---

## Weekly reporting template

- **Week of:**
- **PR in focus:**
- **Open P0 count:**
- **Parser-crash suites remaining:**
- **Failed tests / failed suites (latest run):**
- **Lint errors / warnings:**
- **Top blockers:**
- **Next 3 actions:**
