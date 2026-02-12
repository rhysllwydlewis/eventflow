# Website Health Audit (EventFlow)

Date: 2026-02-12  
Scope: current `main` application surface (API, frontend, integration tests, lint health)

## Executive summary

The codebase has strong feature breadth, but the current baseline is **not release-ready**. The main blockers are:

1. **Automated quality gate failures** across tests and lint.
2. **Refactor drift** where tests assert outdated route/file implementation details.
3. **Behavior regressions** in critical business flows (subscriptions, lead scoring, reviews).
4. **Tooling/config mismatch** (Jest + jsdom ESM parsing issue).

## What is broken right now

### 1) Test suite is failing heavily

- Latest full Jest run reports:
  - **93 failed tests**
  - **25 failed suites**
  - **1626 passed tests** (large suite still mostly functional)
- Coverage gate fails globally (`70%` threshold vs ~`10%` measured in this run).
- Some suites fail before tests execute due parser/config errors.

### 2) Lint quality gate fails

- ESLint returns non-zero with:
  - **2 errors**
  - **86 warnings**
- The two hard errors are in frontend dashboard/start-wizard scripts and block CI if lint is required.

### 3) Structural + behavior drift after backend refactor

Many integration tests are asserting implementation strings in files (e.g., exact route text in `server.js` or `routes/admin.js`) and now fail after modularization. This indicates:

- Architecture changed, but tests were not updated to new contracts.
- Quality signal is noisy: failures mix true regressions with stale assertions.

### 4) Business logic regressions (high priority)

Observed failing expectations indicate likely real behavior drift in:

- **Lead scoring** (unexpected score outputs and spam/postcode behavior)
- **Subscription flow** (expected subscription IDs/status updates not happening)
- **Review eligibility/creation** (verification and deterministic output differences)
- **Pexels collage fallback** (status mismatch expected 404, now 200)

## What is missing

1. **Stable contract tests over implementation-text tests**
   - A lot of failures are brittle because they inspect source code text instead of API behavior.

2. **Single source of truth for route migration map**
   - Tests and modules disagree on route locations and expected signatures.

3. **Jest ESM compatibility hardening**
   - Several suites fail with `Unexpected token 'export'` from jsdom dependency chain.

4. **Focused smoke checks for critical user journeys**
   - Missing a reliable pre-merge smoke suite for:
     - auth session/me endpoint
     - start-to-subscribe flow
     - messaging & dashboard live updates
     - supplier profile save + venue validation

5. **Frontend code hygiene baseline**
   - Existing lint warnings suggest creeping maintainability issues (curly rules, unused vars, older callback patterns).

## Detailed remediation plan

This plan is designed to produce a reliable, shippable baseline in staged increments, with each stage having explicit entry/exit criteria.

### Phase 0 — Reproduce and triage baseline (Day 0-1)

**Goal:** convert noisy failures into an actionable backlog.

#### Tasks

1. Re-run quality gates and capture artifacts:
   - `npm run lint`
   - `npm test -- --runInBand`
   - `npx jest --runInBand --json --outputFile /tmp/jest-results.json --silent`
2. Categorize failing suites by failure type:
   - infra/config parser errors
   - stale source-text assertions
   - functional regressions
3. Build a triage table (`tests/<suite> -> owner -> category -> severity -> target phase`).
4. Freeze baseline numbers in a tracking issue so improvements are measurable.

#### Exit criteria

- Every failing suite is tagged to one of the three categories above.
- Owners and target PR/phase are assigned for top 20 highest-impact failures.

---

### Phase 1 — Test infrastructure and CI stabilization (Day 1-3)

**Goal:** unblock CI signal quality before touching business logic.

#### Tasks

1. **Fix Jest + ESM parsing**
   - Update Jest transform/config to support ESM dependencies used via `jsdom` chain.
   - Add explicit allowlist for ESM packages in `transformIgnorePatterns` (or equivalent).
2. **Normalize test environment setup**
   - Ensure deterministic env loading in test bootstrap.
   - Remove/guard side-effectful startup paths not required for unit/integration tests.
3. **Implement CI lane split**
   - Lane A: smoke tests + lint (blocking).
   - Lane B: full regression (non-blocking initially, then blocking once stabilized).
4. **Fix lint hard errors**
   - Resolve the 2 error-level ESLint failures first.

#### Exit criteria

- Jest runs without parser crashes in previously blocked suites.
- Lint exits without error-level violations.
- Smoke lane is green and configured as required check.

---

### Phase 2 — Remove brittle tests and restore contract confidence (Day 3-6)

**Goal:** replace low-value source-text tests with behavior-driven assertions.

#### Tasks

1. Identify tests asserting source strings (e.g., route text in files).
2. Replace with API contract checks:
   - status codes
   - response schema
   - auth/role behavior
   - side effects on persisted data
3. Add migration-note mapping for moved routes/modules to avoid repeat regressions.
4. For frontend flows, assert rendered behavior and network contracts rather than implementation text.

#### Exit criteria

- No critical suite fails because of source-file string assertions.
- Converted tests validate externally observable behavior only.

---

### Phase 3 — Repair core business regressions (Day 5-9)

**Goal:** recover correctness of high-value user journeys.

#### Workstream A: Lead scoring

- Reconcile scoring matrix with expected policy for medium-quality and spam leads.
- Add boundary tests for postcode validation, message length tiers, and anti-spam penalties.
- Verify deterministic scoring with fixed fixtures.

#### Workstream B: Subscription flow

- Trace lifecycle transitions (trial -> active -> upgraded -> canceled).
- Fix null/incorrect subscription IDs and ensure user state updates atomically.
- Add regression tests for plan upgrades and entitlement unlocking.

#### Workstream C: Reviews

- Fix booking verification/eligibility checks.
- Make review ID/timestamp generation deterministic in tests.
- Ensure moderation pipeline behavior (auto-approve/flag) matches policy.

#### Exit criteria

- All three workstreams pass dedicated focused test suites.
- End-to-end journey tests for each domain are green.

---

### Phase 4 — Hardening and quality uplift (Day 9-12)

**Goal:** improve long-term maintainability and reduce relapse risk.

#### Tasks

1. Burn down lint warnings in batches (`curly`, unused vars, callback modernizations).
2. Improve coverage for critical modules (auth, subscriptions, reviews, messaging) rather than broad/low-value targets.
3. Add regression test packs for recent refactors (admin routes, `/api/auth/me`, websocket contracts).
4. Add release checklist gate:
   - smoke green
   - no parser errors
   - critical journey suites green
   - no lint errors

#### Exit criteria

- Warning backlog reduced by an agreed threshold (e.g., >50%).
- Critical module coverage increased and tracked.
- Release checklist pass documented.

## Deliverable sequence (PR plan)

### PR 1 — Stabilize test infrastructure and unblock CI

**Scope**

- Jest ESM fix
- test bootstrap cleanup
- smoke/full CI split
- fix lint errors

**Success metrics**

- parser-crash suites reduced to 0
- lint errors reduced to 0
- smoke lane required + passing

### PR 2 — Replace brittle tests with contract tests

**Scope**

- remove source-text assertions
- add API/behavior assertions for admin/auth/websocket affected areas

**Success metrics**

- stale-test failures reduced to 0 in converted suites
- improved stability across refactors

### PR 3 — Repair core business flows

**Scope**

- lead scoring
- subscriptions
- reviews

**Success metrics**

- all critical journey suites green
- no known P0 business regression open

### PR 4 — Hardening pass

**Scope**

- lint warning reduction
- targeted coverage uplift
- regression pack expansion

**Success metrics**

- warning backlog materially reduced
- agreed coverage deltas achieved in critical modules

## Ownership and tracking model

For each issue, track:

- **Owner** (single DRI)
- **Type** (`infra`, `regression`, `techdebt`)
- **Severity** (`P0`, `P1`, `P2`)
- **Target PR** (`PR1..PR4`)
- **Validation command(s)**
- **Definition of done**

Suggested issue labels:

- `infra:test` — Jest ESM parser support
- `infra:ci` — split smoke/full lanes
- `bug:subscriptions` — null subscription ID in flow
- `bug:lead-scoring` — medium/spam scoring drift
- `bug:reviews` — booking verification regression
- `bug:auth` — `/api/auth/me` contract drift
- `techdebt:tests` — remove source-string assertions
- `techdebt:lint` — warnings cleanup campaign

## Risk register and mitigations

1. **Risk:** fixing tests without fixing behavior (false green).  
   **Mitigation:** require behavior-level assertions + data side-effect checks.

2. **Risk:** regressions reintroduced by ongoing refactors.  
   **Mitigation:** contract-test packs for moved modules; CI smoke lane as required gate.

3. **Risk:** quality work stalls due to size of warning backlog.  
   **Mitigation:** batch warnings by rule family; enforce “no new warnings” policy.

4. **Risk:** flaky tests block confidence.  
   **Mitigation:** isolate flaky suites, add deterministic fixtures/mocks, and run retries only as temporary control.

## Release readiness definition

The website is considered ready for release when all are true:

1. `npm run lint` has **0 errors**.
2. No Jest parser/config crashes.
3. Smoke lane passes consistently.
4. Critical journey suites for auth, subscriptions, lead scoring, and reviews pass.
5. No open P0 regressions.
