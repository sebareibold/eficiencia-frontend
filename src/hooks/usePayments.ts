import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '../api/payments.api'
import { QK } from '../lib/queryKeys'

interface UsePaymentsParams {
  month?: string
  anio?: string
  desde?: string
  hasta?: string
  clientId?: number
  pageSize?: number
  method?: 'cash' | 'transfer' | 'card'
  search?: string
}

export function usePayments(params?: UsePaymentsParams) {
  const [currentPage, setCurrentPage] = useState(1)

  const queryParams = { ...params, page: currentPage }

  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.payments.all(queryParams),
    queryFn:  () => paymentsApi.getAll(queryParams),
    staleTime: 30_000,
  })

  return {
    payments:    data?.data       ?? [],
    total:       data?.total      ?? 0,
    totalPages:  data?.totalPages ?? 0,
    currentPage,
    goToPage:    setCurrentPage,
    isLoading:   isPending,
    error:       error ? (error as Error).message : null,
    refetch:     () => { refetch() },
  }
}
