/**
 * schemas.ts — Zod validation schemas for all form inputs.
 *
 * Import in Server Actions for server-side validation.
 * Import in Client Components for client-side validation / react-hook-form.
 * No 'use server' / 'use client' — this file is isomorphic.
 */
import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────────────────

const drillMode = z.enum(['operation', 'drill'])
const drillStatus = z.enum(['draft', 'planned', 'active', 'paused', 'completed', 'cancelled'])
const eventSeverity = z.enum(['info', 'warning', 'critical'])
const gateStatus = z.enum(['pending', 'passed', 'failed', 'waived'])
const priority = z.enum(['low', 'medium', 'high'])

// ── Operation module ─────────────────────────────────────────────────────────

/**
 * METHANE incident report → create drill in operation mode.
 * METHANE = Mechanism, Exact location, Type, Hazards, Access, Number, Emergency services
 */
export const createIncidentFromMethaneSchema = z.object({
  mechanism: z.string().min(1, 'ระบุกลไกการเกิดเหตุ'),
  exact_location: z.string().min(1, 'ระบุสถานที่เกิดเหตุ'),
  type: z.string().min(1, 'ระบุประเภทเหตุการณ์'),
  hazards: z.string().default(''),
  access: z.string().default(''),
  number_of_casualties: z.coerce.number().min(0).default(0),
  emergency_services: z.string().min(1, 'ระบุหน่วยที่ต้องการ'),
  // drill context fields
  mode: drillMode.default('operation'),
  drill_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
})
export type CreateIncidentFromMethaneInput = z.infer<typeof createIncidentFromMethaneSchema>

/** Update an IAP version (objectives, period, notes). */
export const updateIapSchema = z.object({
  drill_id: z.string().uuid(),
  objectives: z.array(z.string().min(1)).min(1, 'ต้องมีวัตถุประสงค์อย่างน้อย 1 ข้อ'),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  notes: z.string().optional(),
})
export type UpdateIapInput = z.infer<typeof updateIapSchema>

/** Dispatch a resource to an assignment. */
export const dispatchObjectSchema = z.object({
  drill_id: z.string().uuid(),
  resource_id: z.string().uuid(),
  assigned_to: z.string().min(1, 'ระบุผู้รับมอบหมาย'),
  location: z.string().optional(),
  priority: z.enum(['routine', 'urgent', 'immediate']).default('routine'),
  notes: z.string().optional(),
})
export type DispatchObjectInput = z.infer<typeof dispatchObjectSchema>

/** Update a facility / site status and load. */
export const updateFacilityStatusSchema = z.object({
  site_id: z.string().min(1),
  status: z.enum(['normal', 'surge', 'critical', 'closed']),
  current_load: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})
export type UpdateFacilityStatusInput = z.infer<typeof updateFacilityStatusSchema>

/** Full facility status update with medical capacity fields. */
export const updateFacilityStatusFullSchema = z.object({
  drill_id: z.string().uuid(),
  site_code: z.string().min(1),
  site_name: z.string().optional(),
  facility_level: z.enum(['Role1', 'Role2', 'Role3', 'CoE', 'CCP']).optional(),
  status: z.enum(['normal', 'surge', 'critical', 'closed']).default('normal'),
  current_load: z.coerce.number().min(0).default(0),
  capacity: z.coerce.number().min(0).optional(),
  icu_beds_total: z.coerce.number().min(0).default(0),
  icu_beds_available: z.coerce.number().min(0).default(0),
  or_available: z.coerce.boolean().default(true),
  blood_available: z.coerce.boolean().default(true),
  oxygen_level: z.enum(['normal', 'low', 'critical']).default('normal'),
  diversion_status: z.enum(['open', 'divert', 'closed', 'overloaded']).default('open'),
  notes: z.string().optional(),
})
export type UpdateFacilityStatusFullInput = z.infer<typeof updateFacilityStatusFullSchema>

/** Assign a destination facility to a patient. */
export const assignPatientDestinationSchema = z.object({
  patient_id: z.string().uuid(),
  destination_id: z.string().uuid(),
  transport_mode: z.string().optional(),
  transport_object_id: z.string().uuid().optional(),
})
export type AssignPatientDestinationInput = z.infer<typeof assignPatientDestinationSchema>

/** Create a patient movement record (start transport). */
export const createPatientMovementSchema = z.object({
  patient_id: z.string().uuid(),
  from_site_id: z.string().uuid().optional(),
  to_site_id: z.string().uuid(),
  transport_mode: z.string().optional(),
  transport_object_id: z.string().uuid().optional(),
  notes: z.string().optional(),
})
export type CreatePatientMovementInput = z.infer<typeof createPatientMovementSchema>

/** Confirm patient handover at destination facility. */
export const confirmPatientHandoverSchema = z.object({
  patient_id: z.string().uuid(),
  transport_object_id: z.string().uuid().optional(),
  mist_data: z.object({
    mechanism: z.string().optional(),
    injuries: z.string().optional(),
    signs: z.string().optional(),
    treatment: z.string().optional(),
    history: z.string().optional(),
    medications: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
})
export type ConfirmPatientHandoverInput = z.infer<typeof confirmPatientHandoverSchema>

// ── Drill module ─────────────────────────────────────────────────────────────

/** Create a new drill or operation session. Used by /planner/drills/new. */
export const createDrillSchema = z.object({
  title: z.string().min(1, 'ระบุชื่อ Drill'),
  description: z.string().optional(),
  mode: drillMode.default('drill'),
  location: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  max_participants: z.coerce.number().min(1).optional(),
  objectives: z.string().optional(),
})
export type CreateDrillInput = z.infer<typeof createDrillSchema>

/** Push a scenario inject to participants. Used by IODP ControlRoom. */
export const pushInjectSchema = z.object({
  session_id: z.string().min(1),
  inject_code: z.string().min(1, 'ระบุรหัส inject'),
  title: z.string().min(1, 'ระบุชื่อ inject'),
  description: z.string().optional(),
  type: z.string().min(1, 'ระบุประเภท inject'),
  target_team: z.string().optional(),
  severity: eventSeverity.default('info'),
  expected_action: z.string().optional(),
  scheduled_at: z.string().optional(),
})
export type PushInjectInput = z.infer<typeof pushInjectSchema>

// ── Field module ─────────────────────────────────────────────────────────────

/** Submit a triage assessment for one patient. */
export const submitFieldTriageSchema = z.object({
  patient_id: z.string().min(1),
  triage_level: z.enum(['P1', 'P2', 'P3', 'BLACK']),
  status: z.string().min(1),
  site_id: z.string().optional(),
  destination_id: z.string().optional(),
  march_data: z.object({
    massive_haemorrhage: z.boolean().default(false),
    airway: z.string().optional(),
    respiration: z.string().optional(),
    circulation: z.string().optional(),
    hypothermia: z.boolean().default(false),
  }).optional(),
})
export type SubmitFieldTriageInput = z.infer<typeof submitFieldTriageSchema>

/** Supply request from field team. */
export const supplyRequestSchema = z.object({
  drill_id: z.string().uuid(),
  item_code: z.string().min(1, 'ระบุรหัสสินค้า'),
  item_name: z.string().min(1, 'ระบุชื่อสินค้า'),
  quantity: z.coerce.number().min(1, 'จำนวนต้องมากกว่า 0'),
  unit: z.string().min(1, 'ระบุหน่วย'),
  priority: z.enum(['routine', 'urgent', 'immediate']).default('routine'),
})
export type SupplyRequestInput = z.infer<typeof supplyRequestSchema>

// ── Evaluation module ────────────────────────────────────────────────────────

/** Submit an evaluation score for one metric. */
export const submitEvaluationScoreSchema = z.object({
  drill_id: z.string().uuid(),
  metric_id: z.string().min(1),
  metric_name: z.string().min(1),
  category: z.string().min(1),
  score: z.coerce.number().min(0).max(10),
  max_score: z.coerce.number().min(1).default(10),
  notes: z.string().optional(),
  evaluated_at: z.string().optional(),
})
export type SubmitEvaluationScoreInput = z.infer<typeof submitEvaluationScoreSchema>

// ── AAR module ───────────────────────────────────────────────────────────────

const aarFindingSchema = z.object({
  category: z.enum(['strength', 'area_for_improvement', 'sustain', 'improve']),
  description: z.string().min(1, 'ระบุรายละเอียด'),
  recommendation: z.string().optional(),
  priority: priority.default('medium'),
  responsible_party: z.string().optional(),
  due_date: z.string().optional(),
})

/** Create / update an AAR report with findings. */
export const generateAarSchema = z.object({
  drill_id: z.string().uuid('ต้องเลือก Drill'),
  title: z.string().min(1, 'ระบุชื่อรายงาน'),
  summary: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  findings: z.array(aarFindingSchema).default([]),
})
export type GenerateAarInput = z.infer<typeof generateAarSchema>

// ── LMS ──────────────────────────────────────────────────────────────────────

/** Assign an LMS course to an AAR finding. */
export const assignLmsCourseSchema = z.object({
  finding_id: z.string().min(1),
  lms_course: z.string().min(1, 'ระบุรหัสหลักสูตร'),
  assignee_id: z.string().uuid().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
})
export type AssignLmsCourseInput = z.infer<typeof assignLmsCourseSchema>

// ── Registry module ──────────────────────────────────────────────────────────

/** Add item to master_registry. */
export const addRegistryItemSchema = z.object({
  type: z.enum(['personnel', 'unit', 'equipment']),
  name: z.string().min(1, 'ระบุชื่อ'),
  code: z.string().min(1, 'ระบุรหัส').transform(v => v.toUpperCase()),
  organization_id: z.string().optional(),
})
export type AddRegistryItemInput = z.infer<typeof addRegistryItemSchema>

/** Add entry to standards_registry. */
export const addStandardSchema = z.object({
  code: z.string().min(1, 'ระบุรหัสมาตรฐาน').transform(v => v.toUpperCase()),
  title: z.string().min(1, 'ระบุชื่อมาตรฐาน'),
  category: z.string().min(1, 'เลือกหมวดหมู่'),
  version: z.string().default('1.0'),
  effective_date: z.string().optional(),
  content: z.string().optional(),
})
export type AddStandardInput = z.infer<typeof addStandardSchema>

// ── Event log (manual) ───────────────────────────────────────────────────────

export const logEventSchema = z.object({
  title: z.string().min(1, 'ระบุชื่อ Event'),
  description: z.string().optional(),
  severity: eventSeverity.default('info'),
  event_type: z.string().default('observation'),
  drill_id: z.string().uuid().optional(),
})
export type LogEventInput = z.infer<typeof logEventSchema>

// ── Gate upsert ──────────────────────────────────────────────────────────────

export const upsertGateSchema = z.object({
  drill_id: z.string().uuid(),
  rule_id: z.string().uuid(),
  status: gateStatus,
  notes: z.string().optional(),
})
export type UpsertGateInput = z.infer<typeof upsertGateSchema>

// ── Status transition ────────────────────────────────────────────────────────

export const updateDrillStatusSchema = z.object({
  drill_id: z.string().uuid(),
  status: drillStatus,
})
export type UpdateDrillStatusInput = z.infer<typeof updateDrillStatusSchema>
