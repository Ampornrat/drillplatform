export const mockIncident = {
  id: 'INC-2026-0847',
  title: 'น้ำท่วม + MCI ตลิ่งชัน',
  mode: 'JOINT',
  leadAgency: 'Bangkok EOC + Royal Thai Army Medical',
  operationPeriod: 'OP-3 · T+04:00–08:00',
  iapVersion: 'v2.1',
  iapApprovedAt: 'T+03:58',
  responseLevel: 'REGIONAL',
  startedAt: 'T+04:12',
  startedAgo: '4 ชม. 12 นาทีที่แล้ว',
  center: { lat: 13.7775, lng: 100.4582 },
  zoom: 14,
}

export const mockStats = {
  responders: { total: 82, p1: 8, p2: 24, p3: 47, deceased: 3 },
  teams: { sent: 14, total: 18, enroute: 4, onsite: 10 },
  hospitals: { availableBeds: 2, notes: 'สีราช (R2) · CoE พนม.' },
  safetyGates: { critical: 1, note: 'ด่านปิดความสามารถ รพ. ไม่ผ่าน' },
  responseLevel: { label: 'ระดับภูมิภาค', elapsed: 'T+03:40' },
  copCompleteness: { percent: 87, reported: 12, total: 14 },
}

export const mockMarkers = [
  { id: 'UAV-1', type: 'uav', lat: 13.785, lng: 100.438, label: 'UAV-1' },
  { id: 'UAV-2', type: 'uav', lat: 13.772, lng: 100.458, label: 'UAV-2' },
  { id: 'SITE-A', type: 'site', lat: 13.778, lng: 100.442, label: 'SITE-A' },
  { id: 'SITE-B', type: 'site', lat: 13.771, lng: 100.448, label: 'SITE-B' },
  { id: 'CCP-1', type: 'ccp', lat: 13.774, lng: 100.451, label: 'CCP-1' },
  { id: 'LZ-1', type: 'lz', lat: 13.776, lng: 100.462, label: 'LZ-1' },
  { id: 'FAC-R3-RAM', type: 'hospital', lat: 13.770, lng: 100.468, label: 'FAC-R3-RAM' },
  { id: 'FAC-R2-SIR', type: 'hospital', lat: 13.765, lng: 100.461, label: 'FAC-R2-SIR' },
  { id: 'FAC-R3-CHU', type: 'hospital', lat: 13.762, lng: 100.470, label: 'FAC-R3-CHU' },
  { id: 'FAC-COE-PMK', type: 'hospital', lat: 13.782, lng: 100.471, label: 'FAC-COE-PMK' },
]

export const mockSafetyGates = [
  { id: 'EOD_GATE', label: 'ปลอดวัตถุระเบิด', status: 'passed' },
  { id: 'HAZMAT_GATE', label: 'สารอันตราย', status: 'pending' },
  { id: 'LZ_GATE', label: 'พื้นที่ลงจอด', status: 'passed' },
  { id: 'HOSP_GATE', label: 'ความสามารถ รพ.', status: 'critical' },
  { id: 'COMM_GATE', label: 'การสื่อสาร', status: 'passed' },
  { id: 'SUPPLY_GATE', label: 'เสบียง/เวชภัณฑ์', status: 'pending' },
]
