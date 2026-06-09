# Demo Flow — 21-Step Walkthrough

Full end-to-end demonstration of the Drill Platform covering all major roles.

## Prerequisites

1. Apply all migrations 001–017 to live DB
2. Seed test users: `npx tsx tests/helpers/seed.ts`
3. Ensure an active drill exists (or create one via METHANE intake)
4. Dev server: `npm run dev` (port 3002)

---

## Step-by-step

### Phase 1 — Incident Creation (Commander)

**Step 1 — Login as Commander**
- URL: `/login`
- Email: `commander@drill.test` / password in `.env.local`

**Step 2 — Create incident from METHANE**
- Navigate to IODP workspace → ภาพรวมสั่งการ → เปิดเหตุใหม่ (METHANE)
- Fill METHANE form: type, location, mechanism, casualties, emergency services
- Submit → calls `create_incident_from_methane` RPC
- Expected: drill created, safety gates seeded, event_log row written

**Step 3 — Dashboard shows new incident**
- Navigate to `/dashboard`
- Expected: drill card appears with status `active`

### Phase 2 — IAP (Commander)

**Step 4 — Create IAP v1**
- Navigate to drill → IAP Workspace → สร้างเวอร์ชันใหม่
- Calls `create_iap_version` RPC
- Expected: IAP v1 saved, period_start set

**Step 5 — Approve/Activate IAP**
- Click อนุมัติ → updates `drills.objectives`
- Expected: IAP label shows อนุมัติแล้ว in OpStatusStrip

### Phase 3 — Resource Dispatch (Commander / Logistics)

**Step 6 — Create Task Force**
- Navigate to Registry → สร้างกลุ่ม
- Calls `master_registry` INSERT
- Expected: team appears in resource list

**Step 7 — Dispatch team**
- COP Map → เลือกทีม → ส่ง
- Calls `dispatch_object` RPC
- Expected: dispatch_assignment created, event_log row written

### Phase 4 — Field Operations (Medical / Field)

**Step 8 — Field user check-in**
- Switch to Field role → Check-in tab
- Calls `submit_field_checkin` action
- Expected: TEAM_CHECK_IN event logged, team status updated

**Step 9 — Field user triage P1**
- Triage tab → select P1 → ส่ง
- Calls `submit_triage` (requires linked iodp_session)
- Expected: PATIENT_TRIAGED event, patient updated in DB

### Phase 5 — Facility Coordination (Medical)

**Step 10 — Facility update to divert**
- Navigate to Facility view → คลิก เบี่ยง on ศิริราช
- Calls `updateFacilityStatusAction`
- Expected: facility_status row updated, FACILITY_DIVERSION event

**Step 11 — Dashboard sees diversion realtime**
- Switch back to Commander tab
- Expected: notification bell increments, CriticalAlertBanner shows

### Phase 6 — Safety Gate Violation

**Step 12 — Safety gate violation**
- Controller → ห้องควบคุมการฝึก → Gate tab → mark gate as FAILED
- Calls `upsert_drill_safety_gate` RPC
- Expected: gate turns red, SAFETY_GATE_VIOLATION notification fan-out

### Phase 7 — Scenario Control (Controller)

**Step 13 — Controller creates scenario**
- Controller role → Scenario Builder → สร้างใหม่
- Inserts into scenario_instances

**Step 14 — Controller pushes inject**
- Control Room → Inject Queue → ส่ง inject
- Calls `push_msel_inject` RPC
- Expected: inject_deliveries row created, INJECT_PUSHED event

**Step 15 — Field/Op UI sees inject**
- Field inbox tab shows new inject
- Realtime subscription on `iodp_events` triggers refresh

### Phase 8 — Evaluation (Evaluator)

**Step 16 — Evaluator submits observation**
- Evaluator role → Evaluation → เพิ่มการสังเกต
- Inserts into evaluator_flags

**Step 17 — Evaluation dashboard updates score**
- Click คำนวณคะแนน → calls `submit_evaluation_score`
- Expected: score updated, percentage visible

### Phase 9 — AAR & LMS (Commander / Evaluator)

**Step 18 — Generate AAR**
- AAR tab → สร้าง AAR → calls `generate_aar_findings`
- Expected: aar_reports row, findings populated from event_log

**Step 19 — Map finding to LMS course**
- Click finding → เชื่อม LMS → calls `assign_lms_course`

**Step 20 — Assign LMS course**
- Confirm → lms_assignments row created

**Step 21 — Improvement action created**
- Click สร้าง improvement action → calls `create_improvement_action`
- Expected: improvement_actions row, linked to aar_report

---

## Acceptance checks after demo

```
✅ event_log contains: INCIDENT_CREATED, FACILITY_DIVERSION, SAFETY_GATE_VIOLATION, INJECT_PUSHED, PATIENT_TRIAGED
✅ notifications fan-out to commander for FACILITY_DIVERSION + SAFETY_GATE_VIOLATION
✅ CriticalAlertBanner shows on commander dashboard
✅ AAR report has ≥ 1 finding
✅ improvement_actions has ≥ 1 row
```
