/**
 * RLS boundary tests.
 * Verifies that each role can only access what it should.
 *
 * Run:  npx vitest run tests/integration/rls.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, clientAs } from '../helpers/supabase'
import { seedTestUsers, type TestContext } from '../helpers/seed'

let ctx: TestContext

beforeAll(async () => {
  ctx = await seedTestUsers()
}, 60000)

// ── Notifications: own-only reads ────────────────────────────────────────────

describe('RLS: notifications', () => {
  let notifId = ''

  it('Admin can insert notification for commander', async () => {
    const admin = adminClient()
    const { data, error } = await admin
      .from('notifications')
      .insert({
        user_id: ctx.userIds.commander,
        type: 'info',
        title: 'RLS Test Notification',
        body: 'For commander only',
        read: false,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    notifId = data!.id
  })

  it('Commander sees their own notification', async () => {
    const client = await clientAs('commander')
    const { data, error } = await client
      .from('notifications')
      .select('id')
      .eq('id', notifId)
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBe(notifId)
  })

  it('Medical role cannot see commander notification', async () => {
    const client = await clientAs('medical')
    const { data } = await client
      .from('notifications')
      .select('id')
      .eq('id', notifId)
    // Should return empty array (RLS filters it out)
    expect((data ?? []).length).toBe(0)
  })

  it('Medical cannot directly insert notification', async () => {
    const client = await clientAs('medical')
    const { error } = await client.from('notifications').insert({
      user_id: ctx.userIds.commander,
      type: 'info',
      title: 'Injected malicious notification',
      read: false,
    })
    // Should fail — no INSERT policy
    expect(error).not.toBeNull()
  })
})

// ── event_log: guest cannot insert ───────────────────────────────────────────

describe('RLS: event_log', () => {
  it('Participant can insert event_log entry', async () => {
    const client = await clientAs('field')
    const { error } = await client.from('event_log').insert({
      event_type: 'FIELD_TEST',
      title: 'RLS test event',
      severity: 'info',
      mode: 'drill',
      user_id: ctx.userIds.field,
      timestamp: new Date().toISOString(),
    })
    // participant role is in the allowed list
    expect(error).toBeNull()
  })
})

// ── improvement_actions: participant cannot read ──────────────────────────────

describe('RLS: improvement_actions', () => {
  it('Evaluator can insert improvement_action', async () => {
    const client = await clientAs('evaluator')
    const admin = adminClient()
    // Need a valid aar_report_id
    const { data: aar } = await admin
      .from('aar_reports')
      .select('id')
      .limit(1)
      .single()

    if (!aar) {
      console.warn('No aar_reports found — skipping improvement_action RLS test')
      return
    }

    const { error } = await client.from('improvement_actions').insert({
      aar_report_id: aar.id,
      category: 'area_for_improvement',
      description: 'RLS test: evaluator insert',
      priority: 'low',
    })
    expect(error).toBeNull()
  })

  it('Participant (field) cannot read improvement_actions', async () => {
    const client = await clientAs('field')
    const { data, error } = await client
      .from('improvement_actions')
      .select('id')
      .limit(5)
    // Should return empty (RLS blocks participant)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
  })

  it('Participant cannot insert improvement_action', async () => {
    const client = await clientAs('field')
    const admin = adminClient()
    const { data: aar } = await admin
      .from('aar_reports')
      .select('id')
      .limit(1)
      .single()
    if (!aar) return

    const { error } = await client.from('improvement_actions').insert({
      aar_report_id: aar.id,
      category: 'area_for_improvement',
      description: 'Malicious insert by field user',
      priority: 'low',
    })
    expect(error).not.toBeNull()
  })
})

// ── sim_clock_state: only control_staff can write ────────────────────────────

describe('RLS: sim_clock_state', () => {
  it('Medical cannot insert sim_clock_state', async () => {
    const client = await clientAs('medical')
    const { error } = await client.from('sim_clock_state').insert({
      scenario_id: '00000000-0000-0000-0000-000000000001',
      sim_time_seconds: 0,
      speed_multiplier: 1.0,
      is_running: false,
    })
    expect(error).not.toBeNull()
  })
})

// ── evaluation_scores: participant cannot read ────────────────────────────────

describe('RLS: evaluation_scores', () => {
  it('Participant cannot read evaluation_scores', async () => {
    const client = await clientAs('field')
    const { data, error } = await client
      .from('evaluation_scores')
      .select('id')
      .limit(5)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
  })

  it('Evaluator can read evaluation_scores', async () => {
    const client = await clientAs('evaluator')
    const { error } = await client
      .from('evaluation_scores')
      .select('id')
      .limit(5)
    // No error expected — may return 0 rows but should not be blocked
    expect(error).toBeNull()
  })
})

// ── msel_injects: medical cannot write ───────────────────────────────────────

describe('RLS: msel_injects', () => {
  it('Medical cannot insert msel_inject', async () => {
    const client = await clientAs('medical')
    const { error } = await client.from('msel_injects').insert({
      scenario_id: '00000000-0000-0000-0000-000000000001',
      inject_code: 'MALICIOUS-001',
      title: 'Unauthorized inject',
      inject_type: 'event',
      trigger_mode: 'manual',
      sequence_order: 99,
    })
    expect(error).not.toBeNull()
  })

  it('Controller can insert msel_inject', async () => {
    const admin = adminClient()
    // Need a valid scenario_id
    const { data: scenario } = await admin
      .from('scenario_instances')
      .select('id')
      .limit(1)
      .single()
    if (!scenario) {
      console.warn('No scenario_instances found — skipping controller inject RLS test')
      return
    }

    const client = await clientAs('controller')
    const { error } = await client.from('msel_injects').insert({
      scenario_id: scenario.id,
      inject_code: `RLS-TEST-${Date.now()}`,
      title: 'RLS test inject by controller',
      inject_type: 'event',
      trigger_mode: 'manual',
      sequence_order: 99,
    })
    expect(error).toBeNull()
  })
})
