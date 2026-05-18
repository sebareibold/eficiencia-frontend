export interface AttendanceRecord {
  id: string
  clientId: string
  clientName: string
  shiftId: string
  shiftLabel: string
  date: string
  present: boolean
}

export interface AttendanceByShift {
  shiftId: string
  date: string
  records: AttendanceRecord[]
}
