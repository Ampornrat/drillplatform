/**
 * common.contract.ts — Base types shared across all modules.
 *
 * Raw DB row types live in @/types. This file re-exports the stable
 * subset and adds view-model primitives that every contract file uses.
 */

// ── Re-exports from @/types (single source of truth for enums) ──────────────
export type {
  UserRole,
  SystemMode as DrillMode,
  DrillStatus,
  EventSeverity,
} from '@/types'

// ── New primitives not in @/types ────────────────────────────────────────────
export type GateStatus = 'pending' | 'passed' | 'failed' | 'waived'

/** Standard server action return envelope. */
export interface ApiResult<T = void> {
  data?: T
  error?: string
}

/** In-app notification (no external push yet). */
export interface Notification {
  id: string
  type: 'info' | 'warning' | 'critical' | 'success'
  title: string
  body: string | null
  read: boolean
  created_at: string
  link?: string
}

/**
 * Typed wrapper for Supabase postgres_changes payloads.
 * Consumers cast `new` / `old` to the relevant contract type.
 */
export interface RealtimePayload<T = Record<string, unknown>> {
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: Partial<T>
  /** Present on event_log rows tied to a drill */
  drill_id?: string | null
  /** Present on iodp_* rows */
  session_id?: string | null
}

export interface PaginationParams {
  page: number
  limit: number
}

/** Normalised event_log row — what UI components receive (not raw DB row). */
export interface EventLogItem {
  id: string
  drill_id: string | null
  event_type: string
  title: string
  description: string | null
  severity: import('@/types').EventSeverity
  mode: import('@/types').SystemMode
  user_id: string
  timestamp: string
}
