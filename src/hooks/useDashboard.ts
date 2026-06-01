import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  dashboardApi,
  type DashboardAlertas,
  type DashboardFinanciero,
  type DashboardClientes,
  type DashboardFacturacion,
  type PuntoHistorico,
} from '../api/dashboard.api'
import { QK } from '../lib/queryKeys'

// ── Hook granular: Alertas ────────────────────────────────────────────────────

export function useDashboardAlertas() {
  const { data, isPending, error, refetch } = useQuery<DashboardAlertas>({
    queryKey: QK.dashboard.alertas(),
    queryFn:  () => dashboardApi.getAlertas(),
    staleTime: 120_000,
  })
  return { data: data ?? null, isLoading: isPending, error: error ? (error as Error).message : null, refetch: () => { refetch() } }
}

// ── Hook granular: Financiero ─────────────────────────────────────────────────

export function useDashboardFinanciero(params?: { desde?: string; hasta?: string }) {
  const { data, isPending, error, refetch } = useQuery<DashboardFinanciero>({
    queryKey: QK.dashboard.financiero(params),
    queryFn:  () => dashboardApi.getFinanciero(params),
    staleTime: 120_000,
  })
  return { data: data ?? null, isLoading: isPending, error: error ? (error as Error).message : null, refetch: () => { refetch() } }
}

// ── Hook granular: Clientes ───────────────────────────────────────────────────

export function useDashboardClientes() {
  const { data, isPending, error, refetch } = useQuery<DashboardClientes>({
    queryKey: QK.dashboard.clientes(),
    queryFn:  () => dashboardApi.getClientes(),
    staleTime: 300_000,
  })
  return { data: data ?? null, isLoading: isPending, error: error ? (error as Error).message : null, refetch: () => { refetch() } }
}

// ── Hook granular: Facturación ────────────────────────────────────────────────

export function useDashboardFacturacion(params?: { desde?: string; hasta?: string }) {
  const { data, isPending, error, refetch } = useQuery<DashboardFacturacion>({
    queryKey: QK.dashboard.facturacion(params),
    queryFn:  () => dashboardApi.getFacturacion(params),
    staleTime: 120_000,
  })
  return { data: data ?? null, isLoading: isPending, error: error ? (error as Error).message : null, refetch: () => { refetch() } }
}

// ── Hook granular: Histórico ──────────────────────────────────────────────────

export function useDashboardHistorico(meses = 24) {
  const { data, isPending, error, refetch } = useQuery<PuntoHistorico[]>({
    queryKey: QK.dashboard.historico(meses),
    queryFn:  () => dashboardApi.getHistorico(meses),
    staleTime: 300_000,
  })
  return { data: data ?? [], isLoading: isPending, error: error ? (error as Error).message : null, refetch: () => { refetch() } }
}

// ── Hook compuesto — invalida todas las secciones del dashboard ───────────────

export function useDashboardRefetch() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

// ── Hook legacy (backward compat) ────────────────────────────────────────────

export function useDashboard(params?: { from?: string; to?: string; historicoMeses?: number }) {
  const alertas     = useDashboardAlertas()
  const financiero  = useDashboardFinanciero({ desde: params?.from, hasta: params?.to })
  const clientes    = useDashboardClientes()
  const facturacion = useDashboardFacturacion({ desde: params?.from, hasta: params?.to })
  const historico   = useDashboardHistorico(params?.historicoMeses ?? 24)

  const isLoading = alertas.isLoading || financiero.isLoading || clientes.isLoading || facturacion.isLoading || historico.isLoading
  const error     = alertas.error ?? financiero.error ?? clientes.error ?? facturacion.error ?? historico.error ?? null

  const qc = useQueryClient()
  const refetch = () => { qc.invalidateQueries({ queryKey: ['dashboard'] }) }

  return { alertas, financiero, clientes, facturacion, historico, isLoading, error, refetch }
}
