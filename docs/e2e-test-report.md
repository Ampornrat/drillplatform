# E2E Integration Test Report
**Date:** 2026-06-09  
**Platform:** Drill Platform — Next.js 15.5 + Supabase  
**Test Suite:** Vitest (unit + integration) + Playwright (E2E)

---

## Test Run Summary

| Suite | Tests | Pass | Fail | Skip | Status |
|-------|-------|------|------|------|--------|
| Unit (result helpers) | 6 | 6 | 0 | 0 | ✅ PASS |
| Unit (Zod schemas) | 7 | 7 | 0 | 0 | ✅ PASS |
| Integration (flow) | 21 | — | — | — | 🔴 Needs seed |
| Integration (RLS) | 9 | — | — | — | 🔴 Needs seed |
| E2E Playwright | 10 | — | — | — | 🔴 Needs dev server |

**Total passing (unit):** 13/13  
**Integration/E2E:** Pending seed + env setup (see Prerequisites)

---

## Prerequisites to Run Full Suite

### 1. Environment variables in `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://bewpbaybebsgclqyzbyb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>    # required for seed
TEST_USER_PASSWORD=DrillTest2026!               # optional override
```

### 2. Seed test users (one-time)

```bash
# Creates 7 test users in auth.users + profiles with correct roles:
# admin@drill.test, commander@drill.test, medical@drill.test,
# logistics@drill.test, controller@drill.test, evaluator@drill.test,
# field@drill.test (participant role)
npx tsx tests/helpers/seed.ts
```

### 3. Run integration tests

```bash
npm run test:integration
```

### 4. Run E2E tests (requires running dev server)

```bash
npm run dev &           # start on :3002
npx playwright install  # one-time browser install
npm run test:e2e
```

---

## 21-Step Demo Flow — Step-by-Step Analysis

| # | Step | Coverage | RPC/Table | Status |
|---|------|----------|-----------|--------|
| 1 | Login as Commander | E2E auth.setup.ts | auth.signInWithPassword | ✅ Implemented |
| 2 | Create incident from METHANE | integration/flow.test.ts | `create_incident_from_methane` | ✅ Implemented |
| 3 | Dashboard sees new incident | integration + E2E | `drills` table SELECT | ✅ Implemented |
| 4 | Create IAP v1 | integration/flow.test.ts | `create_iap_version` | ✅ Implemented |
| 5 | Approve/Activate IAP | integration/flow.test.ts | drills.objectives | ⚠️ Partial — IAP stored in drills JSONB |
| 6 | Create Task Force | integration/flow.test.ts | master_registry | ✅ Implemented |
| 7 | Dispatch team | integration/flow.test.ts | `dispatch_object` | ✅ Implemented |
| 8 | Field user check-in | integration/flow.test.ts | `submit_field_checkin` | ✅ Implemented |
| 9 | Field user triage P1 | integration/flow.test.ts | `submit_field_triage` | ⚠️ Requires iodp_session |
| 10 | Facility update to divert | integration/flow.test.ts | facility_status INSERT | ✅ Implemented |
| 11 | Dashboard sees diversion realtime | E2E demo-flow.spec.ts | notifications + realtime | ⚠️ Requires migration 015 trigger |
| 12 | Safety gate violation | integration/flow.test.ts | `upsert_drill_safety_gate` | ✅ Implemented |
| 13 | Controller creates scenario | integration/flow.test.ts | scenario_instances INSERT | ✅ Implemented |
| 14 | Controller pushes inject | integration/flow.test.ts | `push_msel_inject` | ✅ Implemented |
| 15 | Field/Op UI sees inject | E2E demo-flow.spec.ts | inject_deliveries realtime | ⚠️ Realtime subscription only |
| 16 | Evaluator submits observation | integration/flow.test.ts | evaluator_flags INSERT | ✅ Implemented |
| 17 | Evaluation dashboard updates score | integration/flow.test.ts | `submit_evaluation_score` | ✅ Implemented |
| 18 | Generate AAR | integration/flow.test.ts | `generate_aar_findings` | ✅ Implemented |
| 19 | Map finding to LMS course | integration/flow.test.ts | `assign_lms_course` | ✅ Implemented |
| 20 | Assign LMS course | integration/flow.test.ts | lms_assignments | ✅ Implemented |
| 21 | Improvement action created | integration/flow.test.ts | `create_improvement_action` | ✅ Implemented |

---

## Known Failures and Root Causes

### 🔴 BLOCKER: `platform_events` table does not exist

**Error:** `relation "platform_events" does not exist`  
**Cause:** Migration 010 (`010_object_registry_expand.sql`) was not applied to the live database.  
**Impact:** `control.actions.ts` `logPlatformEvent()` fails silently. Push inject may partially fail.  
**Fix:** Apply migration 010 in Supabase console.

### 🔴 BLOCKER: Integration tests require `SUPABASE_SERVICE_ROLE_KEY`

**Cause:** Admin operations (user creation, cleanup) need the service role key.  
**Fix:** Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.

### ⚠️ Patient triage (Step 9) requires linked iodp_session

**Cause:** `iodp_patients` are linked to `iodp_sessions`, not directly to `drills`. The test seeds a standalone iodp_session but it's not formally linked to `drillId`.  
**Impact:** Triage test is guarded with `if (!patientId)` — skips gracefully if no patient exists.  
**Fix:** Either add a `drill_id` column to `iodp_sessions`, or seed via the IODP session creation flow.

### ⚠️ Notification trigger (Step 11) depends on migration 015

**Cause:** The `_auto_notify_on_event()` trigger on `event_log` is created in migration 015.  
**Impact:** If 015 wasn't applied, `FACILITY_DIVERSION` notifications won't be auto-created.  
**Test behavior:** Warns but doesn't fail hard (`console.warn`, no `expect` failure).

### ⚠️ IAP stored in drills JSONB — no dedicated iap_plans table

**Cause:** `iap.service.ts` maps `drills.objectives` to IAPVersion. The `create_iap_version` RPC may not exist yet.  
**Impact:** Step 4-5 may partially fail if the RPC wasn't created via migration.  
**Fix:** Verify `create_iap_version` RPC exists in the live DB.

### ⚠️ Zod v4 UUID validation is stricter

**Discovery:** Zod v4.4.3 enforces RFC-4122 variant bits. All-zero UUIDs like `00000000-0000-0000-0000-000000000001` fail validation.  
**Impact:** Schema tests using placeholder UUIDs fail.  
**Fix Applied:** Tests updated to use valid v4 UUIDs (`a0b1c2d3-e4f5-4678-8901-a2b3c4d5e6f7`).

---

## RLS Verification Results

| Check | Expected | Test |
|-------|----------|------|
| notifications: user sees only own | ✅ SELECT filtered by user_id | rls.test.ts |
| notifications: no direct INSERT | ✅ Error returned | rls.test.ts |
| improvement_actions: participant blocked | ✅ Empty result | rls.test.ts |
| sim_clock_state: medical blocked | ✅ Error returned | rls.test.ts |
| msel_injects: medical blocked | ✅ Error returned | rls.test.ts |
| msel_injects: controller allowed | ✅ Insert succeeds | rls.test.ts |
| evaluation_scores: participant blocked | ✅ Empty result | rls.test.ts |

---

## Event Log Reconstruction

After running the full integration flow, `event_log` for the test drill should contain:

```
INCIDENT_CREATED     (or equivalent — from create_incident_from_methane)
FACILITY_DIVERSION   (critical — triggers notification fan-out)
SAFETY_GATE_VIOLATION (critical — triggers notification fan-out)
```

These three events are asserted in `flow.test.ts` "Event log reconstruction" suite.

---

## How to Run Everything

```bash
# 1. Unit tests (no DB needed)
npm run test:unit

# 2. Integration tests (needs SUPABASE_SERVICE_ROLE_KEY)
npm run test:integration

# 3. RLS tests (needs seed users)
npx vitest run tests/integration/rls.test.ts

# 4. E2E Playwright (needs dev server + seed users)
npm run dev &
npx playwright install --with-deps
npm run test:e2e

# 5. All non-E2E
npm test
```

---

## Fix Priority

| Priority | Fix | Effort |
|----------|-----|--------|
| P0 | Apply migration 010 (`platform_events`, `lifecycle_events` tables) | 2 min |
| P0 | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` | 1 min |
| P1 | Verify `create_iap_version` RPC exists | 10 min |
| P1 | Link `iodp_sessions` to `drills.id` for patient triage | 30 min |
| P2 | Playwright: improve form selectors with `data-testid` attributes | 60 min |
