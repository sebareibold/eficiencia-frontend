import api from './axiosInstance'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PuntoHistorico {
  mes: string
  label: string
  ingresos: number
  gastos: number
  gananciaNeta: number
}

export interface PorMetodo {
  metodo: string
  total: number
  cantidad: number
}

export interface PorCategoria {
  categoria: string
  total: number
  cantidad: number
}

export interface PorPlan {
  nombre: string
  frecuenciaSemanal: number
  cantidad: number
}

export interface PorModalidad {
  modalidad: string
  cantidad: number
}

export interface DashboardStats {
  // Financiero del período
  totalIngresos: number
  totalGastos: number
  gananciaNeta: number
  facturacion: { facturado: number; sinFacturar: number; total: number }
  // Desglose
  ingresosPorMetodo: PorMetodo[]
  gastosPorCategoria: PorCategoria[]
  // Clientes
  clientes: { activos: number; enDeuda: number; vencidos: number; total: number }
  clientesPorPlan: PorPlan[]
  clientesPorModalidad: PorModalidad[]
  // Alertas operativas
  membresiasPorVencer: { en7dias: number; en15dias: number; en30dias: number }
  // Histórico
  historico: PuntoHistorico[]
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const METODO_LABELS: Record<string, string> = {
  EFECTIVO:             'Efectivo',
  TRANSFERENCIA:        'Transferencia',
  DEBITO:               'Débito',
  EMPRESA:              'Empresa',
}

export const MODALIDAD_LABELS_SHORT: Record<string, string> = {
  TRANSFERENCIA_MENSUAL: 'Transf. mensual',
  EFECTIVO:              'Efectivo',
  MEMBRESIA_3_MESES:     'Memb. 3 meses',
  MEMBRESIA_6_MESES:     'Memb. 6 meses',
}

export const CATEGORIA_LABELS: Record<string, string> = {
  SUELDO:   'Sueldos',
  FIJO:     'Gastos fijos',
  VARIABLE: 'Variables',
}

// ── API ───────────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const dashboardApi = {
  getStats: async (params?: { from?: string; to?: string; historicoMeses?: number }): Promise<DashboardStats> => {
    const hoy = new Date()
    const desde = params?.from ?? toYMD(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    const hasta  = params?.to   ?? toYMD(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
    const meses  = params?.historicoMeses ?? 12

    const [resumenRes, historicoRes] = await Promise.allSettled([
      api.get('/dashboard/resumen', { params: { desde, hasta } }),
      api.get('/dashboard/historico', { params: { meses } }),
    ])

    const r = resumenRes.status === 'fulfilled' ? resumenRes.value.data : {}
    const h = historicoRes.status === 'fulfilled' ? historicoRes.value.data : []

    return {
      totalIngresos:       Number(r.ingresos?.total ?? 0),
      totalGastos:         Number(r.gastos?.total   ?? 0),
      gananciaNeta:        Number(r.gananciaNeta     ?? 0),
      facturacion:         r.facturacion ?? { facturado: 0, sinFacturar: 0, total: 0 },
      ingresosPorMetodo:   (r.ingresosPorMetodo ?? []).map((m: any) => ({
        metodo:   METODO_LABELS[m.metodo] ?? m.metodo,
        total:    Number(m.total),
        cantidad: m.cantidad,
      })),
      gastosPorCategoria:  (r.gastosPorCategoria ?? []).map((g: any) => ({
        categoria: CATEGORIA_LABELS[g.categoria] ?? g.categoria,
        total:     Number(g.total),
        cantidad:  g.cantidad,
      })),
      clientes:            r.clientes ?? { activos: 0, enDeuda: 0, vencidos: 0, total: 0 },
      clientesPorPlan:     r.clientesPorPlan ?? [],
      clientesPorModalidad: (r.clientesPorModalidad ?? []).map((m: any) => ({
        modalidad: MODALIDAD_LABELS_SHORT[m.modalidad] ?? m.modalidad,
        cantidad:  m.cantidad,
      })),
      membresiasPorVencer: r.membresiasPorVencer ?? { en7dias: 0, en15dias: 0, en30dias: 0 },
      historico:           Array.isArray(h) ? h : [],
    }
  },
}
