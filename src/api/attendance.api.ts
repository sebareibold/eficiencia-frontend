import api from './axiosInstance'
import type { AttendanceRecord } from '../types/attendance.types'

export const attendanceApi = {
  getByShiftAndDate: (shiftId: number, date: string) =>
    api.get<AttendanceRecord[]>('/attendance', { params: { shiftId, date } }).then((r) => r.data),
  mark: (shiftId: number, clientId: number, date: string, present: boolean) =>
    api.post<AttendanceRecord>('/attendance', { shiftId, clientId, date, present }).then((r) => r.data),
  getByClient: (clientId: number) =>
    api.get<AttendanceRecord[]>(`/attendance/client/${clientId}`).then((r) => r.data),
}
