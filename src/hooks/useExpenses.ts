import { useState, useEffect, useCallback } from 'react'
import { expensesApi } from '../api/expenses.api'
import type { Expense } from '../types/expense.types'

export function useExpenses(params?: { month?: string; category?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await expensesApi.getAll(params)
      setExpenses(data)
    } catch {
      setError('No se pudieron cargar los gastos')
    } finally {
      setIsLoading(false)
    }
  }, [params?.month, params?.category])

  useEffect(() => { fetch() }, [fetch])

  return { expenses, isLoading, error, refetch: fetch }
}
