import { notFound, redirect } from 'next/navigation'
import { resolveUserContext } from '@/services/context.service'
import { getFacilitiesForDrill } from '@/services/facility.service'
import { getTransportObjects, getPatientTracksForDrill, getPatientMovementsForDrill } from '@/services/transport.service'
import { FacilityBoard } from './facility-board'
import { PatientMatching } from './patient-matching'
import { TransportTimeline } from './transport-timeline'
import { Building2, Users, Truck } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Facility & Transport — ระบบส่งต่อ' }

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: drillId } = await params

  const ctxResult = await resolveUserContext()
  if (!ctxResult.ok) redirect('/login')

  const [facilitiesResult, transportsResult, patientsResult, movementsResult] = await Promise.all([
    getFacilitiesForDrill(drillId),
    getTransportObjects(drillId),
    getPatientTracksForDrill(drillId),
    getPatientMovementsForDrill(drillId),
  ])

  const facilities = facilitiesResult.ok ? facilitiesResult.data : []
  const transports = transportsResult.ok ? transportsResult.data : []
  const patients = patientsResult.ok ? patientsResult.data : []
  const movements = movementsResult.ok ? movementsResult.data : []

  const unassignedCount = patients.filter(
    p => !p.destination_id && p.status !== 'admitted' && p.status !== 'deceased'
  ).length
  const enRouteCount = patients.filter(p => p.status === 'en_route').length
  const admittedCount = patients.filter(p => p.status === 'admitted').length
  const diversionCount = facilities.filter(
    f => f.diversion_status !== 'open' && f.diversion_status !== null
  ).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b shrink-0">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">ปฏิบัติการ · ระบบส่งต่อ</div>
          <h1 className="text-xl font-bold text-gray-900">Facility & Transport</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            สถานพยาบาล · Patient Matching · การส่งต่อผู้ป่วย
          </p>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{facilities.length}</div>
            <div className="text-xs text-gray-500">สถานพยาบาล</div>
          </div>
          {diversionCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{diversionCount}</div>
              <div className="text-xs text-gray-500">Divert/Closed</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{unassignedCount}</div>
            <div className="text-xs text-gray-500">รอกำหนดปลายทาง</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{enRouteCount}</div>
            <div className="text-xs text-gray-500">กำลังเดินทาง</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{admittedCount}</div>
            <div className="text-xs text-gray-500">รับตัวแล้ว</div>
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Hospital load board */}
        <div className="w-80 border-r flex flex-col overflow-hidden bg-white shrink-0">
          <div className="px-3 py-2.5 border-b flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">สถานพยาบาล</span>
            <span className="ml-auto text-xs text-gray-400">{facilities.length} แห่ง</span>
          </div>
          <FacilityBoard drillId={drillId} initialFacilities={facilities} />
        </div>

        {/* Center: Patient matching */}
        <div className="flex-1 border-r flex flex-col overflow-hidden bg-gray-50 min-w-0">
          <div className="px-3 py-2.5 border-b flex items-center gap-2 bg-white shrink-0">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">Patient Matching</span>
            <span className="ml-auto text-xs text-gray-400">{patients.length} ผู้ป่วย</span>
          </div>
          <PatientMatching
            drillId={drillId}
            initialPatients={patients}
            facilities={facilities}
            transports={transports}
          />
        </div>

        {/* Right: Transport + timeline */}
        <div className="w-80 flex flex-col overflow-hidden bg-white shrink-0">
          <div className="px-3 py-2.5 border-b flex items-center gap-2 shrink-0">
            <Truck className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">Transport & Timeline</span>
            <span className="ml-auto text-xs text-gray-400">{transports.filter(t => t.status === 'available').length} ว่าง</span>
          </div>
          <TransportTimeline
            drillId={drillId}
            initialTransports={transports}
            initialPatients={patients}
            initialMovements={movements}
          />
        </div>
      </div>
    </div>
  )
}
