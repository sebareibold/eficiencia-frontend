import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 s: datos considerados frescos sin re-fetch
      gcTime:    5 * 60_000,    // 5 min: mantiene caché tras desmontar
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
