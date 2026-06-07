/**
 * notification.service.ts — In-app notifications.
 * No push/email infrastructure yet. Returns empty list until
 * a notifications table or external service is wired up.
 */
import { ok, type ServiceResult } from '@/lib/result'
import type { Notification } from '@/contracts/common.contract'

export async function getNotifications(
  _userId: string
): Promise<ServiceResult<Notification[]>> {
  // TODO: query notifications table or push service once created
  return ok([])
}

export async function markNotificationRead(_id: string): Promise<ServiceResult<true>> {
  // TODO: update notifications table
  return ok(true as const)
}
