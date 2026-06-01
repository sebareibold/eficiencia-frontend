import { useQuery } from '@tanstack/react-query'
import { expensesApi } from '../api/expenses.api'
import { QK } from '../lib/queryKeys'

export function useExpenses(params?: { month?: string; category?: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.expenses.all(params),
    queryFn:  () => expensesApi.getAll(params),
    staleTime: 30_000,
  })

  return {
    expenses:  data ?? [],
    isLoading: isPending,
    error:     error ? (error as Error).message : null,
    refetch:   () => { refetch() },
  }
}
