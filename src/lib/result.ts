/**
 * Typed result helpers — ok / fail.
 * All service functions and server actions return ServiceResult<T>.
 * No exceptions propagate to UI — errors are always explicit.
 */

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'not_found'
  | 'safety_gate_blocked'
  | 'conflict'
  | 'database_error'

export interface Ok<T> {
  ok: true
  data: T
}

export interface Fail {
  ok: false
  code: ErrorCode
  message: string
  details?: unknown
}

export type ServiceResult<T> = Ok<T> | Fail

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data }
}

export function fail(
  code: ErrorCode,
  message: string,
  details?: unknown
): Fail {
  return { ok: false, code, message, details }
}

/** Unwrap a ServiceResult, throwing on failure. Use only in Server Actions that have already validated. */
export function unwrap<T>(result: ServiceResult<T>): T {
  if (!result.ok) throw new Error(`[${result.code}] ${result.message}`)
  return result.data
}

/** Map the data of a successful result. */
export function mapResult<T, U>(
  result: ServiceResult<T>,
  fn: (data: T) => U
): ServiceResult<U> {
  if (!result.ok) return result
  return ok(fn(result.data))
}
