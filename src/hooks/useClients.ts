import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '../api/clients.api'
import { QK } from '../lib/queryKeys'

interface UseClientsParams {
  search?: string
  estado?: string
  estadoPago?: string
  limit?: number
  desde?: string
  hasta?: string
}

export function useClients(params?: UseClientsParams) {
  const [currentPage, setCurrentPage] = useState(1)

  const queryParams = {
    page:   currentPage,
    limit:  params?.limit ?? 10,
    ...(params?.search     && { search:     params.search }),
    ...(params?.estado     && { estado:     params.estado }),
    ...(params?.estadoPago && { estadoPago: params.estadoPago }),
    ...(params?.desde      && { desde:      params.desde }),
    ...(params?.hasta      && { hasta:      params.hasta }),
  }

  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.clients.all(queryParams),
    queryFn:  () => clientsApi.getAll(queryParams),
    staleTime: 30_000,
  })

  return {
    clients:    data?.data       ?? [],
    total:      data?.total      ?? 0,
    totalPages: data?.totalPages ?? 0,
    currentPage,
    goToPage:   (p: number) => setCurrentPage(p),
    isLoading:  isPending,
    error:      error ? (error as Error).message : null,
    refetch:    () => { refetch() },
  }
}
