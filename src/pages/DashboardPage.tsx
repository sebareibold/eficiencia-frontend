import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../utils/formatCurrency'
import type { DashboardStats } from '../api/dashboard.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  change?: number
  icon: React.ElementType
  iconBg: string
  iconColor: string
  isLoading?: boolean
}

function StatCard({ label, value, change, icon: Icon, iconBg, iconColor, isLoading }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0
  const hasChange = change !== undefined

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-xl bg-gray-100" />
          <div className="h-5 w-16 rounded-full bg-gray-100" />
        </div>
        <div className="space-y-1.5">
          <div className="h-7 w-32 rounded-lg bg-gray-100" />
          <div className="h-4 w-20 rounded bg-gray-100" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={iconColor} strokeWidth={2} />
        </div>
        {hasChange && (
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
              isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            }`}
          >
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(change!).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs font-medium text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-3 min-w-[160px]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-500">{entry.name}</span>
          </div>
          <span className="text-xs font-bold text-gray-900">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function MethodTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2">
      <span className="text-xs font-bold text-gray-900">{formatCurrency(payload[0].value)}</span>
    </div>
  )
}

// ─── Area Chart ───────────────────────────────────────────────────────────────

function IncomeExpensesChart({ stats, isLoading }: { stats: DashboardStats | null; isLoading: boolean }) {
  const chartData = (stats?.incomeByMonth ?? []).map((item) => {
    const exp = stats?.expensesByMonth?.find((e) => e.month === item.month)
    return { month: item.month, Ingresos: item.amount, Gastos: exp?.amount ?? 0 }
  })

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Ingresos y Gastos</h3>
          <p className="text-xs text-gray-400 mt-0.5">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[10px] font-medium text-gray-500">Ingresos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-[10px] font-medium text-gray-500">Gastos</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5A623" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="Ingresos"
              stroke="#F5A623"
              strokeWidth={2.5}
              fill="url(#incomeGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#F5A623', stroke: '#fff', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="Gastos"
              stroke="#f87171"
              strokeWidth={2.5}
              fill="url(#expensesGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#f87171', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Client Status ────────────────────────────────────────────────────────────

function ClientStatusCard({ stats, isLoading }: { stats: DashboardStats | null; isLoading: boolean }) {
  const total =
    (stats?.activeClients ?? 0) + (stats?.expiringClients ?? 0) + (stats?.debtClients ?? 0)

  const items = [
    { label: 'Activos', value: stats?.activeClients ?? 0, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500' },
    { label: 'Nuevos este mes', value: stats?.newClients ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-400' },
    { label: 'Por vencer', value: stats?.expiringClients ?? 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-400' },
    { label: 'Con deuda', value: stats?.debtClients ?? 0, icon: UserX, color: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-500' },
  ]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Estado de Clientes</h3>
        <p className="text-xs text-gray-400 mt-0.5">Distribución actual</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(({ label, value, icon: Icon, color, bg, bar }) => {
            const pct = total ? Math.round((value / total) * 100) : 0
            return (
              <div key={label} className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={14} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{label}</span>
                    <span className="text-xs font-bold text-gray-900">{value}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Payment Methods Chart ────────────────────────────────────────────────────

function PaymentMethodChart({ stats, isLoading }: { stats: DashboardStats | null; isLoading: boolean }) {
  const data = (stats?.incomeByMethod ?? []).map((item) => ({
    name: item.method,
    Monto: item.amount,
  }))
  const total = stats?.incomeByMethod?.reduce((s, i) => s + i.amount, 0) ?? 0

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Métodos de Pago</h3>
        <p className="text-xs text-gray-400 mt-0.5">Distribución del período</p>
      </div>

      {isLoading ? (
        <div className="h-36 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<MethodTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="Monto" fill="#F5A623" radius={[0, 6, 6, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
            {stats?.incomeByMethod?.map((item) => (
              <div key={item.method} className="flex-1 text-center">
                <p className="text-xs font-bold text-gray-900">{Math.round((item.amount / total) * 100)}%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.method}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Comparison Chart ─────────────────────────────────────────────────────────

function ComparisonCard({ stats, isLoading }: { stats: DashboardStats | null; isLoading: boolean }) {
  const compData = [
    { name: 'Ingresos', Actual: stats?.totalIncome ?? 0, Anterior: stats?.previousIncome ?? 0 },
    { name: 'Gastos', Actual: stats?.totalExpenses ?? 0, Anterior: stats?.previousExpenses ?? 0 },
    { name: 'Ganancia', Actual: stats?.netProfit ?? 0, Anterior: stats?.previousProfit ?? 0 },
  ]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Comparación de Períodos</h3>
          <p className="text-xs text-gray-400 mt-0.5">Actual vs mes anterior</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[10px] font-medium text-gray-500">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="text-[10px] font-medium text-gray-500">Anterior</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-36 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={compData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="Actual" fill="#F5A623" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Anterior" fill="#d1d5db" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { dashboard: dashSettings } = useSettingsStore()
  const { stats, isLoading, isMock, refetch } = useDashboard()
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function handleRefresh() {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const statCards = [
    {
      key: 'revenue',
      show: dashSettings.showRevenue,
      label: 'Ingresos del mes',
      value: formatCurrency(stats?.totalIncome ?? 0),
      change: pctChange(stats?.totalIncome ?? 0, stats?.previousIncome ?? 0),
      icon: DollarSign,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      key: 'expenses',
      show: dashSettings.showExpenses,
      label: 'Gastos del mes',
      value: formatCurrency(stats?.totalExpenses ?? 0),
      change: pctChange(stats?.totalExpenses ?? 0, stats?.previousExpenses ?? 0),
      icon: TrendingDown,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
    {
      key: 'profit',
      show: dashSettings.showProfit,
      label: 'Ganancia neta',
      value: formatCurrency(stats?.netProfit ?? 0),
      change: pctChange(stats?.netProfit ?? 0, stats?.previousProfit ?? 0),
      icon: TrendingUp,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      key: 'clients',
      show: dashSettings.showClients,
      label: 'Clientes activos',
      value: String(stats?.activeClients ?? 0),
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
  ]

  const visibleCards = statCards.filter((c) => c.show)
  const gridCols =
    visibleCards.length >= 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : visibleCards.length === 3
        ? 'grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hola, {user?.name} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen del negocio · Mayo 2026</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:shadow-md transition-all border border-gray-100 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Demo data notice */}
      {isMock && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <p className="text-xs font-medium text-amber-700">
            Mostrando datos de demostración — el backend no está disponible.
          </p>
        </div>
      )}

      {/* Stat Cards */}
      {visibleCards.length > 0 && (
        <div className={`grid ${gridCols} gap-4`}>
          {visibleCards.map((card) => (
            <StatCard key={card.key} {...card} isLoading={isLoading} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <IncomeExpensesChart stats={stats} isLoading={isLoading} />
        </div>
        <ClientStatusCard stats={stats} isLoading={isLoading} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentMethodChart stats={stats} isLoading={isLoading} />
        <ComparisonCard stats={stats} isLoading={isLoading} />
      </div>
    </div>
  )
}
