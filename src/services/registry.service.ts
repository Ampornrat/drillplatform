import { createClient } from '@/lib/supabase/server'
import { ok, fail, type ServiceResult } from '@/lib/result'
import type {
  ObjectPassport, StandardEntry, SafetyGateRule,
  AuthorityMatrixRow, UserListItem, OrganizationListItem,
} from '@/contracts/registry.contract'
import type { UserRole } from '@/contracts/common.contract'

export async function getObjectPassports(
  type?: 'personnel' | 'unit' | 'equipment'
): Promise<ServiceResult<ObjectPassport[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('master_registry')
    .select('*, organizations(name)')
    .eq('is_active', true)
    .order('type')
    .order('name')
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) return fail('database_error', error.message)
  return ok((data ?? []).map(r => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type as ObjectPassport['type'],
    organizationId: r.organization_id,
    organizationName: (r.organizations as { name: string } | null)?.name ?? null,
    data: (r.data ?? {}) as Record<string, unknown>,
    is_active: r.is_active,
    created_at: r.created_at,
  })))
}

export async function getStandards(activeOnly = true): Promise<ServiceResult<StandardEntry[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('standards_registry')
    .select('*')
    .order('code')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as unknown as StandardEntry[])
}

export async function getSafetyGateRules(activeOnly = true): Promise<ServiceResult<SafetyGateRule[]>> {
  const supabase = await createClient()
  let q = supabase
    .from('safety_gate_rules')
    .select('*')
    .order('priority')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) return fail('database_error', error.message)
  return ok((data ?? []) as unknown as SafetyGateRule[])
}

export async function getAuthorityMatrix(): Promise<ServiceResult<AuthorityMatrixRow[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('authority_matrix')
    .select('*')
    .order('role')
    .order('resource')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []).map(r => ({
    id: r.id,
    role: r.role as UserRole,
    resource: r.resource,
    action: r.action,
    allowed: r.allowed,
    conditions: r.conditions as Record<string, unknown> | null,
  })))
}

export async function getUserList(): Promise<ServiceResult<UserListItem[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .order('full_name')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role as UserRole,
    organizationId: p.organization_id,
    organizationName: (p.organizations as { name: string } | null)?.name ?? null,
    position: p.position,
    phone: p.phone,
    created_at: p.created_at,
  })))
}

export async function getOrganizationList(): Promise<ServiceResult<OrganizationListItem[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, code, description, contact_email, is_active')
    .order('name')
  if (error) return fail('database_error', error.message)
  return ok((data ?? []).map(o => ({
    id: o.id,
    name: o.name,
    code: o.code,
    description: o.description,
    contact_email: (o as { contact_email?: string | null }).contact_email ?? null,
    is_active: o.is_active,
    memberCount: 0,
  })))
}
