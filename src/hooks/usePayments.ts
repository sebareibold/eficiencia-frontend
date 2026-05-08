import { useState, useEffect, useCallback } from 'react'
import { paymentsApi } from '../api/payments.api'
import type { Payment } from '../types/payment.types'

export function usePayments(params?: { month?: string; anio?: string; desde?: string; hasta?: string; clientId?: number }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await paymentsApi.getAll(params)
      setPayments(data)
    } catch {
      setError('No se pudieron cargar los pagos')
    } finally {
      setIsLoading(false)
    }
  }, [params?.month, params?.anio, params?.desde, params?.hasta, params?.clientId])

  useEffect(() => { fetch() }, [fetch])

  return { payments, isLoading, error, refetch: fetch }
}
