import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveFullContext } from '@/services/context.service'
import { SupplyRequestForm } from '@/components/field/supply-request-form'

export const metadata: Metadata = { title: 'Supply Request' }

export default async function SupplyRequestPage() {
  const ctxResult = await resolveFullContext()
  if (!ctxResult.ok) redirect('/login')
  const ctx = ctxResult.data

  return (
    <SupplyRequestForm
      drillId={ctx.activeIncidentId ?? ''}
      drillTitle={ctx.activeIncidentTitle ?? ''}
    />
  )
}
