'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ServiceResult } from '@/lib/result'
import type { MethaneFormData } from '@/lib/validators/methane'

export type MethaneSuccess = {
  drill_id: string
  methane_report_id: string
  safety_gate_critical: boolean
}

const CRITICAL_STATUSES = new Set(['failed', 'critical', 'hot'])

export async function createIncidentFromMethane(
  data: MethaneFormData
): Promise<ServiceResult<MethaneSuccess>> {
  const supabase = await createClient()

  // 1. Call RPC — creates drills + methane_reports + _log_event
  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'create_incident_from_methane',
    {
      payload: {
        title: data.title,
        type: data.incident_type,
        exact_location: data.exact_location,
        mechanism: data.mechanism,
        hazards: data.hazards.join(', '),
        access: data.access,
        number_of_casualties:
          data.casualties.p1 + data.casualties.p2 +
          data.casualties.p3 + data.casualties.black + data.casualties.unknown,
        emergency_services: data.emergency_services.join(', '),
        mode: 'operation',
        organization_id: data.organization_id ?? null,
      },
    }
  )

  if (rpcErr) return fail('database_error', rpcErr.message)
  if (rpcData?.error) return fail('database_error', rpcData.message ?? 'RPC error')

  const drillId: string = rpcData.data.drill_id
  const methaneReportId: string = rpcData.data.methane_report_id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('unauthorized', 'ต้องเข้าสู่ระบบก่อน')

  // 2. Seed drill_safety_gates from active rules
  const { data: rules } = await supabase
    .from('safety_gate_rules')
    .select('id, condition_type')
    .eq('is_active', true)

  if (rules && rules.length > 0) {
    const gateStatusForCondition = (condition: string | null): string => {
      switch (condition) {
        case 'zone':     return data.safety_gates.zone === 'hot' ? 'failed' : 'pending'
        case 'route':    return data.safety_gates.route === 'failed' ? 'failed' : data.safety_gates.route === 'passed' ? 'passed' : 'pending'
        case 'security': return data.safety_gates.security
        case 'hospital': return data.safety_gates.hospital === 'critical' || data.safety_gates.hospital === 'failed' ? 'failed' : data.safety_gates.hospital
        case 'authority': return data.safety_gates.authority
        default:         return 'pending'
      }
    }
    await supabase.from('drill_safety_gates').upsert(
      rules.map(r => ({
        drill_id: drillId,
        rule_id: r.id,
        status: gateStatusForCondition(r.condition_type),
        checked_by: user.id,
        checked_at: new Date().toISOString(),
      })),
      { onConflict: 'drill_id,rule_id' }
    )
  }

  // 3. Determine if any gate is in a critical state
  const safety_gate_critical = Object.values(data.safety_gates).some(v => CRITICAL_STATUSES.has(v))

  // 4. Create IAP v1 draft
  await supabase.from('iap_versions').insert({
    drill_id: drillId,
    version: 1,
    objectives: [],
    created_by: user.id,
    period_start: new Date().toISOString(),
  })

  // 5. Notify relevant roles
  const { data: targets } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'commander', 'medical', 'logistics'])

  if (targets && targets.length > 0) {
    const totalCas =
      data.casualties.p1 + data.casualties.p2 + data.casualties.p3 + data.casualties.black
    await supabase.from('notifications').insert(
      targets.map(t => ({
        user_id: t.id,
        type: safety_gate_critical ? 'critical' : 'warning',
        title: `เปิดเหตุ: ${data.incident_type} · ${data.exact_location}`,
        body: `METHANE รายงานส่งแล้ว · ผู้ประสบภัย ${totalCas} ราย`,
        drill_id: drillId,
        link: `/op/dashboard`,
      }))
    )
  }

  revalidatePath('/', 'layout')

  return ok({ drill_id: drillId, methane_report_id: methaneReportId, safety_gate_critical })
}
