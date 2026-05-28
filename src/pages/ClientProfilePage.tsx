import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Phone, Mail, CalendarDays, CheckCircle2, XCircle,
  Edit2, CreditCard, Activity, Clock, Hash, Banknote, ArrowLeftRight,
  MessageCircle, Tag, Dumbbell, BookOpen, Plus, ChevronDown,
  BarChart2, PieChart as PieIcon, LineChart as LineChartIcon,
  Receipt, AlertTriangle,
} from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
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
import { inscripcionesApi } from '../api/inscripciones.api'
import type { InscripcionClienteEntry } from '../api/inscripciones.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import type { ListaEsperaClienteEntry } from '../api/listaEspera.api'
import { shiftsApi } from '../api/shifts.api'
import type { Shift } from '../types/shift.types'
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

const DIA_SHORT: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', 'miércoles': 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', 'sábado': 'Sá', domingo: 'Do',
}

const WEEKDAY_SHORT: Record<string, string> = {
  monday: 'Lu', tuesday: 'Ma', wednesday: 'Mi', thursday: 'Ju',
  friday: 'Vi', saturday: 'Sá', sunday: 'Do',
}


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
    <div className="grid grid-cols-2 divide-x divide-white/[0.06]">

      {/* ── Columna izquierda: lista ─────���────────────────────── */}
      <div className="flex flex-col">
        {/* Filtros */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex gap-1">
            {([['todos', 'Todos'], ['presentes', 'Presentes'], ['ausentes', 'Ausentes']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterStatus(v)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
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
            className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[#8A8A9A] focus:outline-none focus:border-white/[0.2] cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m} value={m} className="bg-[#1A1A1A]">
                {m === 'todos' ? 'Todos los meses' : format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}
              </option>
            ))}
          </select>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto divide-y divide-white/[0.06]" style={{ maxHeight: 360 }}>
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-[#8A8A9A] py-8">Sin registros</p>
          ) : filtered.map(a => (
            <div key={a.id} className="flex items-center gap-2.5 px-4 py-3 hover:bg-black/30 transition-colors">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                a.present ? 'bg-emerald-500/10' : 'bg-red-500/10'
              }`}>
                {a.present
                  ? <CheckCircle2 size={13} className="text-emerald-400" />
                  : <XCircle size={13} className="text-red-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white leading-tight">
                  {format(parseISO(a.date), "d MMM yyyy", { locale: es })}
                </p>
                <p className="text-[10px] text-[#8A8A9A] truncate">{a.shiftLabel}</p>
              </div>
              <span className={`text-[10px] font-semibold shrink-0 ${a.present ? 'text-emerald-400' : 'text-red-400'}`}>
                {a.present ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Columna derecha: stats ────────��───────────────────── */}
      <div className="flex flex-col">
        {/* Stats 2×2 */}
        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] border-b border-white/[0.06]">
          {[
            { label: 'Total',      value: attendance.length, color: 'text-white'       },
            { label: 'Presentes',  value: presentCount,      color: 'text-emerald-400' },
            { label: 'Ausentes',   value: absentCount,       color: 'text-red-400'     },
            { label: 'Asistencia', value: `${pct}%`,         color: 'text-primary'     },
          ].map(s => (
            <div key={s.label} className="py-4 text-center">
              <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Chart toggle */}
        <div className="flex gap-1 px-3 py-2 border-b border-white/[0.06]">
          {CHART_VIEWS.map(({ value, Icon, label }) => (
            <button
              key={value}
              onClick={() => setChartView(value)}
              className={`flex flex-1 items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all ${
                chartView === value ? 'bg-white/[0.09] text-white' : 'text-[#8A8A9A] hover:text-white'
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="px-1 py-3 flex-1">
          {chartView === 'resumen' && (
            <div className="relative">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={64} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`${v} días`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{pct}%</p>
                  <p className="text-[9px] text-[#8A8A9A] uppercase tracking-wider">asistencia</p>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-1">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-[#8A8A9A]">Presente ({presentCount})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="text-[10px] text-[#8A8A9A]">Ausente ({absentCount})</span>
                </div>
              </div>
            </div>
          )}

          {chartView === 'mensual' && (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barSize={8} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#8A8A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A8A9A', fontSize: 10 }} axisLine={false} tickLine={false} width={18} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="presentes" name="Presentes" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ausentes"  name="Ausentes"  fill="#EF4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartView === 'historial' && (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={historialData} margin={{ left: -10 }}>
                <defs>
                  <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FBC608" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FBC608" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: '#8A8A9A', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#8A8A9A', fontSize: 10 }} axisLine={false} tickLine={false} width={18} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [v, 'Acumuladas']}
                />
                <Area type="monotone" dataKey="asistencias" stroke="#FBC608" fill="url(#gradHist)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#FBC608' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
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
  const [membershipDetailOpen, setMembershipDetailOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(true)

  // Rutinas — solo para el resumen en el tab (la edición vive en ClientRutinaPage)
  const { rutinas, isLoading: loadingRutinas } = useRutinas(id)

  // Turnos — carga lazy al abrir el tab
  const [inscripciones, setInscripciones]           = useState<InscripcionClienteEntry[]>([])
  const [listaEsperaCliente, setListaEsperaCliente] = useState<ListaEsperaClienteEntry[]>([])
  const [loadingTurnos, setLoadingTurnos]           = useState(false)
  const [turnosLoaded, setTurnosLoaded]             = useState(false)
  const [enrollOpen, setEnrollOpen]                 = useState(false)
  const [allShifts, setAllShifts]                   = useState<Shift[]>([])
  const [loadingShifts, setLoadingShifts]           = useState(false)
  const [enrollingId, setEnrollingId]               = useState<string | null>(null)

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

  useEffect(() => {
    if (tab !== 'turnos' || !id || turnosLoaded) return
    setLoadingTurnos(true)
    Promise.allSettled([
      inscripcionesApi.getByCliente(id),
      listaEsperaApi.getByCliente(id),
    ]).then(([inscRes, espRes]) => {
      if (inscRes.status === 'fulfilled') setInscripciones(inscRes.value)
      if (espRes.status === 'fulfilled') setListaEsperaCliente(espRes.value)
      setTurnosLoaded(true)
    }).finally(() => setLoadingTurnos(false))
  }, [tab, id, turnosLoaded])

  useEffect(() => {
    if (!enrollOpen) return
    setLoadingShifts(true)
    shiftsApi.getAll()
      .then(shifts => setAllShifts(shifts))
      .finally(() => setLoadingShifts(false))
  }, [enrollOpen])

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

  async function handleDarDeBaja(inscripcionId: string) {
    try {
      await inscripcionesApi.darDeBaja(inscripcionId)
      setInscripciones(prev => prev.filter(i => i.id !== inscripcionId))
      addToast('Baja registrada', 'success')
    } catch {
      addToast('Error al dar de baja', 'error')
    }
  }

  async function handleCancelarEspera(listaId: string) {
    try {
      await listaEsperaApi.remove(listaId)
      setListaEsperaCliente(prev => prev.filter(e => e.id !== listaId))
      addToast('Eliminado de la lista de espera', 'success')
    } catch {
      addToast('Error al cancelar', 'error')
    }
  }

  async function handleEnroll(turnoId: string, sala: 'A' | 'B') {
    if (!id) return
    setEnrollingId(turnoId + sala)
    try {
      const result = await inscripcionesApi.enroll(id, turnoId, sala)
      if (result.enListaEspera) {
        addToast('Turno lleno — cliente añadido a lista de espera', 'success')
        listaEsperaApi.getByCliente(id).then(setListaEsperaCliente)
      } else {
        addToast('Inscripción registrada', 'success')
        inscripcionesApi.getByCliente(id).then(setInscripciones)
      }
      setEnrollOpen(false)
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al inscribir', 'error')
    } finally {
      setEnrollingId(null)
    }
  }

  // ─── Datos derivados ────────────────────────────────────────────────────────
  const presentDays = useMemo(() => attendance.filter(a => a.present).length, [attendance])

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

  // ─── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    const pulse = 'animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded-lg'
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4 md:space-y-5"
      >
        {/* Breadcrumb */}
        <div className={`h-4 w-16 ${pulse}`} />

        {/* Hero card */}
        <div className={`${glassCard} p-5 md:p-7`}>
          <div className="flex gap-5">
            <div className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl shrink-0 ${pulse}`} />
            <div className="flex-1 space-y-3 pt-1">
              <div className={`h-8 w-48 ${pulse}`} />
              <div className={`h-3.5 w-32 ${pulse}`} />
              <div className="flex gap-2 pt-1">
                {[72, 110, 88].map((w, i) => (
                  <div key={i} className={`h-7 rounded-xl ${pulse}`} style={{ width: w }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Membership card */}
        <div className={`${glassCard} p-5 md:p-6 space-y-5`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl shrink-0 ${pulse}`} />
              <div className="space-y-2">
                <div className={`h-5 w-28 ${pulse}`} />
                <div className={`h-3 w-20 ${pulse}`} />
              </div>
            </div>
            <div className={`h-8 w-20 rounded-xl ${pulse}`} />
          </div>
          {/* Stats 2-col */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`h-14 rounded-xl ${pulse}`} />
            <div className={`h-14 rounded-xl ${pulse}`} />
          </div>
          {/* Progress bar */}
          <div className="space-y-2">
            <div className={`h-3 w-48 ${pulse}`} />
            <div className={`h-1.5 w-full rounded-full ${pulse}`} />
          </div>
          {/* Cuotas */}
          <div className="space-y-2">
            <div className={`h-3 w-24 ${pulse}`} />
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-12 rounded-xl ${pulse}`} style={{ opacity: 1 - (i - 1) * 0.2 }} />
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-3">
          <div className={`h-11 rounded-2xl ${pulse}`} />
          <div className={`${glassCard} p-6 space-y-3`}>
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-14 rounded-xl ${pulse}`} style={{ opacity: 1 - (i - 1) * 0.25 }} />
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

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
const progressPct    = (() => {
    if (!client.membershipStartDate || !client.membershipExpiresAt) return 0
    const total = new Date(client.membershipExpiresAt).getTime() - new Date(client.membershipStartDate).getTime()
    const elapsed = Date.now() - new Date(client.membershipStartDate).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()
  const progressColor  = daysLeft === null ? 'bg-gray-400' : daysLeft <= 0 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-amber-500' : 'bg-emerald-500'

  const lastPaymentDate = payments.length > 0 ? payments[0].paidAt : null

  const MODALIDAD_LABEL: Record<string, string> = {
    MENSUAL: 'Mensual',
    TRES_MESES: '3 meses',
    SEIS_MESES: '6 meses',
  }

  const CUOTAS_POR_MODALIDAD: Record<string, number> = {
    MENSUAL: 1, TRES_MESES: 3, SEIS_MESES: 6,
  }

  // Cronograma de cuotas de la membresía activa
  const cuotasSchedule = (() => {
    if (!client?.membershipId || !client.membershipStartDate || !client.membershipModalidad) return []
    const n = CUOTAS_POR_MODALIDAD[client.membershipModalidad] ?? 1
    return Array.from({ length: n }, (_, i) => {
      const num = i + 1
      const fechaEsperada = addDays(new Date(client.membershipStartDate!), 30 * i)
      const pago = payments.find(p => p.membresiaId === client.membershipId && p.cuotaNumero === num)
      return { numero: num, fechaEsperada, pago: pago ?? null }
    })
  })()

  const MEMBRESIA_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    ACTIVA:    { label: 'Activa',    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
    VENCIDA:   { label: 'Vencida',   color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10',     dot: 'bg-red-500'     },
    CANCELADA: { label: 'Cancelada', color: 'text-gray-600 dark:text-gray-400',       bg: 'bg-gray-500/10',   dot: 'bg-gray-400'    },
  }

  const planFreqGlobal = client?.planFrequency ? Number(client.planFrequency) : null
  const TABS: { value: Tab; label: string; count: number; sublabel?: string }[] = [
    { value: 'rutina',     label: 'Rutina',     count: rutinas.length       },
    { value: 'turnos',     label: 'Clases',     count: 0, sublabel: planFreqGlobal ? `${inscripciones.length}/${planFreqGlobal}` : inscripciones.length > 0 ? String(inscripciones.length) : undefined },
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
                  <p className="text-sm text-gray-400 dark:text-[#8A8A9A] mt-1.5">
                    Miembro desde {formatDate(client.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                    client.status === 'active'   ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : client.status === 'expiring' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : client.status === 'debt'     ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      client.status === 'active' ? 'bg-emerald-500'
                      : client.status === 'expiring' ? 'bg-amber-500'
                      : client.status === 'debt' ? 'bg-red-500' : 'bg-gray-400'
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
                {client.dni
                  ? <ContactChip icon={Hash} label={`DNI ${client.dni}`} />
                  : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-white/[0.03] dark:bg-white/[0.02] text-gray-400 dark:text-[#5A5A6A] border-gray-200 dark:border-white/[0.06]">
                      <Hash size={11} className="shrink-0 opacity-40" />
                      Sin DNI
                    </span>
                  )
                }
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MEMBRESÍA CARD ──────────────────────────────────────────────────── */}
      {client.planName ? (
        <div className={`${glassCard} overflow-hidden`}>

          <div className="p-5 md:p-6">

            {/* Header — clickeable para colapsar/expandir */}
            <button
              onClick={() => setMembershipOpen(p => !p)}
              className="w-full flex items-center justify-between gap-3 group"
            >
              <div className="text-left">
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-none">{client.planName}</h3>
                {client.planFrequency && (
                  <p className="text-xs text-gray-400 dark:text-[#8A8A9A] mt-0.5">{client.planFrequency}× por semana</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-400 dark:text-[#8A8A9A] group-hover:text-gray-600 dark:group-hover:text-white transition-colors">
                  Membresía
                </span>
                <ChevronDown
                  size={15}
                  className={`text-gray-400 dark:text-[#8A8A9A] transition-transform duration-200 ${membershipOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {/* Contenido colapsable */}
            {membershipOpen && <div className="mt-5 space-y-5">

            {/* Stats — 2 métricas clave */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-[#5A5A6A]">Modalidad</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1 leading-none">
                  {client.membershipModalidad ? (MODALIDAD_LABEL[client.membershipModalidad] ?? client.membershipModalidad) : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-[#5A5A6A]">Precio</p>
                <p className="text-base font-bold text-primary mt-1 leading-none tabular-nums">
                  {client.membershipPrecio != null ? formatCurrency(client.membershipPrecio) : '—'}
                </p>
              </div>
            </div>

            {/* Barra de período */}
            {progressPct > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-[#5A5A6A]">
                    {client.membershipStartDate ? formatDate(client.membershipStartDate) : '—'}
                    {' → '}
                    {client.membershipExpiresAt ? formatDate(client.membershipExpiresAt) : '—'}
                  </span>
                  {daysLeft !== null && (
                    <span className={`text-[11px] font-semibold ${
                      daysLeft <= 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {daysLeft > 0 ? `${daysLeft}d restantes` : 'Finalizada'}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.07] overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Cuotas */}
            {cuotasSchedule.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                    Cuotas — {cuotasSchedule.length} {cuotasSchedule.length === 1 ? 'pago' : 'pagos mensuales'}
                  </p>
                  <span className="text-[10px] text-[#8A8A9A]">
                    {cuotasSchedule.filter(c => c.pago).length} de {cuotasSchedule.length} abonadas
                  </span>
                </div>
                <div className="space-y-2">
                  {cuotasSchedule.map(c => (
                    <div
                      key={c.numero}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                        c.pago
                          ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/[0.04]'
                          : 'border-gray-100 dark:border-white/[0.06] bg-gray-50/30 dark:bg-white/[0.01]'
                      }`}
                    >
                      {/* Izquierda — nombre + fecha */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-none ${c.pago ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                          Cuota {c.numero}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                          {c.pago
                            ? formatDate(c.pago.paidAt)
                            : format(c.fechaEsperada, "d 'de' MMMM yyyy", { locale: es })
                          }
                        </p>
                      </div>

                      {/* Derecha — monto + botón ver */}
                      <div className="flex items-center gap-2 shrink-0">
                        {c.pago && (
                          <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(c.pago.amount)}
                          </span>
                        )}
                        {c.pago ? (
                          <button
                            onClick={() => navigate(`/payments/${c.pago!.id}`)}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/[0.15] transition-all"
                          >
                            Ver
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-[#5A5A6A]">
                            Pendiente
                          </span>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>}
        </div>
        </div>
      ) : (
        <div className={`${glassCard} p-5 flex items-center gap-4`}>
          <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center shrink-0">
            <CreditCard size={16} className="text-gray-400 dark:text-[#6A6A7A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Sin membresía activa</p>
            <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">Este cliente no tiene una membresía asignada.</p>
          </div>
        </div>
      )}

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
                {t.sublabel ? (
                  <span className={`text-xs tabular-nums ${tab === t.value ? 'text-primary/70' : 'text-gray-400 dark:text-[#8A8A9A]'}`}>
                    {t.sublabel}
                  </span>
                ) : t.count > 0 && (
                  <span className={`min-w-[20px] text-center text-xs px-1.5 py-0.5 rounded-lg font-bold ${
                    tab === t.value
                      ? 'bg-primary/20 text-primary'
                      : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]'
                  }`}>
                    {t.count}
                  </span>
                )}
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
                          {['Método', 'Monto', 'Fecha', 'Comprobante', ''].map(h => (
                            <th key={h} className="px-5 py-4 text-left text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20 dark:divide-white/10">
                        {payments.map(p => {
                          const cfg = METHOD_CONFIG[p.method] ?? METHOD_CONFIG.cash
                          const MethodIcon = cfg.Icon
                          return (
                            <tr
                              key={p.id}
                              onClick={() => navigate(`/payments/${p.id}`)}
                              className="group transition-colors hover:bg-white/50 dark:hover:bg-black/50 cursor-pointer"
                            >
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
                              <td className="px-5 py-3.5">
                                <ChevronDown size={14} className="text-[#8A8A9A] -rotate-90 group-hover:text-white transition-colors" />
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
            {tab === 'turnos' && (() => {
              const totalDiasUsados = inscripciones.reduce((acc, i) => acc + i.dias.length, 0)
              const planFreq = client.planFrequency ? Number(client.planFrequency) : null
              const limiteAlcanzado = !loadingTurnos && !!planFreq && totalDiasUsados >= planFreq
              return (
              <div className="flex flex-col">
                {/* Encabezado inscripciones */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">
                    Inscripciones activas
                    {!loadingTurnos && (
                      <span className="ml-1.5 tabular-nums text-white/40">{inscripciones.length}{planFreq ? `/${planFreq}` : ''}</span>
                    )}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => { if (!limiteAlcanzado) setEnrollOpen(true) }}
                      disabled={limiteAlcanzado}
                      title={limiteAlcanzado ? `Límite del plan alcanzado (${planFreq} días/semana)` : undefined}
                      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${limiteAlcanzado ? 'text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50' : 'text-primary hover:text-primary-dark'}`}
                    >
                      <Plus size={13} />
                      Añadir turno
                    </button>
                  )}
                </div>

                {/* Banner: límite del plan */}
                {!loadingTurnos && planFreq && (
                  limiteAlcanzado ? (
                    <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-sm px-4 py-3">
                      <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300 leading-snug">
                        Límite alcanzado — el plan permite <span className="font-semibold">{planFreq} día{planFreq !== 1 ? 's' : ''} por semana</span> y ya tiene <span className="font-semibold">{totalDiasUsados} asignado{totalDiasUsados !== 1 ? 's' : ''}</span>. No se pueden agregar más.
                      </p>
                    </div>
                  ) : totalDiasUsados === planFreq - 1 ? (
                    <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm px-4 py-3">
                      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300 leading-snug">
                        Queda <span className="font-semibold">1 día disponible</span> según el plan ({planFreq} días/semana).
                      </p>
                    </div>
                  ) : null
                )}

                {/* Lista de inscripciones */}
                {loadingTurnos ? (
                  <div className="divide-y divide-white/[0.06]">
                    {[1, 2].map(i => (
                      <div key={i} className="flex items-center gap-4 px-5 py-4">
                        <div className="h-11 w-11 rounded-2xl animate-pulse bg-gray-200/80 dark:bg-white/[0.07] shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-36 animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded" />
                          <div className="h-3 w-24 animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded" />
                        </div>
                        <div className="h-7 w-24 animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded-xl" />
                      </div>
                    ))}
                  </div>
                ) : inscripciones.length === 0 ? (
                  <EmptyState icon={Dumbbell} message="Sin turnos asignados" />
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {inscripciones.map(insc => (
                      <div key={insc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 dark:hover:bg-black/50 transition-colors">
                        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Dumbbell size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {insc.horaInicio} – {insc.horaFin}
                            </p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              insc.sala === 'A'
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                            }`}>
                              Sala {insc.sala}
                            </span>
                          </div>
                          <p className="text-xs text-[#8A8A9A]">
                            {insc.dias.map(d => DIA_SHORT[d.toLowerCase()] ?? d).join(' · ')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDarDeBaja(insc.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-400 shrink-0 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-all"
                        >
                          <XCircle size={13} />
                          Dar de baja
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lista de espera */}
                {!loadingTurnos && listaEsperaCliente.length > 0 && (
                  <>
                    <div className="flex items-center px-5 py-3 border-t border-b border-white/[0.06]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">
                        Lista de espera
                        <span className="ml-1.5 tabular-nums text-white/40">{listaEsperaCliente.length}</span>
                      </span>
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      {listaEsperaCliente.map(entry => (
                        <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 dark:hover:bg-black/50 transition-colors">
                          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Clock size={20} className="text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {entry.horaInicio} – {entry.horaFin}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                entry.estado === 'PENDIENTE'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              }`}>
                                {entry.estado === 'PENDIENTE' ? 'Pendiente' : 'Notificado'}
                              </span>
                            </div>
                            <p className="text-xs text-[#8A8A9A]">
                              {entry.dias.map(d => DIA_SHORT[d.toLowerCase()] ?? d).join(' · ')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancelarEspera(entry.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-red-500 shrink-0 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-all"
                          >
                            <XCircle size={13} />
                            Cancelar
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              )
            })()}
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
                          <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">{(rutina.semanas ?? []).reduce((acc, s) => acc + (s.sesiones ?? []).reduce((a, ses) => a + (ses.bloques ?? []).reduce((b, bl) => b + (bl.ejerciciosPlan ?? []).length, 0), 0), 0)} ejercicios · {(rutina.semanas ?? []).length} semana{(rutina.semanas ?? []).length !== 1 ? 's' : ''}</p>
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

      {/* ── MODAL MEMBRESÍA ─────────────────────────────────────────────────── */}
      <Modal isOpen={membershipDetailOpen} onClose={() => setMembershipDetailOpen(false)} title="Membresía activa" size="md">
        {client.membershipId && (
          <div className="space-y-4">
            {/* Estado + Modalidad */}
            <div className="flex items-center gap-3 flex-wrap">
              {client.membershipStatus && MEMBRESIA_STATUS_CONFIG[client.membershipStatus] && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl ${MEMBRESIA_STATUS_CONFIG[client.membershipStatus].bg} ${MEMBRESIA_STATUS_CONFIG[client.membershipStatus].color}`}>
                  <span className={`h-2 w-2 rounded-full ${MEMBRESIA_STATUS_CONFIG[client.membershipStatus].dot}`} />
                  {MEMBRESIA_STATUS_CONFIG[client.membershipStatus].label}
                </span>
              )}
              {client.membershipModalidad && (
                <span className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-white/[0.06] text-[#8A8A9A] border border-white/[0.08]">
                  {MODALIDAD_LABEL[client.membershipModalidad] ?? client.membershipModalidad}
                </span>
              )}
            </div>

            {/* Datos */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Plan', value: client.planName ?? '—' },
                { label: 'Frecuencia', value: client.planFrequency ? `${client.planFrequency}× por semana` : '—' },
                { label: 'Precio pagado', value: client.membershipPrecio != null ? formatCurrency(client.membershipPrecio) : '—' },
                { label: 'Días restantes', value: daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} días` : 'Vencida') : '—' },
                { label: 'Inicio', value: client.membershipStartDate ? formatDate(client.membershipStartDate) : '—' },
                { label: 'Vencimiento', value: client.membershipExpiresAt ? formatDate(client.membershipExpiresAt) : '—' },
                { label: 'Último pago', value: lastPaymentDate ? formatDate(lastPaymentDate) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3">
                  <p className="text-xs text-[#8A8A9A] mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Barra de progreso */}
            {progressPct > 0 && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-[#8A8A9A]">Período transcurrido</span>
                  <span className="text-xs font-semibold text-white">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── MODAL AÑADIR TURNO ─────────────────────────────────────────────── */}
      <Modal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} title="Añadir turno" size="md">
        {(() => {
          const totalDiasUsados = inscripciones.reduce((acc, i) => acc + i.dias.length, 0)
          const planFreq = client.planFrequency ? Number(client.planFrequency) : null
          const limiteModal = !!planFreq && totalDiasUsados >= planFreq
          if (limiteModal) return (
            <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Límite del plan alcanzado</p>
              <p className="text-xs text-[#8A8A9A] leading-snug max-w-[260px]">
                El plan permite <span className="font-semibold text-gray-700 dark:text-gray-300">{planFreq} día{planFreq !== 1 ? 's' : ''} por semana</span> y ya tiene <span className="font-semibold text-gray-700 dark:text-gray-300">{totalDiasUsados} asignado{totalDiasUsados !== 1 ? 's' : ''}</span>. Para agregar un turno, primero darlo de baja de otro.
              </p>
            </div>
          )
          return loadingShifts ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl animate-pulse bg-gray-200/80 dark:bg-white/[0.07]" />
            ))}
          </div>
        ) : (() => {
          const enrolledIds = new Set(inscripciones.map(i => i.turnoId))
          const diasDisponibles = planFreq !== null ? planFreq - totalDiasUsados : Infinity
          const notEnrolled = allShifts.filter(s => !enrolledIds.has(String(s.id)))
          const available = notEnrolled.filter(s => s.days.length <= diasDisponibles)
          const exceden = planFreq !== null ? notEnrolled.filter(s => s.days.length > diasDisponibles) : []
          return notEnrolled.length === 0 ? (
            <p className="text-sm text-center text-gray-500 dark:text-[#8A8A9A] py-8">
              El cliente ya está inscripto en todos los turnos disponibles.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {available.map(shift => (
                <div key={shift.id} className="rounded-2xl border border-white/10 dark:border-white/[0.06] bg-white/[0.03] dark:bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {shift.startTime} – {shift.endTime}
                      </p>
                      <p className="text-xs text-[#8A8A9A] mt-0.5">
                        {shift.days.map(d => WEEKDAY_SHORT[d] ?? d).join(' · ')}
                        {shift.profesorNombre && (
                          <span className="ml-2 opacity-60">· {shift.profesorNombre}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(['A', 'B'] as const).map(sala => {
                      const insc  = sala === 'A' ? shift.inscritosA  : shift.inscritosB
                      const cupo  = sala === 'A' ? shift.cupoMaximoSalaA : shift.cupoMaximoSalaB
                      const lleno = insc >= cupo
                      const loading = enrollingId === (String(shift.id) + sala)
                      return (
                        <button
                          key={sala}
                          disabled={lleno || !!enrollingId}
                          onClick={() => handleEnroll(String(shift.id), sala)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            lleno
                              ? 'opacity-40 cursor-not-allowed bg-gray-200/50 dark:bg-gray-500/10 text-gray-400'
                              : 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-95'
                          }`}
                        >
                          {loading ? (
                            <span className="inline-block h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              Sala {sala}
                              <span className="opacity-60 font-normal">{insc}/{cupo}</span>
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {exceden.map(shift => (
                <div key={shift.id} className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-4 opacity-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {shift.startTime} – {shift.endTime}
                      </p>
                      <p className="text-xs text-[#8A8A9A] mt-0.5">
                        {shift.days.map(d => WEEKDAY_SHORT[d] ?? d).join(' · ')}
                        {shift.profesorNombre && (
                          <span className="ml-2 opacity-60">· {shift.profesorNombre}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                      Excede el plan
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        })()
        })()}
      </Modal>

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
