import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Phone, Mail, CalendarDays, CheckCircle2, XCircle,
  Edit2, CreditCard, Activity, Clock, Hash, Banknote, ArrowLeftRight,
  MessageCircle, Tag, Dumbbell, TrendingUp, BookOpen, Plus, ChevronDown,
  BarChart2, PieChart as PieIcon, LineChart as LineChartIcon,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clientsApi } from '../api/clients.api'
import { attendanceApi } from '../api/attendance.api'
import { paymentsApi } from '../api/payments.api'
import { useRutinas } from '../hooks/useRutinas'
import type { Rutina } from '../types/rutina.types'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Skeleton, { SkeletonClientProfile } from '../components/ui/Skeleton'
import { getStatusLabel } from '../utils/getStatusColor'
import { formatDate } from '../utils/formatDate'
import { formatCurrency } from '../utils/formatCurrency'
import type { Client } from '../types/client.types'
import type { Payment } from '../types/payment.types'
import type { AttendanceRecord } from '../types/attendance.types'

// ─── Configuración de métodos de pago ─────────────────────────────────────────
const METHOD_CONFIG: Record<string, { label: string; Icon: typeof Banknote; color: string; bg: string }> = {
  cash:     { label: 'Efectivo',       Icon: Banknote,       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  transfer: { label: 'Transferencia',  Icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10'    },
  card:     { label: 'Débito',         Icon: CreditCard,     color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10'  },
}

// ─── Schema edición ────────────────────────────────────────────────────────────
const editSchema = z.object({
  name:      z.string().min(1, 'Requerido'),
  lastName:  z.string().min(1, 'Requerido'),
  email:     z.string().email('Email inválido').or(z.literal('')),
  phone:     z.string().optional(),
  dni:       z.string().min(1, 'Requerido'),
})
type EditValues = z.infer<typeof editSchema>
type Tab = 'pagos' | 'asistencia' | 'turnos' | 'rutina'

// ─── Helpers visuales ─────────────────────────────────────────────────────────
function avatarColors(status: Client['status']) {
  if (status === 'active')   return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (status === 'expiring') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  if (status === 'debt')     return 'bg-red-500/15 text-red-600 dark:text-red-400'
  return 'bg-gray-200/60 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400'
}

function statusBarColor(status: Client['status']) {
  if (status === 'active')   return 'bg-emerald-500'
  if (status === 'expiring') return 'bg-amber-500'
  if (status === 'debt')     return 'bg-red-500'
  return 'bg-gray-400'
}

function membershipDaysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

// ─── Glassmorphism card ───────────────────────────────────────────────────────
const glassCard = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'


// ─── Chip de contacto ─────────────────────────────────────────────────────────
function ContactChip({ icon: Icon, label, href }: { icon: typeof Mail; label: string; href?: string }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors'
  const content = (
    <>
      <Icon size={11} className="shrink-0 opacity-60" />
      <span className="truncate max-w-[200px]">{label}</span>
    </>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
         className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20`}>
        {content}
        <MessageCircle size={10} className="opacity-50" />
      </a>
    )
  }
  return (
    <span className={`${base} bg-white/[0.05] dark:bg-white/[0.04] text-gray-700 dark:text-gray-400 border-gray-200 dark:border-white/[0.08]`}>
      {content}
    </span>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }: { icon: typeof Tag; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-white/50 dark:border-white/[0.08]">
        <Icon size={20} className="text-gray-400 dark:text-[#8A8A9A]" />
      </div>
      <p className="text-sm text-gray-500 dark:text-[#8A8A9A]">{message}</p>
    </div>
  )
}

// ─── Tab de asistencias ───────────────────────────────────────────────────────
type ChartView = 'resumen' | 'mensual' | 'historial'

function AttendanceTabContent({ attendance }: { attendance: AttendanceRecord[] }) {
  const [chartView, setChartView] = useState<ChartView>('resumen')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'presentes' | 'ausentes'>('todos')
  const [filterMonth, setFilterMonth] = useState('todos')

  const presentCount = attendance.filter(a => a.present).length
  const absentCount = attendance.length - presentCount
  const pct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0

  const pieData = [
    { name: 'Presente', value: presentCount, color: '#10B981' },
    { name: 'Ausente',  value: absentCount,  color: '#EF4444' },
  ]

  const monthlyData = useMemo(() => {
    const map = new Map<string, { mes: string; presentes: number; ausentes: number }>()
    attendance.forEach(a => {
      const key = a.date.slice(0, 7)
      if (!map.has(key)) {
        map.set(key, { mes: format(parseISO(a.date), 'MMM yy', { locale: es }), presentes: 0, ausentes: 0 })
      }
      const cur = map.get(key)!
      if (a.present) cur.presentes++
      else cur.ausentes++
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [attendance])

  const historialData = useMemo(() => {
    const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date))
    let cum = 0
    return sorted.map(a => {
      if (a.present) cum++
      return { fecha: format(parseISO(a.date), 'dd/MM'), asistencias: cum }
    })
  }, [attendance])

  const availableMonths = useMemo(() => {
    const s = new Set(attendance.map(a => a.date.slice(0, 7)))
    return ['todos', ...Array.from(s).sort().reverse()]
  }, [attendance])

  const filtered = useMemo(() =>
    attendance
      .filter(a => {
        const okStatus = filterStatus === 'todos' || (filterStatus === 'presentes' ? a.present : !a.present)
        const okMonth = filterMonth === 'todos' || a.date.startsWith(filterMonth)
        return okStatus && okMonth
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, filterStatus, filterMonth]
  )

  const CHART_VIEWS: { value: ChartView; Icon: typeof BarChart2; label: string }[] = [
    { value: 'resumen',  Icon: PieIcon,        label: 'Resumen'  },
    { value: 'mensual',  Icon: BarChart2,       label: 'Por mes'  },
    { value: 'historial',Icon: LineChartIcon,   label: 'Historial'},
  ]

  return (
    <div>
      {/* Stats strip */}
      <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
        {[
          { label: 'Total',      value: attendance.length, color: 'text-white'       },
          { label: 'Presentes',  value: presentCount,      color: 'text-emerald-400' },
          { label: 'Ausentes',   value: absentCount,       color: 'text-red-400'     },
          { label: 'Asistencia', value: `${pct}%`,         color: 'text-primary'     },
        ].map(s => (
          <div key={s.label} className="py-4 text-center">
            <p className={`text-xl md:text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart toggle */}
      <div className="flex gap-1 p-3 border-b border-white/[0.06]">
        {CHART_VIEWS.map(({ value, Icon, label }) => (
          <button
            key={value}
            onClick={() => setChartView(value)}
            className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl transition-all ${
              chartView === value ? 'bg-white/[0.09] text-white' : 'text-[#8A8A9A] hover:text-white'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="px-2 py-4 border-b border-white/[0.06]">
        {chartView === 'resumen' && (
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={54} outerRadius={78}
                  dataKey="value"
                  paddingAngle={4}
                  strokeWidth={0}
                >
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v} días`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-black text-white">{pct}%</p>
                <p className="text-[10px] text-[#8A8A9A] uppercase tracking-wider">asistencia</p>
              </div>
            </div>
            <div className="flex justify-center gap-5 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-[#8A8A9A]">Presente ({presentCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-xs text-[#8A8A9A]">Ausente ({absentCount})</span>
              </div>
            </div>
          </div>
        )}

        {chartView === 'mensual' && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} barSize={12} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#8A8A9A', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8A8A9A', fontSize: 11 }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="presentes" name="Presentes" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ausentes"  name="Ausentes"  fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartView === 'historial' && (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={historialData} margin={{ left: -10 }}>
              <defs>
                <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FBC608" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FBC608" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: '#8A8A9A', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#8A8A9A', fontSize: 11 }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [v, 'Asistencias acumuladas']}
              />
              <Area
                type="monotone"
                dataKey="asistencias"
                stroke="#FBC608"
                fill="url(#gradHist)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#FBC608' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Filtros de lista */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-white/[0.06]">
        <div className="flex gap-1">
          {([['todos', 'Todos'], ['presentes', 'Presentes'], ['ausentes', 'Ausentes']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === v ? 'bg-white/[0.09] text-white' : 'text-[#8A8A9A] hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="ml-auto text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[#8A8A9A] focus:outline-none focus:border-white/[0.2] cursor-pointer"
        >
          {availableMonths.map(m => (
            <option key={m} value={m} className="bg-[#1A1A1A]">
              {m === 'todos'
                ? 'Todos los meses'
                : format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}
            </option>
          ))}
        </select>
      </div>

      {/* Lista scrolleable */}
      <div className="max-h-60 overflow-y-auto divide-y divide-white/20 dark:divide-white/10">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-[#8A8A9A] py-8">Sin registros para los filtros seleccionados</p>
        ) : filtered.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/50 dark:hover:bg-black/50 transition-colors">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
              a.present ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              {a.present
                ? <CheckCircle2 size={14} className="text-emerald-400" />
                : <XCircle size={14} className="text-red-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {format(parseISO(a.date), "d 'de' MMMM yyyy", { locale: es })}
              </p>
              <p className="text-xs text-[#8A8A9A] truncate">{a.shiftLabel}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              a.present ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {a.present ? 'Presente' : 'Ausente'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [client, setClient]       = useState<Client | null>(null)
  const [payments, setPayments]   = useState<Payment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('rutina')
  const [editOpen, setEditOpen]   = useState(false)
  const [isSaving, setIsSaving]   = useState(false)

  // Rutinas — solo para el resumen en el tab (la edición vive en ClientRutinaPage)
  const { rutinas, isLoading: loadingRutinas } = useRutinas(id)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.allSettled([
      clientsApi.getById(id),
      paymentsApi.getAll({ clientId: id }),
      attendanceApi.getByClient(id),
    ]).then(([clientRes, paymentsRes, attendanceRes]) => {
      if (clientRes.status === 'fulfilled') {
        const c = clientRes.value
        setClient(c)
        reset({ name: c.name, lastName: c.lastName, email: c.email ?? '', phone: c.phone ?? '', dni: c.dni ?? '' })
      } else {
        addToast('Error al cargar el perfil', 'error')
      }
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value)
      if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value)
    }).finally(() => setLoading(false))
  }, [id])

  async function onEdit(data: EditValues) {
    if (!client) return
    setIsSaving(true)
    try {
      const updated = await clientsApi.update(client.id, {
        name: data.name, lastName: data.lastName,
        email: data.email ?? '', phone: data.phone ?? '', dni: data.dni,
      })
      setClient(updated)
      addToast('Cliente actualizado', 'success')
      setEditOpen(false)
    } catch {
      addToast('Error al actualizar el cliente', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Datos derivados ────────────────────────────────────────────────────────
  const totalPaid   = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments])
  const presentDays = useMemo(() => attendance.filter(a => a.present).length, [attendance])
  const lastVisit   = useMemo(() => {
    const sorted = attendance.filter(a => a.present).sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.date ?? null
  }, [attendance])

  const shiftStats = useMemo(() => {
    const map = new Map<string | number, { present: number; total: number; lastDate: string }>()
    attendance.forEach(a => {
      const cur = map.get(a.shiftId) ?? { present: 0, total: 0, lastDate: '' }
      map.set(a.shiftId, {
        total: cur.total + 1,
        present: cur.present + (a.present ? 1 : 0),
        lastDate: a.date > cur.lastDate ? a.date : cur.lastDate,
      })
    })
    return Array.from(map.entries())
      .map(([shiftId, s]) => ({ shiftId, ...s }))
      .sort((a, b) => b.present - a.present)
  }, [attendance])

  // ─── Loading state — skeleton dentro de los cards, sin reemplazar el exterior ──
  if (loading) return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 md:space-y-5"
    >
      <div className="h-5 w-20 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] animate-pulse" />
      <div className={`${glassCard} overflow-hidden`}>
        <div className="h-1 w-full bg-black/[0.06] dark:bg-white/[0.06]" />
        <div className="p-5 md:p-7">
          <div className="flex gap-5">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-8 w-52 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
              <div className="h-4 w-36 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
              <div className="flex gap-2 pt-1">
                {[80, 96, 72].map((w, i) => (
                  <div key={i} className="h-7 rounded-full bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" style={{ width: w }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className={`${glassCard} p-4 flex items-center gap-3`}>
            <div className="h-10 w-10 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-16 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
              <div className="h-3 w-14 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07]">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
          ))}
        </div>
        <div className={`${glassCard} overflow-hidden p-8 space-y-4`}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 w-full rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
    </motion.div>
  )

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-[#8A8A9A]">
        <p className="text-sm">Cliente no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft size={15} /> Volver
        </Button>
      </div>
    )
  }

  const initials       = `${client.name.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase()
  const daysLeft       = membershipDaysLeft(client.membershipExpiresAt)
  const expiryColor    = daysLeft === null ? '' : daysLeft <= 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'
  const progressPct    = (() => {
    if (!client.membershipStartDate || !client.membershipExpiresAt) return 0
    const total = new Date(client.membershipExpiresAt).getTime() - new Date(client.membershipStartDate).getTime()
    const elapsed = Date.now() - new Date(client.membershipStartDate).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()
  const progressColor  = daysLeft === null ? 'bg-gray-400' : daysLeft <= 0 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-amber-500' : 'bg-emerald-500'

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: 'rutina',     label: 'Rutina',     count: rutinas.length       },
    { value: 'turnos',     label: 'Turnos',     count: shiftStats.length    },
    { value: 'asistencia', label: 'Asistencia', count: presentDays          },
    { value: 'pagos',      label: 'Pagos',      count: payments.length      },
  ]


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 md:space-y-5"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/clients')}
        className="group flex items-center gap-2 text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Clientes</span>
      </button>

      {/* ── HERO CARD ───────────────────────────────────────────────────────── */}
      <div className={`${glassCard} overflow-hidden`}>
        {/* Accent bar (status color) */}
        <div className={`h-1 w-full ${statusBarColor(client.status)}`} />

        <div className="p-5 md:p-7">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
            {/* Avatar */}
            <div className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-2xl md:text-3xl font-black shrink-0 ${avatarColors(client.status)}`}>
              {initials}
            </div>

            {/* Datos principales */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                    {client.name} {client.lastName}
                  </h1>
                  {client.planName && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm font-bold text-primary">{client.planName}</span>
                      {client.planFrequency && (
                        <span className="text-xs text-[#8A8A9A]">· {client.planFrequency}× por semana</span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-[#8A8A9A] mt-1">
                    Miembro desde {formatDate(client.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                      client.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : client.status === 'expiring'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : client.status === 'debt'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      client.status === 'active' ? 'bg-emerald-500'
                      : client.status === 'expiring' ? 'bg-amber-500'
                      : client.status === 'debt' ? 'bg-red-500'
                      : 'bg-gray-400'
                    }`} />
                    {getStatusLabel(client.status)}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                    >
                      <Edit2 size={12} />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Contact chips */}
              <div className="flex flex-wrap gap-2 mt-4">
                {client.dni && (
                  <ContactChip icon={Hash} label={`DNI ${client.dni}`} />
                )}
                {client.email && (
                  <ContactChip icon={Mail} label={client.email} />
                )}
                {client.phone && (
                  <ContactChip
                    icon={Phone}
                    label={client.phone}
                    href={`https://wa.me/54${client.phone.replace(/\D/g, '')}`}
                  />
                )}
                {client.membershipExpiresAt && (
                  <ContactChip icon={CalendarDays} label={`Vence ${formatDate(client.membershipExpiresAt)}`} />
                )}
              </div>

              {/* Plan activo — integrado en el hero */}
              {client.planName && (
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-200/40 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Tag size={11} className="text-primary" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{client.planName}</span>
                    {client.planFrequency && (
                      <span className="text-xs text-[#8A8A9A]">· {client.planFrequency}× por semana</span>
                    )}
                  </div>
                  {client.planPrice != null && (
                    <span className="text-sm font-black text-primary tabular-nums">
                      {formatCurrency(client.planPrice)}<span className="text-xs font-medium text-[#8A8A9A]">/mes</span>
                    </span>
                  )}
                  {daysLeft !== null && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                      daysLeft <= 0 ? 'bg-red-500/10 text-red-400'
                      : daysLeft <= 30 ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {daysLeft > 0 ? `${daysLeft}d restantes` : 'Vencida'}
                    </span>
                  )}
                  {progressPct > 0 && (
                    <div className="flex-1 min-w-[80px] max-w-[160px]">
                      <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: TrendingUp,
            label: 'Total pagado',
            value: formatCurrency(totalPaid),
            iconColor: 'text-primary',
            iconBg: 'bg-primary/10',
          },
          {
            icon: Activity,
            label: 'Asistencias',
            value: String(presentDays),
            unit: 'veces',
            iconColor: 'text-emerald-500',
            iconBg: 'bg-emerald-500/10',
          },
          {
            icon: Clock,
            label: 'Última visita',
            value: lastVisit ? formatDate(lastVisit) : '—',
            iconColor: 'text-[#8A8A9A]',
            iconBg: 'bg-white/[0.06] dark:bg-white/[0.05]',
          },
        ].map(s => (
          <div
            key={s.label}
            className={`${glassCard} p-4 flex items-center gap-3`}
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none truncate">
                {s.value}
              </p>
              <p className="text-xs text-[#8A8A9A] mt-0.5 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── TABS FULL WIDTH ─────────────────────────────────────────────────── */}
      <div className="space-y-3">


          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07]">
            {TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex items-center justify-center gap-2 flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  tab === t.value
                    ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <span>{t.label}</span>
                <span className={`min-w-[20px] text-center text-xs px-1.5 py-0.5 rounded-lg font-bold ${
                  tab === t.value
                    ? 'bg-primary/20 text-primary'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={`${glassCard} overflow-hidden min-h-[280px]`}>

            {/* ─── PAGOS ─────────────────────────────────────────────────── */}
            {tab === 'pagos' && (
              payments.length === 0
                ? <EmptyState icon={CreditCard} message="Sin pagos registrados" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
                        <tr>
                          {['Método', 'Monto', 'Fecha', 'Comprobante'].map(h => (
                            <th key={h} className="px-5 py-4 text-left text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20 dark:divide-white/10">
                        {payments.map(p => {
                          const cfg = METHOD_CONFIG[p.method] ?? METHOD_CONFIG.cash
                          const MethodIcon = cfg.Icon
                          return (
                            <tr key={p.id} className="group transition-colors hover:bg-white/50 dark:hover:bg-black/50">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                    <MethodIcon size={14} className={cfg.color} />
                                  </div>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cfg.label}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                                  {formatCurrency(p.amount)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-[#8A8A9A] text-sm">
                                {formatDate(p.paidAt)}
                              </td>
                              <td className="px-5 py-3.5">
                                {p.invoiced
                                  ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg"><CheckCircle2 size={12} /> Sí</span>
                                  : <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8A8A9A] bg-white/[0.05] px-2 py-1 rounded-lg"><XCircle size={12} /> No</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ─── ASISTENCIA ────────────────────────────────────────────── */}
            {tab === 'asistencia' && (
              attendance.length === 0
                ? <EmptyState icon={Activity} message="Sin registros de asistencia" />
                : <AttendanceTabContent attendance={attendance} />
            )}

            {/* ─── TURNOS ────────────────────────────────────────────────── */}
            {tab === 'turnos' && (
              shiftStats.length === 0
                ? <EmptyState icon={Dumbbell} message="Sin turnos registrados" />
                : (
                  <div className="divide-y divide-white/20 dark:divide-white/10">
                    {shiftStats.map(({ shiftId, present, total, lastDate }) => {
                      const pct = total > 0 ? Math.round((present / total) * 100) : 0
                      return (
                        <div key={String(shiftId)} className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 dark:hover:bg-black/50 transition-colors">
                          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Dumbbell size={20} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              Turno #{shiftId}
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-200/60 dark:bg-white/[0.08] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-[#8A8A9A] shrink-0">{pct}%</span>
                            </div>
                            <p className="text-xs text-[#8A8A9A]">
                              Último: {lastDate ? formatDate(lastDate) : '—'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                              {present}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A] font-bold mt-0.5">
                              de {total}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
            )}
            {/* ─── RUTINA ────────────────────────────────────────────────── */}
            {tab === 'rutina' && (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8A8A9A]">
                    {loadingRutinas ? 'Cargando...' : `${rutinas.length} rutina${rutinas.length !== 1 ? 's' : ''}`}
                  </p>
                  {(isAdmin || user?.role === 'profesor') && (
                    <button
                      onClick={() => navigate(`/clients/${id}/rutina`)}
                      className="flex items-center gap-1.5 rounded-xl btn-action px-4 py-2 text-sm"
                    >
                      <Plus size={13} /> Nueva rutina
                    </button>
                  )}
                </div>

                {loadingRutinas ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
                  </div>
                ) : rutinas.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
                      <BookOpen size={20} className="text-gray-400 dark:text-[#8A8A9A]" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-[#8A8A9A]">Sin rutinas registradas</p>
                    {(isAdmin || user?.role === 'profesor') && (
                      <button
                        onClick={() => navigate(`/clients/${id}/rutina`)}
                        className="text-xs text-primary hover:underline"
                      >
                        Crear la primera rutina →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rutinas.map((rutina: Rutina) => (
                      <button
                        key={rutina.id}
                        onClick={() => navigate(`/clients/${id}/rutina`)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100/60 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.1] transition-all text-left"
                      >
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen size={15} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{rutina.nombre}</p>
                          <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">{rutina.ejercicios.length} ejercicio{rutina.ejercicios.length !== 1 ? 's' : ''}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${rutina.activa ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-500/10 text-gray-500 dark:text-[#8A8A9A]'}`}>
                          {rutina.activa ? 'Activa' : 'Inactiva'}
                        </span>
                        <ChevronDown size={13} className="text-gray-400 dark:text-[#8A8A9A] shrink-0 -rotate-90" />
                      </button>
                    ))}
                    <button
                      onClick={() => navigate(`/clients/${id}/rutina`)}
                      className="w-full text-center text-xs text-primary hover:underline pt-1"
                    >
                      Gestionar todas las rutinas →
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
      </div>

      {/* ── MODAL EDICIÓN ───────────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Editar cliente" size="md">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *"   error={errors.name?.message}     {...register('name')} />
            <Input label="Apellido *" error={errors.lastName?.message}  {...register('lastName')} />
          </div>
          <Input label="DNI *"   error={errors.dni?.message}   {...register('dni')} />
          <Input label="Email"   type="email" error={errors.email?.message}  {...register('email')} />
          <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={isSaving}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
