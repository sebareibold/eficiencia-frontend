import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  TrendingUp, TrendingDown, Users, DollarSign, RefreshCw,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import Skeleton from '../components/ui/Skeleton'
import KpiCard from '../components/ui/KpiCard'
import { formatCurrency } from '../utils/formatCurrency'


const CHART_COLORS = {
  income: '#F5C842',
  expenses: '#EF4444',
  profit: '#22C55E',
}

export default function DashboardPage() {
  const today = new Date()
  const [fromDate] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'))
  const [toDate] = useState(format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd'))

  const { stats, isLoading, error, refetch } = useDashboard({ from: fromDate, to: toDate })

  const combinedMonthly = useMemo(() => {
    if (!stats) return []
    return stats.incomeByMonth.map((point, i) => ({
      month: point.month,
      Ingresos: point.amount,
      Gastos: stats.expensesByMonth[i]?.amount ?? 0,
      Ganancia: point.amount - (stats.expensesByMonth[i]?.amount ?? 0),
    }))
  }, [stats])

  const kpiCards = stats ? [
    {
      label: 'Clientes activos',
      value: stats.activeClients,
      format: (v: number) => String(v),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      sub: `+${stats.newClients} nuevos este mes`,
      subColor: 'text-green-400',
      previous: null,
    },
    {
      label: 'Ingresos del mes',
      value: stats.totalIncome,
      format: formatCurrency,
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      previous: stats.previousIncome,
    },
    {
      label: 'Gastos del mes',
      value: stats.totalExpenses,
      format: formatCurrency,
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      previous: stats.previousExpenses,
    },
    {
      label: 'Ganancia neta',
      value: stats.netProfit,
      format: formatCurrency,
      icon: DollarSign,
      color: stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400',
      bgColor: stats.netProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
      previous: stats.previousProfit,
    },
  ] : []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <motion.div
      {...pageVariants}
      className="space-y-8 pb-12"
    >
      {/* Hyper-Modern Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
            Vista General
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-xl px-5 py-4 text-sm font-bold text-red-500 shadow-sm">
          {error}
        </div>
      )}


      {/* BENTO GRID LAYOUT */}
      <div className="relative z-10 flex flex-col gap-6">
        
        {/* TOP ROW: KPI Micro-Bento */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {kpiCards.map(card => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.format(card.value)}
              icon={card.icon}
              iconColor={card.color}
              iconBg={card.bgColor}
              sub={card.sub}
              subColor={card.subColor}
            />
          ))}
        </div>

        {/* BOTTOM ROW: Charts */}
        {stats && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Area Chart: Evolución Mensual (8 cols) */}
            {combinedMonthly.length > 0 && (
              <div
                className="xl:col-span-8 relative rounded-[2.5rem] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 border border-white/50 dark:border-white/10 flex flex-col"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">Rendimiento Histórico</h3>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">Ingresos vs Gastos de los últimos 6 meses</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#FBC608] inline-block" />Ingresos</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#EF4444] inline-block" />Gastos</span>
                  </div>
                </div>
                <div className="flex-1 min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={combinedMonthly} margin={{ top: 10, right: 12, left: 8, bottom: 24 }}>
                      <defs>
                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FBC608" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#FBC608" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'rgba(17, 24, 39, 0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, color: '#FFFFFF', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)', padding: '12px 16px' }}
                        itemStyle={{ fontWeight: '900', padding: '3px 0' }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Area type="monotone" dataKey="Ingresos" stroke="#FBC608" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" activeDot={{ r: 7, strokeWidth: 0, fill: '#FBC608' }} />
                      <Area type="monotone" dataKey="Gastos" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGastos)" activeDot={{ r: 5, strokeWidth: 0, fill: '#EF4444' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Methods Breakdown (4 cols) */}
            <div
              className="xl:col-span-4 rounded-[2.5rem] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 border border-white/50 dark:border-white/10 flex flex-col"
            >
              <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Métodos de Pago</h3>
              <div className="flex-1 min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.incomeByMethod} margin={{ top: 5, right: 12, left: 8, bottom: 40 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.05} vertical={false} horizontal={false} />
                    <XAxis
                      dataKey="method"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                      angle={-18}
                      textAnchor="end"
                      dy={6}
                    />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.06)', radius: 8 }}
                      contentStyle={{ background: 'rgba(17, 24, 39, 0.9)', backdropFilter: 'blur(16px)', border: 'none', borderRadius: 14, color: '#FFFFFF', padding: '12px 16px' }}
                      itemStyle={{ color: '#FBC608', fontWeight: '900' }}
                      formatter={(v: number) => [formatCurrency(v), 'Total']}
                    />
                    <Bar dataKey="amount" fill="#FBC608" radius={[6, 6, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}
      </div>
    </motion.div>
  )
}
