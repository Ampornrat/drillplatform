/**
 * Test seed/cleanup helpers.
 * Idempotent — safe to run multiple times.
 * Call seedTestUsers() once before running any tests.
 * Call cleanupTestDrill(drillId) after integration tests.
 */
import { adminClient, TEST_EMAILS, TEST_PASSWORD, type TestRole } from './supabase'

// Returned by seedTestUsers() — IDs used across all test steps
export interface TestContext {
  orgId: string
  userIds: Record<TestRole, string>
  safetyRuleId: string
  templateId: string
}

export async function seedTestUsers(): Promise<TestContext> {
  const admin = adminClient()

  // 1. Upsert test organisation
  const { data: orgData, error: orgErr } = await admin
    .from('organizations')
    .upsert(
      {
        name: 'Test Organisation',
        code: 'TEST-ORG',
        is_active: true,
      },
      { onConflict: 'code', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (orgErr || !orgData) throw new Error(`org seed: ${orgErr?.message}`)
  const orgId = orgData.id

  // 2. Create auth users + profiles for each test role
  const roles: TestRole[] = ['admin', 'commander', 'medical', 'logistics', 'controller', 'evaluator', 'field']
  const userIds: Record<string, string> = {}

  for (const role of roles) {
    const email = TEST_EMAILS[role]
    const profileRole = role === 'field' ? 'participant' : role

    // Try to create; if already exists, find via listUsers
    let uid: string
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })

    if (userData.user) {
      uid = userData.user.id
    } else if (userErr?.message?.toLowerCase().includes('already') || userErr?.message?.toLowerCase().includes('database error')) {
      // User exists — find by email via listUsers
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const found = list?.users?.find((u: { email?: string }) => u.email === email)
      if (!found) throw new Error(`Cannot find existing user ${email}: ${userErr.message}`)
      uid = found.id
    } else {
      throw new Error(`createUser ${email}: ${userErr?.message}`)
    }

    // Upsert profile (columns: id, full_name, role, organization_id, is_active)
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: uid,
        full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        role: profileRole as 'admin' | 'commander' | 'medical' | 'logistics' | 'controller' | 'evaluator' | 'observer' | 'participant' | 'guest',
        organization_id: orgId,
        is_active: true,
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    if (profileErr) throw new Error(`profile ${email}: ${profileErr.message}`)

    userIds[role] = uid
  }

  // 3. Ensure at least one safety_gate_rule exists
  const { data: gateRule } = await admin
    .from('safety_gate_rules')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  let safetyRuleId = gateRule?.id ?? ''
  if (!safetyRuleId) {
    const { data: newRule, error: ruleErr } = await admin
      .from('safety_gate_rules')
      .insert({
        name: 'Zone Safety Check',
        condition_type: 'zone',
        description: 'Scene zone must be cold before resource deployment',
        is_active: true,
        priority: 1,
      })
      .select('id')
      .single()
    if (ruleErr || !newRule) throw new Error(`safety_gate_rule: ${ruleErr?.message}`)
    safetyRuleId = newRule.id
  }

  // 4. Ensure at least one scenario_template exists
  const { data: template } = await admin
    .from('scenario_templates')
    .select('id')
    .limit(1)
    .single()

  let templateId = template?.id ?? ''
  if (!templateId) {
    const { data: newTmpl, error: tmplErr } = await admin
      .from('scenario_templates')
      .insert({
        code: 'MCI-TEST-001',
        title: 'MCI Test Template',
        description: 'Auto-seeded for E2E tests',
        scenario_type: 'MCI',
        default_duration_minutes: 120,
        default_objectives: ['Triage all casualties', 'Report METHANE'],
        is_active: true,
      })
      .select('id')
      .single()
    if (tmplErr || !newTmpl) throw new Error(`scenario_template: ${tmplErr?.message}`)
    templateId = newTmpl.id
  }

  return {
    orgId,
    userIds: userIds as Record<TestRole, string>,
    safetyRuleId,
    templateId,
  }
}

export async function cleanupTestDrill(drillId: string) {
  const admin = adminClient()
  // Cascade deletes handle child rows (event_log, drill_safety_gates, etc.)
  await admin.from('drills').delete().eq('id', drillId)
}
