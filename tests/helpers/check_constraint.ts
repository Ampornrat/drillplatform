import './setup'
import { adminClient } from './supabase'

const admin = adminClient()

async function run() {
  const { error } = await admin.from('profiles').insert({
    id: '00000000-0000-4000-8000-000000000099',
    full_name: 'Constraint Test',
    role: 'medical',
    organization_id: '00000000-0000-4000-8000-000000000001',
    is_active: false,
  })
  console.log('medical role:', error?.message ?? 'OK (constraint accepts medical)')
  await admin.from('profiles').delete().eq('id', '00000000-0000-4000-8000-000000000099')
}

run().catch(console.error)
