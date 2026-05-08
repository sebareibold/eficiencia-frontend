import { useState, useCallback } from 'react'
import { attendanceApi } from '../api/attendance.api'
import type { AttendanceRecord } from '../types/attendance.types'

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchByShiftAndDate = useCallback(async (shiftId: string, date: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await attendanceApi.getByShiftAndDate(shiftId, date)
      setRecords(data)
    } catch {
      setError('No se pudo cargar la asistencia')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { records, isLoading, error, fetchByShiftAndDate }
}
