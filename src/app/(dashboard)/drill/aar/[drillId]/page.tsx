import { notFound, redirect } from 'next/navigation'
import { resolveUserContext } from '@/services/context.service'
import { getAARDetail } from '@/services/aar.service'
import AARDetail from './aar-detail'

interface Props {
  params: Promise<{ drillId: string }>
}

export default async function AARDetailPage({ params }: Props) {
  const { drillId } = await params

  const ctx = await resolveUserContext()
  if (!ctx.ok) redirect('/login')

  const { role } = ctx.data
  if (!['admin', 'evaluator', 'commander', 'controller', 'observer'].includes(role)) {
    redirect('/forbidden')
  }

  const result = await getAARDetail(drillId)
  if (!result.ok) notFound()

  const canEdit = ['admin', 'evaluator', 'commander', 'controller'].includes(role)

  return <AARDetail data={result.data} canEdit={canEdit} />
}
