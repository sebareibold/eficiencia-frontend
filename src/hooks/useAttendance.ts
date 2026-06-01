import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { attendanceApi } from '../api/attendance.api'
import { QK } from '../lib/queryKeys'
import type { AttendanceRecord } from '../types/attendance.types'

export function useAttendance() {
  const qc = useQueryClient()
  const [records, setRecords]     = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const fetchByShiftAndDate = useCallback(async (shiftId: string, date: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // fetchQuery devuelve desde caché si está fresco, o hace fetch
      const data = await qc.fetchQuery({
        queryKey: QK.attendance.byShiftDate(shiftId, date),
        queryFn:  () => attendanceApi.getByShiftAndDate(shiftId, date),
        staleTime: 60_000,
      })
      setRecords(data)
    } catch {
      setError('No se pudo cargar la asistencia')
    } finally {
      setIsLoading(false)
    }
  }, [qc])

  return { records, isLoading, error, fetchByShiftAndDate }
}
