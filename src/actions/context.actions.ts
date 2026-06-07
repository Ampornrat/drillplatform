'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import {
  COOKIE_ACTIVE_INCIDENT,
  COOKIE_ACTIVE_SCENARIO,
  COOKIE_ACTIVE_ORG,
  COOKIE_OPTS,
} from '@/lib/context-cookies'
import { resolveUserContext } from '@/services/context.service'
import { fail, ok, type ServiceResult } from '@/lib/result'

export async function setActiveIncidentAction(incidentId: string): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const store = await cookies()
  store.set(COOKIE_ACTIVE_INCIDENT, incidentId, COOKIE_OPTS)
  revalidatePath('/', 'layout')
  return ok(true as const)
}

export async function setActiveScenarioAction(scenarioId: string): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const store = await cookies()
  store.set(COOKIE_ACTIVE_SCENARIO, scenarioId, COOKIE_OPTS)
  revalidatePath('/', 'layout')
  return ok(true as const)
}

export async function setActiveOrgAction(orgId: string): Promise<ServiceResult<true>> {
  const ctx = await resolveUserContext()
  if (!ctx.ok) return ctx

  const store = await cookies()
  store.set(COOKIE_ACTIVE_ORG, orgId, COOKIE_OPTS)
  revalidatePath('/', 'layout')
  return ok(true as const)
}

export async function clearActiveIncidentAction(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_ACTIVE_INCIDENT)
  revalidatePath('/', 'layout')
}

export async function clearActiveScenarioAction(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_ACTIVE_SCENARIO)
  revalidatePath('/', 'layout')
}

export async function clearActiveContextAction(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_ACTIVE_INCIDENT)
  store.delete(COOKIE_ACTIVE_SCENARIO)
  revalidatePath('/', 'layout')
}
