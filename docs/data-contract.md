# Data Contract Reference

> Updated: 2026-06-09 (Prompt 19)  
> Principle: UI components never read raw database columns directly.  
> All data flows through a contract type. All mutations are validated by a Zod schema before reaching the database.  
> **Mock data removed**: production components no longer fall back to `DEMO_DATA`. Empty state is shown when the DB has no data.

## Pagination Contract (event_log)

```typescript
interface EventPage {
  items: EventLogItem[]
  nextCursor: string | null  // ISO timestamp — pass as `before` for next page
  total: number
}
```

Usage:
```typescript
const first = await getEvents({ drillId, limit: 50 })
const next  = await getEvents({ drillId, limit: 50, before: first.data.nextCursor })
```

---

## Contract Files

| File | Module | Purpose |
|---|---|---|
| `src/contracts/common.contract.ts` | Shared | Base enums, `ApiResult<T>`, `Notification`, `RealtimePayload<T>`, `EventLogItem` |
| `src/contracts/op.contract.ts` | Operation | Dashboard metrics, `IncidentSummary`, IAP, COP markers, Dispatch, Facility |
| `src/contracts/drill.contract.ts` | Drill/Planner | Drill list/detail, `ScenarioSummary`, `MSELInject`, `SimClockState` |
| `src/contracts/registry.contract.ts` | Registry | `ObjectPassport`, `StandardEntry`, `SafetyGateRule`, `AuthorityMatrixRow`, user/org list items |
| `src/contracts/field.contract.ts` | Field/Mobile | `CheckInEntry`, `PatientSummary`, `SupplyRequest`, `FieldInboxMessage` |
| `src/contracts/evaluation.contract.ts` | Observer/Eval | `ObserverNote`, `EvaluationMetric`, `ScoreEntry`, `EvaluationResult` |
| `src/contracts/aar.contract.ts` | AAR | `AARFindingItem`, `AARReportView`, `AARSummary` |
| `src/contracts/schemas.ts` | All | Zod form schemas + inferred input types |

Raw DB row types remain in `src/types/index.ts` and `src/lib/iodp/types.ts`.  
Contracts are **view models** — they combine DB rows into what a screen actually renders.

---

## Page → Contract Map

### Dashboard (`/dashboard`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `OpDashboardMetrics` | `totalDrills`, `activeDrills`, `activeStandards` | `drills`, `standards_registry` |
| `EventLogItem[]` | `recentEvents` (title, severity, timestamp) | `event_log` ORDER BY timestamp DESC LIMIT 5 |

---

### Drills list (`/planner/drills`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `DrillListItem[]` | title, mode, status, location, start_date | `drills` |

---

### Drill detail (`/planner/drills/[id]`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `DrillDetail` | All `DrillListItem` fields + description, objectives, recentEvents, safetyGates, canManage | `drills`, `profiles`, `event_log`, `drill_participants`, `safety_gate_rules`, `drill_safety_gates` |

---

### COP (`/operation/[id]/cop`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `IncidentSummary` (via `getDrillCOPData`) | title, mode, status, location, org, dates | `drills JOIN organizations` |
| `EventLogItem[]` | recent events (realtime) | `event_log WHERE drill_id = ?` |
| `SafetyGateView[]` | gate name, status (Pass/Fail/Waive UI) | `safety_gate_rules LEFT JOIN drill_safety_gates` |
| Stats object | participant counts, event counts, gate counts | aggregated in `getDrillCOPData()` |

---

### Observer (`/observer`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `EventLogItem[]` | live event feed (realtime INSERT) | `event_log` |
| `DrillListItem[]` | drill selector in `LogEventForm` | `drills WHERE status IN (planned, active, paused)` |

---

### Participant (`/participant`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `CheckInEntry[]` | drill list with check-in status | `drill_participants JOIN drills` |

---

### Event Log (`/core/event-log`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `EventLogItem[]` | full event table | `event_log` ORDER BY timestamp DESC |
| `DrillListItem[]` | drill filter dropdown | `drills` |

---

### AAR (`/core/aar`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `AARSummary[]` | report list (title, status, rating, drill) | `aar_reports JOIN drills` |
| `DrillListItem[]` | drill selector in create dialog | `drills` |

---

### Safety Gates (`/core/safety-gates`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `SafetyGateRule[]` | platform gate rules list | `safety_gate_rules` |

---

### Authority Matrix (`/core/authority-matrix`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `AuthorityMatrixRow[]` | permission table | `authority_matrix` |

---

### Standards (`/core/standards`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `StandardEntry[]` | standards list | `standards_registry` |

---

### Master Registry (`/core/master-registry`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `ObjectPassport[]` | registry items by type | `master_registry LEFT JOIN organizations` |

---

### Admin — Users (`/admin/users`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `UserListItem[]` | user table with role, org | `profiles LEFT JOIN organizations` |

---

### Admin — Organizations (`/admin/organizations`)

| Contract type | Fields shown | DB source |
|---|---|---|
| `OrganizationListItem[]` | org list with member count | `organizations LEFT JOIN profiles COUNT` |

---

### IODP (`/iodp` — all views inside `IodpApp`)

| View | Contract type | DB source | Fallback |
|---|---|---|---|
| OPDashboard | `OpDashboardMetrics`, `SafetyGateView[]`, `EventLogItem[]` | `iodp_sessions`, `iodp_events`, `iodp_sites` | `DEMO_DATA` |
| CopDispatch | `COPMarker[]`, `DispatchAssignment[]`, `MSELInject[]` | `iodp_sites`, `iodp_teams`, `iodp_events` | `DEMO_DATA` |
| FacilityCoord | `FacilityLoad[]`, `COPMarker[]` | `iodp_sites`, `iodp_teams` | `DEMO_DATA` |
| ControlRoom | `SimClockState`, `MSELInject[]` | `iodp_sessions`, `iodp_injects` | `DEMO_DATA` |
| EvaluationDashboard | `EvaluationResult`, `ScoreEntry[]` | `iodp_events`, `iodp_teams` | `DEMO_DATA` |
| FieldMobile — triage | `PatientSummary[]` | `iodp_patients` | hardcoded |
| FieldMobile — check-in | `CheckInEntry[]` | `drill_participants` | hardcoded |
| FieldMobile — supply | `SupplyRequest[]` | (future table) | hardcoded |
| FieldMobile — inbox | `FieldInboxMessage[]` | `iodp_injects WHERE target_team = ?` | hardcoded |
| AARLoop | `AARReportView`, `AARFindingItem[]` | `aar_reports`, `iodp_aar_findings` | `DEMO_DATA` |

---

## Mutation → Schema → Event Log

| Action | Zod Schema | Server Action | event_type logged |
|---|---|---|---|
| Create drill | `createDrillSchema` | `createDrillAction` | `drill_created` |
| Update drill status | `updateDrillStatusSchema` | `updateDrillStatusAction` | `drill_status_changed` |
| Log manual event | `logEventSchema` | `logEventAction` | (self — IS the event) |
| Create AAR report | `generateAarSchema` | `createAARReportAction` | `aar_created` |
| Upsert safety gate | `upsertGateSchema` | `upsertDrillSafetyGateAction` | `safety_gate_updated` |
| Add standard | `addStandardSchema` | `addStandardAction` | `standard_added` |
| Add registry item | `addRegistryItemSchema` | `addRegistryItemAction` | `registry_item_added` |
| Create METHANE incident | `createIncidentFromMethaneSchema` | (pending) | `incident_created` |
| Update IAP | `updateIapSchema` | (pending) | `iap_updated` |
| Dispatch object | `dispatchObjectSchema` | (pending) | `resource_dispatched` |
| Update facility status | `updateFacilityStatusSchema` | (pending) | `facility_status_changed` |
| Submit triage | `submitFieldTriageSchema` | (pending) | `triage_submitted` |
| Push inject | `pushInjectSchema` | (pending, wraps `pushInject()`) | `inject_pushed` |
| Submit evaluation score | `submitEvaluationScoreSchema` | (pending) | `evaluation_score_submitted` |
| Assign LMS course | `assignLmsCourseSchema` | (pending) | `lms_course_assigned` |
| Supply request | `supplyRequestSchema` | (pending) | `supply_requested` |

All server actions call `logPlatformEvent()` after a successful DB write.  
`logPlatformEvent()` inserts to `event_log` with `user_id`, `drill_id`, `event_type`, `severity`, `mode`.

---

## Realtime Channels & Payload Shapes

### `observer:event_log` (global)
- Table: `event_log`
- Event: `INSERT`
- Filter: none
- Payload type: `RealtimePayload<EventLogItem>`
- Consumer: `RealtimeEvents` in `/observer`

### `cop:event_log:{drillId}` (per drill)
- Table: `event_log`
- Event: `INSERT`
- Filter: `drill_id=eq.{drillId}`
- Payload type: `RealtimePayload<EventLogItem>`
- Consumer: `RealtimeCOPEvents` in `/operation/[id]/cop`

### `iodp:session:{sessionId}`
- Tables: `iodp_events`, `iodp_injects`, `iodp_teams`, `iodp_patients`
- Event: `INSERT` | `UPDATE`
- Filter: `session_id=eq.{sessionId}`
- Payload type: `RealtimePayload<IodpEvent | IodpInject | IodpTeam | IodpPatient>`
- Consumer: `subscribeToSession()` in `src/lib/iodp/supabase.ts`

### `drill_safety_gates` (future — for live gate status on COP)
- Table: `drill_safety_gates`
- Event: `INSERT` | `UPDATE`
- Filter: `drill_id=eq.{drillId}`
- Payload type: `RealtimePayload<DrillGateRecord>`
- Consumer: `CopSafetyGates` (currently uses optimistic local state — no subscription yet)

---

## Field Origin Reference

| Contract field | DB table.column | Notes |
|---|---|---|
| `IncidentSummary.organizationName` | `organizations.name` | JOIN from `drills.organization_id` |
| `DrillDetail.canManage` | `profiles.role` | Computed: `role IN (admin, commander)` |
| `DrillDetail.participantCount` | `COUNT(drill_participants)` | Aggregated server-side |
| `SafetyGateView.status` | `drill_safety_gates.status` | Defaults to `'pending'` if no row |
| `AARSummary.findingCount` | `LENGTH(aar_reports.findings)` | JSON array length |
| `OpDashboardMetrics.activeDrills` | `COUNT(drills WHERE status='active')` | Server-side count |
| `ObjectPassport.organizationName` | `organizations.name` | JOIN from `master_registry.organization_id` |
| `UserListItem.organizationName` | `organizations.name` | JOIN from `profiles.organization_id` |
| `EventLogItem.*` | `event_log.*` | Direct mapping, no transformation |
| `MSELInject.*` | `iodp_injects.*` | Field rename: `inject_code`, `target_team` |
| `PatientSummary.siteName` | `iodp_sites.name` | JOIN from `iodp_patients.site_id` |

---

## Architecture Rule

```
Database row (src/types or src/lib/iodp/types)
       ↓
  Service / query fn (src/lib/supabase/queries.ts or src/lib/iodp/supabase.ts)
       ↓
  Contract type (src/contracts/*.contract.ts)
       ↓
  Server Component prop or Server Action return value
       ↓
  UI Component (src/app or src/components) — imports from @/contracts only
```

UI components must not:
- Call `supabase.from(...)` directly for reads (use Server Components + queries.ts)
- Reference raw DB column names not in the contract (e.g. `drill.organization_id` → use `drill.organizationName`)
- Build their own joins or aggregations

Exception: Client components that call Server Actions (e.g. `logEventAction`) may build `FormData` directly.
