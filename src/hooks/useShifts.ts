import { useState, useEffect, useCallback } from 'react'
import { shiftsApi } from '../api/shifts.api'
import type { Shift } from '../types/shift.types'

export function useShifts() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await shiftsApi.getAll()
      setShifts(data)
    } catch {
      setError('No se pudieron cargar los turnos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { shifts, isLoading, error, refetch: fetch }
}
