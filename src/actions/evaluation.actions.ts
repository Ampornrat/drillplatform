'use server'

import { resolveUserContext } from '@/services/context.service'
import { logEvent } from '@/services/event.service'
import { fail, ok, type ServiceResult } from '@/lib/result'
import { submitEvaluationScoreSchema } from '@/contracts/schemas'

export async function submitEvaluationScoreActionV2(
  formData: FormData
): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const raw = Object.fromEntries(formData.entries())
  const parsed = submitEvaluationScoreSchema.safeParse(raw)
  if (!parsed.success) {
    return fail('validation_error', parsed.error.issues[0].message, parsed.error.issues)
  }

  // TODO: insert to evaluation_metrics table once created
  const d = parsed.data
  await logEvent({
    eventType: 'evaluation_score_submitted',
    title: `คะแนน ${d.metric_name}: ${d.score}/${d.max_score}`,
    severity: 'info',
    mode: 'drill',
    drillId: d.drill_id,
    userId: ctx.data.userId,
  })

  return ok(true as const)
}
