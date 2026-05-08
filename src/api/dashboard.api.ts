import api from './axiosInstance'

export interface MonthlyPoint {
  month: string
  amount: number
}

export interface PaymentMethodPoint {
  method: string
  amount: number
  count?: number
}

export interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  previousIncome: number
  previousExpenses: number
  previousProfit: number
  activeClients: number
  newClients: number
  expiringClients: number
  debtClients: number
  incomeByMonth: MonthlyPoint[]
  expensesByMonth: MonthlyPoint[]
  incomeByMethod: PaymentMethodPoint[]
}

// ─── Helpers de fechas ────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prevMonthRange(): { desde: string; hasta: string } {
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const last  = new Date(today.getFullYear(), today.getMonth(), 0)
  return { desde: toYMD(first), hasta: toYMD(last) }
}

function last6MonthRanges() {
  const today = new Date()
  const LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return Array.from({ length: 6 }, (_, i) => {
    const first = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1)
    const last  = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    return { desde: toYMD(first), hasta: toYMD(last), label: LABELS[first.getMonth()] }
  })
}

// ─── Mapper del endpoint /dashboard/resumen ───────────────────────────────────

function mapResumen(d: any) {
  return {
    totalIncome:    Number(d.ingresos?.total  ?? 0),
    totalExpenses:  Number(d.gastos?.total    ?? 0),
    netProfit:      Number(d.gananciaNeta     ?? 0),
    activeClients:  Number(d.clientes?.activos  ?? 0),
    expiringClients: Number(d.clientes?.vencidos ?? 0),
    debtClients:    Number(d.clientes?.enDeuda  ?? 0),
  }
}

// ─── Etiquetas de métodos de pago ─────────────────────────────────────────────

const METODO_LABELS: Record<string, string> = {
  EFECTIVO:      'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO:        'Débito',
  EMPRESA:       'Empresa',
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: async (params?: { from?: string; to?: string }): Promise<DashboardStats> => {
    const today = new Date()
    const currentFrom = params?.from ?? toYMD(new Date(today.getFullYear(), today.getMonth(), 1))
    const currentTo   = params?.to   ?? toYMD(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    const prev   = prevMonthRange()
    const months = last6MonthRanges()

    // 9 llamadas paralelas con allSettled para que un fallo parcial no rompa todo
    const [currentRes, previousRes, pagosRes, ...monthlyRes] = await Promise.allSettled([
      api.get('/dashboard/resumen', { params: { desde: currentFrom, hasta: currentTo } }),
      api.get('/dashboard/resumen', { params: { desde: prev.desde,  hasta: prev.hasta  } }),
      api.get('/pagos',             { params: { desde: currentFrom, hasta: currentTo   } }),
      ...months.map(m =>
        api.get('/dashboard/resumen', { params: { desde: m.desde, hasta: m.hasta } })
      ),
    ])

    // ─── Resumen actual y anterior ────────────────────────────────────────────
    const current  = currentRes.status  === 'fulfilled' ? mapResumen(currentRes.value.data)  : mapResumen({})
    const previous = previousRes.status === 'fulfilled' ? mapResumen(previousRes.value.data) : mapResumen({})

    // ─── Desglose por método de pago ──────────────────────────────────────────
    const pagosRaw  = pagosRes.status === 'fulfilled' ? pagosRes.value.data : []
    const pagosArr: any[] = Array.isArray(pagosRaw) ? pagosRaw : (pagosRaw?.data ?? [])

    const methodMap: Record<string, { amount: number; count: number }> = {}
    pagosArr.forEach((p: any) => {
      const key = String(p.metodo ?? 'OTRO')
      if (!methodMap[key]) methodMap[key] = { amount: 0, count: 0 }
      methodMap[key].amount += Number(p.monto ?? 0)
      methodMap[key].count  += 1
    })
    const incomeByMethod: PaymentMethodPoint[] = Object.entries(methodMap)
      .map(([key, val]) => ({ method: METODO_LABELS[key] ?? key, amount: val.amount, count: val.count }))
      .sort((a, b) => b.amount - a.amount)

    // ─── Histórico mensual (últimos 6 meses) ──────────────────────────────────
    const incomeByMonth:   MonthlyPoint[] = []
    const expensesByMonth: MonthlyPoint[] = []
    monthlyRes.forEach((result, i) => {
      const label = months[i].label
      if (result.status === 'fulfilled') {
        const d = result.value.data
        incomeByMonth.push  ({ month: label, amount: Number(d.ingresos?.total ?? 0) })
        expensesByMonth.push({ month: label, amount: Number(d.gastos?.total   ?? 0) })
      } else {
        incomeByMonth.push  ({ month: label, amount: 0 })
        expensesByMonth.push({ month: label, amount: 0 })
      }
    })

    return {
      totalIncome:      current.totalIncome,
      totalExpenses:    current.totalExpenses,
      netProfit:        current.netProfit,
      previousIncome:   previous.totalIncome,
      previousExpenses: previous.totalExpenses,
      previousProfit:   previous.netProfit,
      activeClients:    current.activeClients,
      newClients:       0,
      expiringClients:  current.expiringClients,
      debtClients:      current.debtClients,
      incomeByMonth,
      expensesByMonth,
      incomeByMethod,
    }
  },
}
