/**
 * dispatch.service.ts — Resource dispatch assignments.
 * No dedicated dispatch table yet — assignments tracked via iodp_teams or
 * a future dispatch_assignments table. This service provides the contract interface.
 */
import { ok, type ServiceResult } from '@/lib/result'
import type { DispatchAssignment } from '@/contracts/op.contract'

export async function getDispatchAssignments(
  _drillId: string
): Promise<ServiceResult<DispatchAssignment[]>> {
  // TODO: query dispatch_assignments table once created
  return ok([])
}
