import { ok, fail, type ServiceResult } from '@/lib/result'
import { getSession, getSessionWithProfile } from './auth.service'
import { getActiveCookies } from '@/lib/context-cookies'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, AppCtx, SystemMode, Profile } from '@/types'
import type { DrillListItem, ScenarioSummary } from '@/contracts/drill.contract'
import type { DrillMode, DrillStatus } from '@/contracts/common.contract'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface UserContext {
  userId: string
  role: UserRole
  organizationId: string | null
  canManage: boolean
  isAdmin: boolean
}

export interface FullUserContext extends UserContext {
  profile: Profile
  activeIncidentId: string | null
  activeScenarioId: string | null
  activeOrgId: string | null
  activeIncident: DrillListItem | null
  activeScenario: ScenarioSummary | null
}

// ── Basic resolver (backward-compat) ─────────────────────────────────────────

export async function resolveUserContext(): Promise<ServiceResult<UserContext>> {
  const result = await getSessionWithProfile()
  if (!result.ok) return result

  const { userId, profile } = result.data
  const role = profile.role as UserRole

  return ok({
    userId,
    role,
    organizationId: profile.organization_id,
    canManage: role === 'admin' || role === 'commander' || role === 'controller',
    isAdmin: role === 'admin',
  })
}

// ── Full context resolver ─────────────────────────────────────────────────────

export async function resolveFullContext(): Promise<ServiceResult<FullUserContext>> {
  const result = await getSessionWithProfile()
  if (!result.ok) return result

  const { userId, profile } = result.data
  const role = profile.role as UserRole
  const cookieCtx = await getActiveCookies()
  const supabase = await createClient()

  let activeIncident: DrillListItem | null = null
  if (cookieCtx.activeIncidentId) {
    const { data } = await supabase
      .from('drills')
      .select('id, title, description, mode, status, location, start_date, end_date, max_participants, organization_id, organizations(name)')
      .eq('id', cookieCtx.activeIncidentId)
      .single()
    if (data) {
      activeIncident = {
        id: data.id,
        title: data.title,
        description: data.description ?? null,
        mode: data.mode as DrillMode,
        status: data.status as DrillStatus,
        location: (data as unknown as { location: string | null }).location ?? null,
        organizationName: (data.organizations as { name: string } | null)?.name ?? null,
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        participantCount: 0,
        maxParticipants: data.max_participants ?? null,
      }
    }
  }

  let activeScenario: ScenarioSummary | null = null
  if (cookieCtx.activeScenarioId) {
    const { data } = await supabase
      .from('iodp_sessions')
      .select('id, code, title_th, mode, status, scenario_type, start_time, end_time')
      .eq('id', cookieCtx.activeScenarioId)
      .single()
    if (data) {
      activeScenario = {
        id: data.id,
        code: data.code,
        title: data.title_th,
        mode: data.mode as DrillMode,
        status: data.status,
        scenarioType: data.scenario_type,
        startTime: data.start_time,
        endTime: data.end_time,
      }
    }
  }

  return ok({
    userId,
    role,
    organizationId: profile.organization_id,
    canManage: role === 'admin' || role === 'commander' || role === 'controller',
    isAdmin: role === 'admin',
    profile,
    activeIncidentId: cookieCtx.activeIncidentId,
    activeScenarioId: cookieCtx.activeScenarioId,
    activeOrgId: cookieCtx.activeOrgId ?? profile.organization_id,
    activeIncident,
    activeScenario,
  })
}

/** Convert a FullUserContext to the serialisable AppCtx for client components. */
export function toAppCtx(ctx: FullUserContext): AppCtx {
  return {
    userId: ctx.userId,
    role: ctx.role,
    userName: ctx.profile.full_name,
    organizationId: ctx.organizationId,
    canManage: ctx.canManage,
    isAdmin: ctx.isAdmin,
    activeIncidentId: ctx.activeIncidentId,
    activeScenarioId: ctx.activeScenarioId,
    activeIncidentTitle: ctx.activeIncident?.title ?? null,
    activeIncidentMode: (ctx.activeIncident?.mode as SystemMode) ?? null,
    activeScenarioCode: ctx.activeScenario?.code ?? null,
  }
}

// ── Individual getters ────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const result = await getSession()
  return result.ok ? result.data : null
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const result = await getSessionWithProfile()
  return result.ok ? result.data.profile : null
}

export async function getCurrentMemberships(): Promise<{ organizationId: string | null; role: UserRole }[]> {
  const result = await getSessionWithProfile()
  if (!result.ok) return []
  const { profile } = result.data
  return [{ organizationId: profile.organization_id, role: profile.role as UserRole }]
}

export async function getActiveRole(): Promise<UserRole | null> {
  const result = await resolveUserContext()
  return result.ok ? result.data.role : null
}

export async function getActiveOrg(): Promise<string | null> {
  const result = await resolveUserContext()
  return result.ok ? result.data.organizationId : null
}

export async function getActiveIncidentId(): Promise<string | null> {
  const c = await getActiveCookies()
  return c.activeIncidentId
}

export async function getActiveScenarioId(): Promise<string | null> {
  const c = await getActiveCookies()
  return c.activeScenarioId
}

// ── Assertions ────────────────────────────────────────────────────────────────

export function assertCanManage(ctx: UserContext): ServiceResult<true> {
  if (!ctx.canManage) return fail('forbidden', 'ต้องมีสิทธิ์ Commander, Controller หรือ Admin')
  return ok(true as const)
}

export function assertAdmin(ctx: UserContext): ServiceResult<true> {
  if (!ctx.isAdmin) return fail('forbidden', 'ต้องมีสิทธิ์ Admin')
  return ok(true as const)
}

export function assertRole(ctx: UserContext, requiredRoles: UserRole[]): ServiceResult<true> {
  if (!requiredRoles.includes(ctx.role)) {
    return fail('forbidden', `ต้องมีสิทธิ์: ${requiredRoles.join(' หรือ ')}`)
  }
  return ok(true as const)
}

export async function assertCanAccessIncident(
  ctx: UserContext,
  incidentId: string
): Promise<ServiceResult<true>> {
  if (ctx.isAdmin || ctx.canManage) return ok(true as const)

  const supabase = await createClient()
  const { data } = await supabase
    .from('drill_participants')
    .select('id')
    .eq('drill_id', incidentId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (!data) return fail('forbidden', 'ไม่มีสิทธิ์เข้าถึง incident นี้')
  return ok(true as const)
}

export async function assertCanAccessScenario(
  ctx: UserContext,
  _scenarioId: string
): Promise<ServiceResult<true>> {
  if (ctx.isAdmin || ctx.canManage) return ok(true as const)
  if (ctx.role === 'evaluator' || ctx.role === 'controller') return ok(true as const)
  return fail('forbidden', 'ไม่มีสิทธิ์เข้าถึง scenario นี้')
}
