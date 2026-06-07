import { cookies } from 'next/headers'

export const COOKIE_ACTIVE_INCIDENT = 'dp_active_incident'
export const COOKIE_ACTIVE_SCENARIO = 'dp_active_scenario'
export const COOKIE_ACTIVE_ORG = 'dp_active_org'

export const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export async function getActiveCookies() {
  const store = await cookies()
  return {
    activeIncidentId: store.get(COOKIE_ACTIVE_INCIDENT)?.value ?? null,
    activeScenarioId: store.get(COOKIE_ACTIVE_SCENARIO)?.value ?? null,
    activeOrgId: store.get(COOKIE_ACTIVE_ORG)?.value ?? null,
  }
}
