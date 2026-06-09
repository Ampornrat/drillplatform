import { describe, it, expect } from 'vitest'
import {
  createImprovementActionSchema,
  submitMetricScoreSchema,
  fieldCheckinSchema,
} from '@/contracts/schemas'

// Zod v4 enforces proper RFC-4122 UUID variant bits (4th group must start with 8/9/a/b)
const VALID_UUID = 'a0b1c2d3-e4f5-4678-8901-a2b3c4d5e6f7'

describe('Zod schemas', () => {
  describe('createImprovementActionSchema', () => {
    it('accepts valid input', () => {
      const result = createImprovementActionSchema.safeParse({
        aar_report_id: VALID_UUID,
        description: 'ทีมไม่ทำ triage ถูกต้อง',
        category: 'area_for_improvement',
        priority: 'high',
        severity: 'critical',
        evidence_event_ids: [],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty description', () => {
      const result = createImprovementActionSchema.safeParse({
        aar_report_id: VALID_UUID,
        description: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid UUID', () => {
      const result = createImprovementActionSchema.safeParse({
        aar_report_id: 'not-a-uuid',
        description: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('submitMetricScoreSchema', () => {
    it('accepts numeric score as string (coerce)', () => {
      const result = submitMetricScoreSchema.safeParse({
        drill_id: VALID_UUID,
        metric_id: 'TRIAGE_ACCURACY',
        metric_name: 'Triage Accuracy',
        category: 'clinical',
        score: '4',
        max_score: '5',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.score).toBe(4)
        expect(result.data.max_score).toBe(5)
      }
    })

    it('rejects score above 5', () => {
      const result = submitMetricScoreSchema.safeParse({
        drill_id: VALID_UUID,
        metric_id: 'TRIAGE_ACCURACY',
        metric_name: 'Triage Accuracy',
        category: 'clinical',
        score: 6,
        max_score: 5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('fieldCheckinSchema', () => {
    it('accepts valid check-in with location', () => {
      const result = fieldCheckinSchema.safeParse({
        drill_id: VALID_UUID,
        status: 'available',
        lat: 13.7563,
        lng: 100.5018,
        location_name: 'Command Post Alpha',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = fieldCheckinSchema.safeParse({
        drill_id: VALID_UUID,
        status: 'unknown_status',
      })
      expect(result.success).toBe(false)
    })
  })
})
