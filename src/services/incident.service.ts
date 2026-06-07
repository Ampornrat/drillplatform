/**
 * incident.service.ts — Operations are drills with mode='operation'.
 * Thin wrapper around drill.service with the mode filter fixed.
 */
import { getDrillsList } from './drill.service'
import type { ServiceResult } from '@/lib/result'
import type { DrillListItem } from '@/contracts/drill.contract'

export async function getIncidentList(): Promise<ServiceResult<DrillListItem[]>> {
  return getDrillsList({ mode: 'operation' })
}

export async function getActiveIncidents(): Promise<ServiceResult<DrillListItem[]>> {
  return getDrillsList({ mode: 'operation', status: 'active' })
}
