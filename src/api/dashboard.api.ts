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

// ── Tipos granulares (nuevos endpoints) ──────────────────────────────────────

export interface DashboardAlertas {
  membresiasPorVencer: { en7dias: number; en15dias: number; en30dias: number; detalle: unknown[] }
  clientesEnDeuda: number
  clientesActivos: number
  clientesVencidos: number
}

export interface DashboardFinanciero {
  periodo: { desde: string; hasta: string }
  ingresos: { total: number; cantidad: number }
  gastos: { total: number; cantidad: number }
  gananciaNeta: number
  ingresosPorMetodo: PorMetodo[]
  gastosPorCategoria: PorCategoria[]
}

export interface DashboardClientes {
  distribucion: { activos: number; enDeuda: number; vencidos: number; total: number }
  clientesPorPlan: PorPlan[]
  clientesPorModalidad: PorModalidad[]
}

export interface DashboardFacturacion {
  periodo: { desde: string; hasta: string }
  facturacion: { facturado: number; sinFacturar: number; total: number; porcentajeFact: number }
}

export interface DashboardOperativo {
  turnos: unknown[]
  turnosMasOcupados: unknown[]
}

// ── Tipo completo (agregado) ──────────────────────────────────────────────────

export interface DashboardStats {
  totalIngresos: number
  totalGastos: number
  gananciaNeta: number
  facturacion: { facturado: number; sinFacturar: number; total: number }
  ingresosPorMetodo: PorMetodo[]
  gastosPorCategoria: PorCategoria[]
  clientes: { activos: number; enDeuda: number; vencidos: number; total: number }
  clientesPorPlan: PorPlan[]
  clientesPorModalidad: PorModalidad[]
  membresiasPorVencer: { en7dias: number; en15dias: number; en30dias: number }
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultRango() {
  const hoy = new Date()
  return {
    desde: toYMD(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: toYMD(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
  }
}

// ── API — endpoints granulares ────────────────────────────────────────────────

export const dashboardApi = {
  /** Alertas operativas (membresías por vencer, clientes en deuda) */
  getAlertas: async (): Promise<DashboardAlertas> => {
    const { data } = await api.get('/dashboard/alertas')
    return data
  },

  /** Financiero del período: ingresos, gastos, desglose */
  getFinanciero: async (params?: { desde?: string; hasta?: string }): Promise<DashboardFinanciero> => {
    const rango = params ?? defaultRango()
    const { data } = await api.get('/dashboard/financiero', { params: rango })
    return {
      ...data,
      ingresosPorMetodo: (data.ingresosPorMetodo ?? []).map((m: PorMetodo) => ({
        ...m,
        metodo: METODO_LABELS[m.metodo] ?? m.metodo,
      })),
      gastosPorCategoria: (data.gastosPorCategoria ?? []).map((g: PorCategoria) => ({
        ...g,
        categoria: CATEGORIA_LABELS[g.categoria] ?? g.categoria,
      })),
    }
  },

  /** Distribución de clientes por estado, plan y modalidad */
  getClientes: async (): Promise<DashboardClientes> => {
    const { data } = await api.get('/dashboard/clientes')
    return {
      ...data,
      clientesPorModalidad: (data.clientesPorModalidad ?? []).map((m: PorModalidad) => ({
        ...m,
        modalidad: MODALIDAD_LABELS_SHORT[m.modalidad] ?? m.modalidad,
      })),
    }
  },

  /** Facturación del período: facturado vs sin facturar */
  getFacturacion: async (params?: { desde?: string; hasta?: string }): Promise<DashboardFacturacion> => {
    const rango = params ?? defaultRango()
    const { data } = await api.get('/dashboard/facturacion', { params: rango })
    return data
  },

  /** Turnos con ocupación en tiempo real */
  getOperativo: async (): Promise<DashboardOperativo> => {
    const { data } = await api.get('/dashboard/operativo')
    return data
  },

  /** Histórico mensual */
  getHistorico: async (meses = 12): Promise<PuntoHistorico[]> => {
    const { data } = await api.get('/dashboard/historico', { params: { meses } })
    return Array.isArray(data) ? data : []
  },

  /** [Legacy] Todos los datos en una llamada — usar los métodos granulares cuando sea posible */
  getStats: async (params?: { from?: string; to?: string; historicoMeses?: number }): Promise<DashboardStats> => {
    const hoy   = new Date()
    const desde = params?.from ?? toYMD(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    const hasta = params?.to   ?? toYMD(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
    const meses = params?.historicoMeses ?? 12

    const [alertas, financiero, clientesStats, facturacion, historico] = await Promise.allSettled([
      dashboardApi.getAlertas(),
      dashboardApi.getFinanciero({ desde, hasta }),
      dashboardApi.getClientes(),
      dashboardApi.getFacturacion({ desde, hasta }),
      dashboardApi.getHistorico(meses),
    ])

    const a = alertas.status     === 'fulfilled' ? alertas.value     : null
    const f = financiero.status  === 'fulfilled' ? financiero.value  : null
    const c = clientesStats.status === 'fulfilled' ? clientesStats.value : null
    const fc = facturacion.status === 'fulfilled' ? facturacion.value : null
    const h  = historico.status  === 'fulfilled' ? historico.value   : []

    return {
      totalIngresos:       f?.ingresos?.total       ?? 0,
      totalGastos:         f?.gastos?.total          ?? 0,
      gananciaNeta:        f?.gananciaNeta           ?? 0,
      facturacion:         fc?.facturacion ?? { facturado: 0, sinFacturar: 0, total: 0 },
      ingresosPorMetodo:   f?.ingresosPorMetodo      ?? [],
      gastosPorCategoria:  f?.gastosPorCategoria     ?? [],
      clientes:            c?.distribucion ?? { activos: 0, enDeuda: 0, vencidos: 0, total: 0 },
      clientesPorPlan:     c?.clientesPorPlan        ?? [],
      clientesPorModalidad: c?.clientesPorModalidad  ?? [],
      membresiasPorVencer: a?.membresiasPorVencer ?? { en7dias: 0, en15dias: 0, en30dias: 0 },
      historico: h,
    }
  },
}
