export interface AttendanceRecord {
  id: number
  clientId: number
  clientName: string
  shiftId: number
  date: string
  present: boolean
}

export interface AttendanceByShift {
  shiftId: number
  date: string
  records: AttendanceRecord[]
}
