# Integration Map — Drill Platform

> Updated: 2026-06-09 (Prompt 19 — mock data cleared, DEMO_DATA fallbacks removed)  
> Status key: **connected** = real Supabase, reads + writes work | **partial** = reads real, writes missing or some mock | **empty-state** = no mock fallback, shows empty state when DB has no data | **missing** = Next.js page does not exist yet

---

## 1. Current Dashboard Routes

| UI Route | Main Component | Data Source | Tables / Views / RPCs Used | Missing / Gap | Required Mutations | Events to Log | Realtime Channel | Status |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` (Server) | Supabase server | `drills`, `event_log`, `standards_registry`, `profiles` | No active-drill COP shortcut link | — | — | — | **connected** |
| `/planner/drills` | `planner/drills/page.tsx` (Server) | Supabase server | `drills` | No pagination; no filter by mode/status | — | — | — | **connected** |
| `/planner/drills/new` | `planner/drills/new/page.tsx` (Client) | Server Action | `drills`, `event_log` (via `logPlatformEvent`) | — | `createDrillAction` ✓ | `drill_created` ✓ | — | **connected** |
| `/planner/drills/[id]` | `planner/drills/[id]/page.tsx` (Server) + `DrillStatusActions` (Client) | Supabase server + Server Action | `drills`, `profiles`, `event_log`, `drill_participants` | Safety gate checklist UI missing; participant list missing | `updateDrillStatusAction` ✓ | `drill_status_changed` ✓ | — | **partial** |
| `/operation/[id]/cop` | `operation/[id]/cop/page.tsx` (Server) | `getDrillCOPData()` | `drills`, `organizations`, `event_log`, `drill_participants`, `safety_gate_rules`, `drill_safety_gates` | Safety gate update UI (COP only reads); no inject panel; no live event feed on COP | `upsert_drill_safety_gate` (RPC exists, no UI) | — | Recommended: `event_log:drill_id=eq.{id}` | **partial** |
| `/observer` | `observer/page.tsx` (Server) + `RealtimeEvents` (Client) + `LogEventForm` (Client) | Supabase server + Realtime | `event_log`, `drills`, `profiles` | Realtime subscription is global (not scoped to drill) | `logEventAction` ✓ | `event_logged` ✓ | `observer:event_log` (INSERT) ✓ | **connected** |
| `/participant` | `participant/page.tsx` (Server) | Supabase server | `drill_participants`, `drills` | No join/leave action; no check-in flow; no inject receipt | `joinDrill`, `checkIn` (missing) | `participant_joined`, `participant_checked_in` | `drill_participants:user_id=eq.{uid}` | **partial** |
| `/core/event-log` | `core/event-log/page.tsx` (Server) + `LogEventForm` (Client) | Supabase server + Server Action | `event_log`, `drills` | No filter by drill/severity; no pagination | `logEventAction` ✓ | `event_logged` ✓ | — | **connected** |
| `/core/aar` | `core/aar/page.tsx` (Server) + `CreateAARDialog` (Client) | Supabase server + Server Action | `aar_reports`, `drills` | No findings editor; findings stored as empty `[]` | `createAARReportAction` ✓ | `aar_created` ✓ | — | **partial** |
| `/core/safety-gates` | `core/safety-gates/page.tsx` (Server) | Supabase server | `safety_gate_rules` | No create/edit/delete form; no per-drill override view | `createSafetyGateRule` (missing) | `safety_gate_updated` | — | **partial** |
| `/core/authority-matrix` | `core/authority-matrix/page.tsx` (Server) | Supabase server | `authority_matrix` | Read-only; no mutation UI | — | — | — | **partial** |
| `/core/standards` | `core/standards/page.tsx` (Server) + `AddStandardDialog` (Client) | Supabase server + direct client insert | `standards_registry` | Uses direct `createClient()` browser insert (no Server Action, no event log) | Move to Server Action; add `logPlatformEvent` | `standard_added` (missing) | — | **partial** |
| `/core/master-registry` | `core/master-registry/page.tsx` (Server) + `AddItemDialog` (Client) | Supabase server + direct client insert | `master_registry`, `organizations` | Uses direct `createClient()` browser insert (no Server Action, no event log) | Move to Server Action; add `logPlatformEvent` | `registry_item_added` (missing) | — | **partial** |
| `/admin/users` | `admin/users/page.tsx` (Server) | Supabase server | `profiles`, `organizations` | No role-change form; no deactivate action | `updateUserRole` (missing) | `user_role_changed` | — | **partial** |
| `/admin/organizations` | `admin/organizations/page.tsx` (Server) | Supabase server | `organizations` | No create/edit form | `createOrganization` (missing) | `org_created` | — | **partial** |

---

## 2. IODP Module Routes

> All target routes below are **views inside `IodpApp`** (`/iodp`), NOT separate Next.js pages.  
> The IODP app at `/iodp/page.tsx` renders `<IodpApp />` which switches views based on role + selected tab.  
> Primary data = `DEMO_DATA` (`src/lib/iodp/demo-data.ts`). Real Supabase layer = `useIodpData()` hook (optional overlay).

| Target Route (view name) | Rendered By | Data Source | Tables Used | Mock Data Points | Required Mutations | Events to Log | Realtime Channel | Status |
|---|---|---|---|---|---|---|---|---|
| `/op/dashboard` (OPDashboard view) | `op-views.tsx → OPDashboard` | `DEMO_DATA` + `useIodpData()` | `iodp_sessions`, `iodp_events`, `iodp_sites`, `iodp_teams` | `data.metrics_op`, `data.safety_gates`, `data.events`, `data.sites` — all DEMO_DATA shapes | `updateSessionStatus` ✓ (RPC exists) | `session_status_changed` | `iodp:session:{id}` ✓ (subscribeToSession) | **mock** |
| `/op/incidents/new` (session create) | `IodpApp` → `createSession` call | Server Action missing — uses `createSession()` client fn | `iodp_sessions` | No form UI — session select in sidebar uses fetched data but create is not wired to a form | `createSession` client fn ✓, needs form UI | `session_created` | — | **mock** |
| `/op/iap/[incidentId]` (IAP view) | Not implemented | — | — | **No view exists** | — | — | — | **missing** |
| `/op/cop/[incidentId]` (CopDispatch view) | `op-views.tsx → CopDispatch` | `DEMO_DATA` | `iodp_events`, `iodp_teams`, `iodp_sites` | `data.sites`, `data.teams`, `data.events` — DEMO_DATA | `pushInject` ✓, `acknowledgeInject` ✓ | `inject_pushed`, `inject_acknowledged` | `iodp:session:{id}` ✓ | **mock** |
| `/op/facility/[incidentId]` (FacilityCoord view) | `op-views.tsx → FacilityCoord` | `DEMO_DATA` | `iodp_teams`, `iodp_sites` | `data.sites`, `data.teams` — DEMO_DATA | `updateTeamStatus` ✓, `addSite` ✓ | `team_status_changed`, `site_added` | `iodp:session:{id}` ✓ | **mock** |
| `/admin/registry` (Registry view) | `drill-views.tsx → Registry` | `DEMO_DATA` | `iodp_sessions`, `iodp_sites` | `data.sites` — DEMO_DATA | `addSite` ✓, `addTeam` ✓ | `registry_updated` | — | **mock** |
| `/admin/registry/[objectId]` (Registry detail) | Not implemented | — | — | **No detail view exists** | — | — | — | **missing** |
| `/drill/dashboard` (ControlRoom view) | `drill-views.tsx → ControlRoom` | `DEMO_DATA` + `useIodpData()` | `iodp_sessions`, `iodp_injects`, `iodp_events` | `data.drill_injects`, sim clock (hardcoded `00:47:23`), inject queue — DEMO_DATA | `pushInject` ✓, `updateSessionStatus` ✓ | `inject_pushed`, `session_status_changed` | `iodp:session:{id}` ✓ | **mock** |
| `/drill/scenario-builder` | Not implemented | — | — | **No view exists** | — | — | — | **missing** |
| `/drill/control/[scenarioId]` (ControlRoom view same as `/drill/dashboard`) | `drill-views.tsx → ControlRoom` | Same as above | Same as above | Same as above | Same as above | Same as above | Same as above | **mock** |
| `/drill/evaluation/[scenarioId]` (EvaluationDashboard view) | `drill-views.tsx → EvaluationDashboard` | `DEMO_DATA` | `iodp_events`, `iodp_teams` | All scoring data DEMO_DATA (`data.evaluation_scores`) | — (read-only) | — | — | **mock** |
| `/field` (FieldMobile view) | `field-view.tsx → FieldMobile` | Hardcoded demo content | `iodp_patients`, `iodp_teams` | Triage list, check-in roster, supply list — all hardcoded strings | `updatePatientStatus` ✓, `acknowledgeInject` ✓ | `patient_updated`, `checkin_submitted` | `iodp:session:{id}` ✓ | **mock** |
| `/field/check-in` (FieldMobile check-in tab) | `field-view.tsx` tab | Hardcoded | Same as above | Hardcoded team roster | `acknowledgeInject` ✓ | `participant_checked_in` | Same as above | **mock** |
| `/field/triage` (FieldMobile triage tab) | `field-view.tsx` tab | Hardcoded | Same as above | Hardcoded patient list | `updatePatientStatus` ✓ | `triage_updated` | Same as above | **mock** |
| `/field/supply-request` (FieldMobile supply tab) | `field-view.tsx` tab | Hardcoded | Same as above | Hardcoded supply items | — (no submit action wired) | `supply_requested` | Same as above | **mock** |
| `/drill/aar/[scenarioId]` (AARLoop view) | `drill-views.tsx → AARLoop` | `DEMO_DATA` | `aar_reports`, `iodp_events` | AAR findings list, scores — DEMO_DATA | `createAARReportAction` (platform) or new iodp-specific action | `aar_created` | — | **mock** |
| `/op/aar/[incidentId]` (same AARLoop view) | `drill-views.tsx → AARLoop` | `DEMO_DATA` | Same as above | Same as above | Same as above | Same as above | — | **mock** |

---

## 3. Auth Routes

| UI Route | Main Component | Data Source | Status |
|---|---|---|---|
| `/login` | `(auth)/login/page.tsx` | `supabase.auth.signInWithPassword` | **connected** |
| `/register` | `(auth)/register/page.tsx` | `supabase.auth.signUp` | **connected** |

---

## 4. Public Routes

| UI Route | Main Component | Data Source | Status |
|---|---|---|---|
| `/` | `(public)/page.tsx` | Static / `organizations` count | **connected** |
| `/news` | `(public)/news/page.tsx` | `announcements` table | **connected** |
| `/documents` | `(public)/documents/page.tsx` | `documents` table (or static) | needs verification |

---

## 5. Database Objects Inventory

### Tables (from migrations 001–007)

| Table | Purpose | RLS | Realtime |
|---|---|---|---|
| `profiles` | User profile + role + org FK | ✓ | — |
| `organizations` | Org list | ✓ | — |
| `drills` | Core drill/operation records | ✓ | ✓ (007) |
| `drill_participants` | Participants per drill | ✓ | — |
| `event_log` | Central audit/event trail | ✓ | ✓ (007) |
| `standards_registry` | Drill standards catalogue | ✓ | — |
| `master_registry` | People/equipment/resource registry | ✓ | — |
| `safety_gate_rules` | Platform-level gate rules | ✓ | — |
| `drill_safety_gates` | Per-drill gate status overrides | ✓ | ✓ (007) |
| `authority_matrix` | Role → action permission matrix | ✓ | — |
| `announcements` | Public news/announcements | ✓ | — |
| `aar_reports` | After-Action Reports | ✓ | — |
| `iodp_sessions` | IODP scenario sessions | ✓ | — |
| `iodp_sites` | Sites per session | ✓ | — |
| `iodp_teams` | Teams per session | ✓ | — |
| `iodp_patients` | Patients per session | ✓ | — |
| `iodp_events` | Events per IODP session | ✓ | — |
| `iodp_injects` | Scenario injects | ✓ | — |
| `iodp_aar_findings` | IODP AAR findings | ✓ | — |
| `thai_postal_codes` | Postal code lookup (migration 006) | — | — |

### RPCs / Functions

| Function | Purpose | Used By |
|---|---|---|
| `get_user_role()` | Returns current user's role | RLS policies |
| `is_admin()` | Role check helper | RLS |
| `is_commander_or_above()` | Role check helper | RLS |
| `upsert_drill_safety_gate(p_drill_id, p_rule_id, p_status, p_notes)` | Idempotent gate status update | `updateDrillStatusAction` (check only), UI needed |
| `lookupPostalCode(code)` | Thai postal code lookup | IODP field view |

### Server Actions (`src/lib/supabase/actions.ts`)

| Action | Validates | Logs | Redirects |
|---|---|---|---|
| `createDrillAction(fd)` | title required, auth check | `drill_created` | `/planner/drills` on success |
| `logEventAction(fd)` | title required, auth check | self (inserts to `event_log`) | — |
| `createAARReportAction(fd)` | title + drill_id required, auth check | `aar_created` | — |
| `updateDrillStatusAction(id, status)` | role check (admin/commander), safety gate block for `active` | `drill_status_changed` | — |

### Realtime Channels

| Channel | Table | Filter | Used By |
|---|---|---|---|
| `observer:event_log` | `event_log` | none (global) | `RealtimeEvents` in `/observer` |
| `iodp:session:{id}` | `iodp_events`, `iodp_injects`, `iodp_teams`, `iodp_patients` | session_id | `subscribeToSession()` in IODP |

---

## 6. Mock / Demo Data Points (to replace)

| File | Used By | Shape | Priority |
|---|---|---|---|
| `src/lib/iodp/demo-data.ts` | `iodp-app.tsx` → all IODP views | `metrics_op`, `safety_gates`, `events`, `sites`, `teams`, `drill_injects`, `evaluation_scores`, `aar_findings` | Medium — IODP is its own module |
| Hardcoded strings in `field-view.tsx` | FieldMobile triage/checkin/supply tabs | Patient names, team roster, supply items | Low — demo content |
| Hardcoded sim clock `00:47:23` in `drill-views.tsx` | ControlRoom | — | Low |
| `src/lib/mock/cop-data.ts` | Was `/operation/[id]/cop` — **no longer imported** | `mockIncident`, `mockStats`, `mockSafetyGates` | Can delete |

---

## 7. Backend Gaps Summary

| Gap | Affected Routes | Type | Effort |
|---|---|---|---|
| Migration 007 not applied in Supabase | `/operation/[id]/cop`, `/planner/drills/[id]` | DB — run SQL | 5 min |
| `drill_safety_gates` upsert UI | `/operation/[id]/cop`, `/planner/drills/[id]` | UI + existing RPC | Small |
| Participant join/check-in actions | `/participant` | Server Action + DB | Medium |
| Admin CRUD forms (users, orgs) | `/admin/users`, `/admin/organizations` | UI + Server Action | Medium |
| Standards/master-registry move to Server Action | `/core/standards`, `/core/master-registry` | Refactor | Small |
| AAR findings editor | `/core/aar` | UI | Medium |
| COP realtime event feed | `/operation/[id]/cop` | Realtime channel | Small |
| IODP replace DEMO_DATA with real queries | all `/iodp` views | Data layer | Large |
| IAP view (`/op/iap/[incidentId]`) | IODP | New view component | Large |
| Scenario builder (`/drill/scenario-builder`) | IODP | New view component | Large |
| Registry detail (`/admin/registry/[objectId]`) | IODP | New view component | Medium |
| Supply request submit action | IODP field view | Server Action | Small |
| IODP realtime (iodp tables) missing from publication | all `/iodp` realtime | DB — ALTER PUBLICATION | 5 min |
