/**
 * evaluation.service.ts — Evaluation scoring.
 * No dedicated evaluation table yet. Scores are derived from iodp_events
 * or a future evaluation_metrics table. This service provides the interface.
 */
import { ok, type ServiceResult } from '@/lib/result'
import type { EvaluationResult } from '@/contracts/evaluation.contract'

export async function getEvaluationResult(
  _drillId: string
): Promise<ServiceResult<EvaluationResult | null>> {
  // TODO: query evaluation_metrics table once created
  return ok(null)
}
