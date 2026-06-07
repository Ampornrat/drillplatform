import { z } from 'zod'

export const methaneSchema = z.object({
  major_incident: z.boolean().default(false),
  title: z.string().trim().optional(),
  incident_type: z.string().min(1, 'ระบุประเภทเหตุ'),
  exact_location: z.string().min(2, 'ระบุสถานที่เกิดเหตุ'),
  mechanism: z.string().min(2, 'อธิบายกลไกเหตุ'),
  hazards: z.array(z.string()).min(1, 'เลือกอันตรายอย่างน้อย 1 รายการ'),
  access: z.string().min(2, 'อธิบายการเข้าถึง'),
  casualties: z.object({
    p1: z.number().int().min(0),
    p2: z.number().int().min(0),
    p3: z.number().int().min(0),
    black: z.number().int().min(0),
    unknown: z.number().int().min(0),
  }),
  emergency_services: z.array(z.string()).min(1, 'เลือกหน่วยงานที่ต้องการ'),
  lead_org: z.string().min(1, 'ระบุหน่วยนำ'),
  initial_command_mode: z.enum(['unified', 'single', 'joint']).default('unified'),
  safety_gates: z.object({
    zone: z.enum(['hot', 'warm', 'cold', 'pending']).default('pending'),
    route: z.enum(['passed', 'partial', 'pending', 'failed']).default('pending'),
    security: z.enum(['passed', 'pending', 'failed']).default('pending'),
    hospital: z.enum(['passed', 'pending', 'critical', 'failed']).default('pending'),
    authority: z.enum(['passed', 'pending', 'failed']).default('passed'),
  }),
  organization_id: z.string().uuid().optional(),
})

export type MethaneFormData = z.infer<typeof methaneSchema>
