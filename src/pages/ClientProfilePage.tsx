import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Phone, Mail, CalendarDays, CheckCircle2, XCircle,
  Edit2, CreditCard, Activity, Clock, Hash, Banknote, ArrowLeftRight,
  MessageCircle, Tag, Dumbbell, BookOpen, Plus, ChevronDown, ChevronRight,
  BarChart2, PieChart as PieIcon, LineChart as LineChartIcon,
  Receipt, AlertTriangle, MapPin, User, Trophy, Trash2, Save,
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
import { membresiasClienteApi } from '../api/membresiasCliente.api'
import { membershipsApi } from '../api/memberships.api'
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
import Skeleton, { SkeletonClientProfile } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { getStatusLabel } from '../utils/getStatusColor'
import { MODALIDAD_LABELS, MODALIDADES } from '../types/membership.types'
import type { MembresiaCliente, Modalidad, Plan } from '../types/membership.types'
import { formatDate } from '../utils/formatDate'
import { formatCurrency } from '../utils/formatCurrency'
import type { Client } from '../types/client.types'
import type { Payment } from '../types/payment.types'
import type { AttendanceRecord } from '../types/attendance.types'
import type { FichaEntrenamiento, EventoDeportivo } from '../types/rutina.types'

const ACTIVIDAD_LABELS: Record<string, string> = {
  SEDENTARIA: 'Sedentaria',
  MODERADA:   'Moderada',
  ACTIVA:     'Activa',
  MUY_ACTIVA: 'Muy activa',
}

// ─── Configuración de métodos de pago ─────────────────────────────────────────
const METHOD_CONFIG: Record<string, { label: string; Icon: typeof Banknote; color: string; bg: string }> = {
  cash: { label: 'Efectivo', Icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  transfer: { label: 'Transferencia', Icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  card: { label: 'Débito', Icon: CreditCard, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
}

// ─── Schema edición ────────────────────────────────────────────────────────────
const editSchema = z.object({
  name:     z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  email:    z.string().email('Email inválido').or(z.literal('')),
  phone:    z.string().optional(),
  cuil:     z.string().min(1, 'Requerido'),
  sedeId:   z.string().optional(),
  // ficha
  peso:            z.string().optional(),
  altura:          z.string().optional(),
  actividadDiaria: z.string().optional(),
  objetivos:       z.string().optional(),
  deportePractica: z.string().optional(),
  experiencia:     z.string().optional(),
  lesiones:        z.string().optional(),
  patologiasBase:  z.string().optional(),
})
type EditValues = z.infer<typeof editSchema>

const ACTIVIDAD_OPTIONS = [
  { value: '',           label: '— Sin seleccionar —' },
  { value: 'SEDENTARIA', label: 'Sedentaria' },
  { value: 'MODERADA',   label: 'Moderada' },
  { value: 'ACTIVA',     label: 'Activa' },
  { value: 'MUY_ACTIVA', label: 'Muy activa' },
]

// ─── Helpers visuales ─────────────────────────────────────────────────────────
function avatarColors(status: Client['status']) {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (status === 'expiring') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  if (status === 'debt') return 'bg-red-500/15 text-red-600 dark:text-red-400'
  return 'bg-gray-200/60 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400'
}

function statusBarColor(status: Client['status']) {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'expiring') return 'bg-amber-500'
  if (status === 'debt') return 'bg-red-500'
  return 'bg-gray-400'
}

function membershipDaysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

const DIAS_POR_MODALIDAD_FE: Record<string, number> = {
  TRANSFERENCIA_MENSUAL: 30, EFECTIVO: 30, MEMBRESIA_3_MESES: 90, MEMBRESIA_6_MESES: 180,
}
function calcVencimiento(fechaInicio: string, modalidad: string): string {
  if (!fechaInicio) return ''
  const d = addDays(new Date(fechaInicio), DIAS_POR_MODALIDAD_FE[modalidad] ?? 30)
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es })
}

// ─── Glassmorphism card ───────────────────────────────────────────────────────
const glassCard = 'rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

// ─── Tooltip de estado ────────────────────────────────────────────────────────
function getStatusTooltip(client: Client): string | null {
  if (client.status === 'active') return null
  if (client.status === 'debt')
    return 'El cliente fue marcado con pagos pendientes. Regularizá la deuda para volver al estado activo.'
  if (client.status === 'expiring') {
    if (!client.membershipExpiresAt) return 'No tiene ninguna membresía activa registrada.'
    const exp  = new Date(client.membershipExpiresAt)
    const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
    const fecha = format(exp, "d 'de' MMMM 'de' yyyy", { locale: es })
    if (days < 0)  return `La membresía venció el ${fecha} (hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}).`
    if (days === 0) return 'La membresía vence hoy.'
    return `La membresía vence el ${fecha} — quedan ${days} día${days !== 1 ? 's' : ''}.`
  }
  return null
}

function StatusBadge({ client, size = 'md' }: { client: Client; size?: 'sm' | 'md' }) {
  const tooltip = getStatusTooltip(client)
  const badgeCls =
    client.status === 'active'   ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : client.status === 'expiring' ? 'bg-amber-500/10  text-amber-600  dark:text-amber-400'
    : client.status === 'debt'     ? 'bg-red-500/10    text-red-600    dark:text-red-400'
    : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
  const dotCls =
    client.status === 'active'   ? 'bg-emerald-500'
    : client.status === 'expiring' ? 'bg-amber-500'
    : client.status === 'debt'     ? 'bg-red-500'
    : 'bg-gray-400'
  const paddingCls = size === 'sm' ? 'px-2 py-0.5 rounded-full font-semibold' : 'px-2.5 py-1.5 rounded-lg font-medium'

  return (
    <div className={`relative group inline-flex ${tooltip ? 'cursor-help' : ''}`}>
      <span className={`inline-flex items-center gap-1.5 text-xs ${paddingCls} ${badgeCls}`}>
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
        {getStatusLabel(client.status)}
      </span>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 px-3 py-2.5 rounded-xl bg-gray-900 dark:bg-[#0d0d0d] border border-white/[0.07] text-white text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-2xl text-center whitespace-normal">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900 dark:border-t-[#0d0d0d]" />
        </div>
      )}
    </div>
  )
}

const DIA_SHORT: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', 'miércoles': 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', 'sábado': 'Sá', domingo: 'Do',
}

const WEEKDAY_SHORT: Record<string, string> = {
  monday: 'Lu', tuesday: 'Ma', wednesday: 'Mi', thursday: 'Ju',
  friday: 'Vi', saturday: 'Sá', sunday: 'Do',
}


function formatPlanName(name: string): string {
  if (!name) return ''
  const spaced = name.replace(/_/g, ' ')
  return spaced.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
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
    { name: 'Ausente', value: absentCount, color: '#EF4444' },
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

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const tooltipStyle = { background: isDark ? '#1A1A1A' : '#FFFFFF', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 8, fontSize: 11 }
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickFill = isDark ? '#8A8A9A' : '#9CA3AF'

  const CHART_VIEWS: { value: ChartView; Icon: typeof BarChart2; label: string }[] = [
    { value: 'resumen', Icon: PieIcon, label: 'Resumen' },
    { value: 'mensual', Icon: BarChart2, label: 'Por mes' },
    { value: 'historial', Icon: LineChartIcon, label: 'Historial' },
  ]

  return (
    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-white/[0.06]">

      {/* ── Columna izquierda: lista ─────���────────────────────── */}
      <div className="flex flex-col">
        {/* Filtros */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex gap-1">
            {([['todos', 'Todos'], ['presentes', 'Presentes'], ['ausentes', 'Ausentes']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterStatus(v)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${filterStatus === v ? 'bg-gray-200 text-gray-900 dark:bg-white/[0.09] dark:text-white' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="text-xs bg-gray-100 dark:bg-white/[0.04] border border-gray-300 dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-gray-600 dark:text-[#8A8A9A] focus:outline-none focus:border-gray-400 dark:focus:border-white/[0.2] cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m} value={m} className="bg-[#1A1A1A]">
                {m === 'todos' ? 'Todos los meses' : format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}
              </option>
            ))}
          </select>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-white/[0.06]" style={{ maxHeight: 360 }}>
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-500 dark:text-[#8A8A9A] py-8">Sin registros</p>
          ) : filtered.map(a => (
            <div key={a.id} className="flex items-center gap-2.5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-black/30 transition-colors">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${a.present ? 'bg-emerald-500/10' : 'bg-red-500/10'
                }`}>
                {a.present
                  ? <CheckCircle2 size={13} className="text-emerald-400" />
                  : <XCircle size={13} className="text-red-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
                  {format(parseISO(a.date), "d MMM yyyy", { locale: es })}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-[#8A8A9A] truncate">{a.shiftLabel}</p>
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
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 dark:divide-white/[0.06] border-b border-gray-200 dark:border-white/[0.06]">
          {[
            { label: 'Total', value: attendance.length, color: 'text-gray-900 dark:text-white' },
            { label: 'Presentes', value: presentCount, color: 'text-emerald-400' },
            { label: 'Ausentes', value: absentCount, color: 'text-red-400' },
            { label: 'Asistencia', value: `${pct}%`, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="py-4 text-center">
              <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Chart toggle */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-200 dark:border-white/[0.06]">
          {CHART_VIEWS.map(({ value, Icon, label }) => (
            <button
              key={value}
              onClick={() => setChartView(value)}
              className={`flex flex-1 items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all ${chartView === value ? 'bg-gray-200 text-gray-900 dark:bg-white/[0.09] dark:text-white' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
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
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} días`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{pct}%</p>
                  <p className="text-[9px] text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">asistencia</p>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-1">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-gray-500 dark:text-[#8A8A9A]">Presente ({presentCount})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="text-[10px] text-gray-500 dark:text-[#8A8A9A]">Ausente ({absentCount})</span>
                </div>
              </div>
            </div>
          )}

          {chartView === 'mensual' && (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyData} barSize={8} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: tickFill, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickFill, fontSize: 10 }} axisLine={false} tickLine={false} width={18} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="presentes" name="Presentes" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ausentes" name="Ausentes" fill="#EF4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartView === 'historial' && (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={historialData} margin={{ left: -10 }}>
                <defs>
                  <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FBC608" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FBC608" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: tickFill, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: tickFill, fontSize: 10 }} axisLine={false} tickLine={false} width={18} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
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

  const [navOpen, setNavOpen] = useState(false)
  const [client, setClient] = useState<Client | null>(null)
  const [ficha, setFicha] = useState<FichaEntrenamiento | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [eventos, setEventos] = useState<EventoDeportivo[]>([])
  const [eventoForm, setEventoForm] = useState<{ nombre: string; fecha: string; observacion: string } | null>(null)
  const [editingEvento, setEditingEvento] = useState<EventoDeportivo | null>(null)
  const [savingEvento, setSavingEvento] = useState(false)
  const [membershipDetailOpen, setMembershipDetailOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(true)
  const [membresias, setMembresias] = useState<MembresiaCliente[]>([])
  const [loadingMembresias, setLoadingMembresias] = useState(false)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [newMembresiaOpen, setNewMembresiaOpen] = useState(false)
  const [savingMembresia, setSavingMembresia] = useState(false)
  const [newMembresiaForm, setNewMembresiaForm] = useState<{
    planId: string; modalidad: Modalidad; precio: string; fechaInicio: string
  }>({ planId: '', modalidad: 'TRANSFERENCIA_MENSUAL', precio: '', fechaInicio: '' })

  // Rutinas — solo para el resumen en el tab (la edición vive en ClientRutinaPage)
  const { rutinas, isLoading: loadingRutinas } = useRutinas(id)

  // Turnos — carga lazy al abrir el tab
  const [inscripciones, setInscripciones] = useState<InscripcionClienteEntry[]>([])
  const [listaEsperaCliente, setListaEsperaCliente] = useState<ListaEsperaClienteEntry[]>([])
  const [loadingTurnos, setLoadingTurnos] = useState(false)
  const [turnosLoaded, setTurnosLoaded] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [allShifts, setAllShifts] = useState<Shift[]>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => { clientsApi.getSedes().then(setSedes).catch(() => {}) }, [])

  // Carga lazy de planes cuando se abre el modal de nueva membresía
  useEffect(() => {
    if (!newMembresiaOpen || planes.length > 0) return
    setLoadingPlanes(true)
    membershipsApi.getAll().then(setPlanes).finally(() => setLoadingPlanes(false))
  }, [newMembresiaOpen])

  // Sugiere fecha inicio y resetea precio al abrir modal
  useEffect(() => {
    if (!newMembresiaOpen) return
    const active = [...membresias]
      .filter(m => m.estado !== 'CANCELADA')
      .sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento))[0]
    const hoy = format(new Date(), 'yyyy-MM-dd')
    const suggested = active
      ? (() => { const nd = addDays(new Date(active.fechaVencimiento), 1); return nd > new Date() ? format(nd, 'yyyy-MM-dd') : hoy })()
      : hoy
    setNewMembresiaForm({ planId: '', modalidad: 'TRANSFERENCIA_MENSUAL', precio: '', fechaInicio: suggested })
  }, [newMembresiaOpen])

  // Auto-relleno de precio desde tarifa vigente
  useEffect(() => {
    if (!newMembresiaForm.planId || planes.length === 0) return
    const plan = planes.find(p => p.id === newMembresiaForm.planId)
    if (!plan) return
    const tarifa = plan.tarifas.find(t => t.modalidad === newMembresiaForm.modalidad)
    if (tarifa) setNewMembresiaForm(prev => ({ ...prev, precio: String(tarifa.precio) }))
  }, [newMembresiaForm.planId, newMembresiaForm.modalidad, planes])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadingMembresias(true)
    Promise.allSettled([
      clientsApi.getById(id),
      paymentsApi.getAll({ clientId: id }),
      attendanceApi.getByClient(id),
      clientsApi.getFichaConEventos(id),
      membresiasClienteApi.getAll(id),
    ]).then(([clientRes, paymentsRes, attendanceRes, fichaRes, membresiasRes]) => {
      const f = fichaRes.status === 'fulfilled' ? fichaRes.value : null
      if (clientRes.status === 'fulfilled') {
        const c = clientRes.value
        setClient(c)
        reset({
          name: c.name, lastName: c.lastName, email: c.email ?? '', phone: c.phone ?? '', cuil: c.cuil ?? '',
          sedeId: c.sede?.id ?? '',
          peso:            f?.peso    != null ? String(f.peso)   : '',
          altura:          f?.altura  != null ? String(f.altura) : '',
          actividadDiaria: f?.actividadDiaria  ?? '',
          objetivos:       f?.objetivos        ?? '',
          deportePractica: f?.deportePractica  ?? '',
          experiencia:     f?.experiencia      ?? '',
          lesiones:        f?.lesiones         ?? '',
          patologiasBase:  f?.patologiasBase   ?? '',
        })
      } else {
        addToast('Error al cargar el perfil', 'error')
      }
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value.data)
      if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value)
      if (f !== null) { setFicha(f); setEventos(f.eventos ?? []) }
      if (membresiasRes.status === 'fulfilled') {
        setMembresias([...membresiasRes.value].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)))
      }
    }).finally(() => { setLoading(false); setLoadingMembresias(false) })
  }, [id])

  useEffect(() => {
    if (!id || turnosLoaded) return
    setLoadingTurnos(true)
    Promise.allSettled([
      inscripcionesApi.getByCliente(id),
      listaEsperaApi.getByCliente(id),
    ]).then(([inscRes, espRes]) => {
      if (inscRes.status === 'fulfilled') setInscripciones(inscRes.value)
      if (espRes.status === 'fulfilled') setListaEsperaCliente(espRes.value)
      setTurnosLoaded(true)
    }).finally(() => setLoadingTurnos(false))
  }, [id, turnosLoaded])

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
      const toNum = (v?: string) => { const n = parseFloat(v ?? ''); return isNaN(n) ? undefined : n }
      const [clientRes, fichaRes] = await Promise.allSettled([
        clientsApi.update(client.id, {
          name: data.name, lastName: data.lastName,
          email: data.email ?? '', phone: data.phone ?? '', cuil: data.cuil,
          sedeId: data.sedeId || null,
        }),
        clientsApi.updateFicha(client.id, {
          peso:            toNum(data.peso),
          altura:          toNum(data.altura),
          actividadDiaria: data.actividadDiaria || null,
          objetivos:       data.objetivos       || null,
          deportePractica: data.deportePractica  || null,
          experiencia:     data.experiencia      || null,
          lesiones:        data.lesiones         || null,
          patologiasBase:  data.patologiasBase   || null,
        }),
      ])
      if (clientRes.status === 'fulfilled') setClient(clientRes.value)
      if (fichaRes.status   === 'fulfilled') setFicha(fichaRes.value)
      addToast('Cliente actualizado', 'success')
      setIsEditing(false)
    } catch {
      addToast('Error al actualizar el cliente', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveEvento() {
    if (!client || !eventoForm || !eventoForm.nombre || !eventoForm.fecha) return
    setSavingEvento(true)
    try {
      if (editingEvento) {
        const updated = await clientsApi.updateEvento(String(client.id), editingEvento.id, eventoForm)
        setEventos(prev => prev.map(e => e.id === editingEvento.id ? updated : e))
        addToast('Evento actualizado', 'success')
      } else {
        const created = await clientsApi.createEvento(String(client.id), eventoForm)
        setEventos(prev => [...prev, created].sort((a, b) => a.fecha.localeCompare(b.fecha)))
        addToast('Evento agregado', 'success')
      }
      setEventoForm(null)
      setEditingEvento(null)
    } catch {
      addToast('Error al guardar el evento', 'error')
    } finally {
      setSavingEvento(false)
    }
  }

  async function handleDeleteEvento(eventoId: string) {
    if (!client) return
    try {
      await clientsApi.deleteEvento(String(client.id), eventoId)
      setEventos(prev => prev.filter(e => e.id !== eventoId))
      addToast('Evento eliminado', 'success')
    } catch {
      addToast('Error al eliminar el evento', 'error')
    }
  }

  function startEditEvento(ev: EventoDeportivo) {
    setEditingEvento(ev)
    setEventoForm({ nombre: ev.nombre, fecha: ev.fecha.slice(0, 10), observacion: ev.observacion ?? '' })
  }

  async function handleCreateMembresia() {
    if (!client) return
    setSavingMembresia(true)
    try {
      const precio = newMembresiaForm.precio ? parseFloat(newMembresiaForm.precio) : undefined
      const created = await membresiasClienteApi.create({
        clienteId: client.id,
        planId: newMembresiaForm.planId,
        modalidad: newMembresiaForm.modalidad,
        ...(precio !== undefined && !isNaN(precio) && { precio }),
        ...(newMembresiaForm.fechaInicio && { fechaInicio: newMembresiaForm.fechaInicio }),
      })
      setMembresias(prev => [created, ...prev].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)))
      addToast('Membresía creada', 'success')
      setNewMembresiaOpen(false)
      clientsApi.getById(client.id).then(c => setClient(c)).catch(() => {})
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al crear membresía', 'error')
    } finally {
      setSavingMembresia(false)
    }
  }

  async function handleCancelarMembresia(membresiaId: string) {
    if (!client) return
    try {
      const updated = await membresiasClienteApi.cancelar(membresiaId)
      setMembresias(prev => prev.map(m => m.id === membresiaId ? updated : m))
      addToast('Membresía cancelada', 'success')
      clientsApi.getById(client.id).then(c => setClient(c)).catch(() => {})
    } catch {
      addToast('Error al cancelar la membresía', 'error')
    }
  }

  async function handleEliminarMembresia(membresiaId: string) {
    if (!client) return
    try {
      await membresiasClienteApi.remove(membresiaId)
      setMembresias(prev => prev.filter(m => m.id !== membresiaId))
      addToast('Membresía eliminada', 'success')
      clientsApi.getById(client.id).then(c => setClient(c)).catch(() => {})
    } catch {
      addToast('Error al eliminar la membresía', 'error')
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
        <div className={`${glassCard} overflow-hidden`}>
          {/* Accent bar */}
          <div className={`h-1 w-full ${pulse}`} />

          {/* Contenedor 1: Header */}
          <div className="px-5 md:px-7 pt-5 md:pt-7 pb-3 md:pb-4">
            <div className="flex gap-5 items-center">
              <div className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl shrink-0 ${pulse}`} />
              <div className="flex-1 space-y-2.5 pt-1">
                <div className={`h-8 w-52 ${pulse}`} />
                <div className={`h-3.5 w-36 ${pulse}`} />
              </div>
              <div className={`h-7 w-20 rounded-lg shrink-0 ${pulse}`} />
            </div>
          </div>

          {/* Contenedor 2: Tablas */}
          <div className="px-5 md:px-7 pt-3 md:pt-4 pb-5 md:pb-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`h-44 rounded-2xl ${pulse}`} />
              <div className={`h-44 rounded-2xl ${pulse}`} />
            </div>
            <div className={`h-36 rounded-2xl ${pulse}`} />
          </div>
        </div>

        {/* Secciones */}
        {[1, 2, 3].map(i => (
          <div key={i} className={`${glassCard} p-6 space-y-4`} style={{ opacity: 1 - (i - 1) * 0.2 }}>
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-white/[0.06]">
              <div className={`h-10 w-10 rounded-xl shrink-0 ${pulse}`} />
              <div className="space-y-2">
                <div className={`h-4 w-40 ${pulse}`} />
                <div className={`h-3 w-28 ${pulse}`} />
              </div>
            </div>
            <div className="space-y-2">
              {[1, 2].map(j => (
                <div key={j} className={`h-14 rounded-xl ${pulse}`} style={{ opacity: 1 - (j - 1) * 0.3 }} />
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-500 dark:text-[#8A8A9A]">
        <p className="text-sm">Cliente no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft size={15} /> Volver
        </Button>
      </div>
    )
  }

  const initials = `${client.name.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase()
  const daysLeft = membershipDaysLeft(client.membershipExpiresAt)
  const progressPct = (() => {
    if (!client.membershipStartDate || !client.membershipExpiresAt) return 0
    const total = new Date(client.membershipExpiresAt).getTime() - new Date(client.membershipStartDate).getTime()
    const elapsed = Date.now() - new Date(client.membershipStartDate).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()
  const progressColor = daysLeft === null ? 'bg-gray-400' : daysLeft <= 0 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-amber-500' : 'bg-emerald-500'

  const lastPaymentDate = payments.length > 0 ? payments[0].paidAt : null

  const CUOTAS_POR_MODALIDAD: Record<string, number> = {
    TRANSFERENCIA_MENSUAL: 1, EFECTIVO: 1, MEMBRESIA_3_MESES: 3, MEMBRESIA_6_MESES: 6,
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
    PENDIENTE:  { label: 'Programada',  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500'   },
    ACTIVA:     { label: 'Activa',      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
    VENCIDA:    { label: 'Vencida',     color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10',    dot: 'bg-red-500'    },
    CANCELADA:  { label: 'Cancelada',   color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-500/10',   dot: 'bg-gray-400'   },
  }

  const planFreqGlobal = client?.planFrequency ? Number(client.planFrequency) : null
  const TABS: { value: Tab; label: string; count: number; sublabel?: string }[] = [
    { value: 'rutina', label: 'Rutina', count: rutinas.length },
    { value: 'turnos', label: 'Clases', count: 0, sublabel: planFreqGlobal ? `${inscripciones.length}/${planFreqGlobal}` : inscripciones.length > 0 ? String(inscripciones.length) : undefined },
    { value: 'asistencia', label: 'Asistencia', count: presentDays },
    { value: 'pagos', label: 'Pagos', count: payments.length },
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
      <div id="perfil" className={`${glassCard} overflow-hidden`}>
        {/* Accent bar (status color) */}
        <div className={`h-1 w-full ${statusBarColor(client.status)}`} />

        {/* ── Contenedor 1: Header ────────────────────────────────────────── */}
        <div className="px-5 md:px-7 pt-5 md:pt-7 pb-3 md:pb-4">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
            {/* Avatar */}
            <div className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-2xl md:text-3xl font-black shrink-0 ${avatarColors(client.status)}`}>
              {initials}
            </div>

            {/* Nombre + fecha + acciones */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                    {client.name} {client.lastName}
                  </h1>
                  <p className="text-sm text-gray-400 dark:text-[#8A8A9A] mt-1.5">
                    Miembro desde {formatDate(client.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge client={client} size="md" />
                  {isAdmin && (
                    isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { reset({ name: client.name, lastName: client.lastName, email: client.email ?? '', phone: client.phone ?? '', cuil: client.cuil ?? '', peso: ficha?.peso != null ? String(ficha.peso) : '', altura: ficha?.altura != null ? String(ficha.altura) : '', actividadDiaria: ficha?.actividadDiaria ?? '', objetivos: ficha?.objetivos ?? '', deportePractica: ficha?.deportePractica ?? '', experiencia: ficha?.experiencia ?? '', lesiones: ficha?.lesiones ?? '', patologiasBase: ficha?.patologiasBase ?? '' }); setIsEditing(false) }}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                        >
                          <XCircle size={12} />
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit(onEdit)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-black hover:bg-primary-dark transition-all disabled:opacity-60"
                        >
                          <CheckCircle2 size={12} />
                          {isSaving ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { reset({ name: client.name, lastName: client.lastName, email: client.email ?? '', phone: client.phone ?? '', cuil: client.cuil ?? '', peso: ficha?.peso != null ? String(ficha.peso) : '', altura: ficha?.altura != null ? String(ficha.altura) : '', actividadDiaria: ficha?.actividadDiaria ?? '', objetivos: ficha?.objetivos ?? '', deportePractica: ficha?.deportePractica ?? '', experiencia: ficha?.experiencia ?? '', lesiones: ficha?.lesiones ?? '', patologiasBase: ficha?.patologiasBase ?? '' }); setIsEditing(true) }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                      >
                        <Edit2 size={12} />
                        Editar
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ── Contenedor 2: Tablas de Datos ───────────────────────────────── */}
        <div className="px-5 md:px-7 pt-3 md:pt-4 pb-5 md:pb-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Tabla Izquierda: Datos Personales */}
                <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] overflow-hidden text-xs">
                  <div className="grid grid-cols-2 border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-2.5 font-bold text-gray-500 dark:text-[#8A8A9A]">
                    <span>Datos Personales</span>
                    <span>Valor</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">

                    {/* Filas editables */}
                    {([
                      { label: 'Nombre',   regKey: 'name'     as keyof EditValues, Icon: User,  placeholder: 'Sin nombre',   raw: client.name },
                      { label: 'Apellido', regKey: 'lastName' as keyof EditValues, Icon: User,  placeholder: 'Sin apellido', raw: client.lastName },
                      { label: 'CUIL',     regKey: 'cuil'     as keyof EditValues, Icon: Hash,  placeholder: 'Sin CUIL',     raw: client.cuil },
                      { label: 'Email',    regKey: 'email'    as keyof EditValues, Icon: Mail,  placeholder: 'Sin email',    raw: client.email },
                      { label: 'Teléfono', regKey: 'phone'    as keyof EditValues, Icon: Phone, placeholder: 'Sin teléfono', raw: client.phone },
                    ]).map(({ label, regKey, Icon, placeholder, raw }) => (
                      <div key={regKey} className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                        <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                          <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                          {label}
                        </span>
                        {isEditing ? (
                          <div className="flex flex-col gap-0.5">
                            <input
                              className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                              {...register(regKey)}
                            />
                            {errors[regKey] && (
                              <span className="text-red-400 text-[10px] leading-tight">{errors[regKey]?.message}</span>
                            )}
                          </div>
                        ) : (
                          <span className="pt-0.5 truncate">
                            {regKey === 'email' && raw ? (
                              <a href={`mailto:${raw}`} className="text-primary hover:underline font-semibold transition-all">{raw}</a>
                            ) : regKey === 'phone' && raw ? (
                              <a href={`https://wa.me/54${raw.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">{raw}</a>
                            ) : raw ? (
                              <span className="text-gray-900 dark:text-white font-semibold">{raw}</span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
                            )}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Estado — solo lectura */}
                    <div className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-center">
                      <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 size={12} className="opacity-60 text-gray-400 dark:text-gray-500" />
                        Estado
                      </span>
                      <StatusBadge client={client} size="sm" />
                    </div>

                    {/* Sede */}
                    <div className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-center">
                      <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold">
                        <MapPin size={12} className="opacity-60 text-gray-400 dark:text-gray-500" />
                        Sede
                      </span>
                      {isEditing ? (
                        <select
                          className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                          {...register('sedeId')}
                        >
                          <option value="">— Sin sede —</option>
                          {sedes.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={client.sede ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400 dark:text-gray-500'}>
                          {client.sede?.nombre ?? 'Sin sede'}
                        </span>
                      )}
                    </div>

                  </div>
                </div>

                {/* Tabla Derecha: Resumen de Membresía */}
                <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] overflow-hidden text-xs">
                  <div className="grid grid-cols-2 border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-2.5 font-bold text-gray-500 dark:text-[#8A8A9A]">
                    <span>Resumen de Membresía</span>
                    <span>Detalle</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-100 dark:divide-white/[0.04]">
                    {(() => {
                      const hasActiveMembership = !!(client.planName && client.membershipStatus !== 'CANCELADA')
                      return [
                        {
                          label: 'Plan',
                          value: hasActiveMembership ? formatPlanName(client.planName!) : 'Sin membresía activa',
                          icon: Dumbbell,
                          color: hasActiveMembership ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-400 dark:text-[#8A8A9A] font-semibold'
                        },
                        {
                          label: 'Modalidad',
                          value: hasActiveMembership && client.membershipModalidad ? MODALIDAD_LABELS[client.membershipModalidad] ?? client.membershipModalidad : '—',
                          icon: Clock,
                          color: hasActiveMembership ? 'text-gray-700 dark:text-gray-300 font-semibold' : 'text-gray-400 dark:text-[#8A8A9A]'
                        },
                        {
                          label: 'Precio',
                          value: hasActiveMembership && client.membershipPrecio != null ? formatCurrency(client.membershipPrecio) : '—',
                          icon: Banknote,
                          color: hasActiveMembership ? 'text-primary font-bold' : 'text-gray-400 dark:text-[#8A8A9A]'
                        },
                        {
                          label: 'Vencimiento',
                          value: !hasActiveMembership ? '—' : daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} días restantes` : 'Finalizada') : 'Sin fecha',
                          icon: CalendarDays,
                          color: !hasActiveMembership ? 'text-gray-400 dark:text-[#8A8A9A]' : daysLeft !== null ? (daysLeft <= 0 ? 'text-red-500 dark:text-red-400 font-semibold' : daysLeft <= 30 ? 'text-amber-500 dark:text-amber-400 font-semibold' : 'text-emerald-500 dark:text-emerald-400 font-semibold') : 'text-gray-500 dark:text-[#8A8A9A]'
                        }
                      ]
                    })().map((row, idx) => {
                      const Icon = row.icon
                      return (
                        <div key={idx} className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-center">
                          <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold">
                            <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500" />
                            {row.label}
                          </span>
                          <span className={`${row.color} truncate`}>
                            {row.value}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
          </div>

          {/* ── Ficha + Calendario en grid ──────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Ficha de Entrenamiento */}
            <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] overflow-hidden text-xs">
              <div className="grid grid-cols-2 border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-2.5 font-bold text-gray-500 dark:text-[#8A8A9A]">
                <span>Ficha de Entrenamiento</span>
                <span>Detalle</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/[0.04]">
                {/* Columna izquierda */}
                <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {/* Actividad diaria */}
                  <div className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                    <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                      <Activity size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                      Actividad
                    </span>
                    {isEditing ? (
                      <select
                        className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                        {...register('actividadDiaria')}
                      >
                        {ACTIVIDAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <span className={ficha?.actividadDiaria ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                        {ficha?.actividadDiaria ? (ACTIVIDAD_LABELS[ficha.actividadDiaria] ?? ficha.actividadDiaria) : '—'}
                      </span>
                    )}
                  </div>
                  {/* Objetivos */}
                  {([
                    { label: 'Objetivos', regKey: 'objetivos' as const, Icon: Tag,      raw: ficha?.objetivos },
                    { label: 'Deporte',   regKey: 'deportePractica' as const, Icon: Dumbbell, raw: ficha?.deportePractica },
                    { label: 'Experiencia', regKey: 'experiencia' as const, Icon: BookOpen, raw: ficha?.experiencia },
                  ]).map(({ label, regKey, Icon, raw }) => (
                    <div key={regKey} className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                      <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                        <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                        {label}
                      </span>
                      {isEditing ? (
                        <input
                          className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                          {...register(regKey)}
                        />
                      ) : (
                        <span className={raw ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                          {raw ?? '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Columna derecha */}
                <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                  {/* Peso y Altura con unidades */}
                  {([
                    { label: 'Peso',   regKey: 'peso'   as const, Icon: Activity, unit: 'kg', raw: ficha?.peso   && ficha.peso   > 20 ? `${ficha.peso} kg`   : null },
                    { label: 'Altura', regKey: 'altura' as const, Icon: Activity, unit: 'cm', raw: ficha?.altura && ficha.altura > 50 ? `${ficha.altura} cm` : null },
                  ]).map(({ label, regKey, Icon, unit, raw }) => (
                    <div key={regKey} className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                      <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                        <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                        {label}
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                            {...register(regKey)}
                          />
                          <span className="text-gray-400 shrink-0">{unit}</span>
                        </div>
                      ) : (
                        <span className={raw ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                          {raw ?? '—'}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Lesiones y Patologías */}
                  {([
                    { label: 'Lesiones',   regKey: 'lesiones'  as const, Icon: AlertTriangle, raw: ficha?.lesiones },
                    { label: 'Patologías', regKey: 'patologiasBase' as const, Icon: Receipt,  raw: ficha?.patologiasBase },
                  ]).map(({ label, regKey, Icon, raw }) => (
                    <div key={regKey} className="grid grid-cols-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                      <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                        <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                        {label}
                      </span>
                      {isEditing ? (
                        <input
                          className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                          {...register(regKey)}
                        />
                      ) : (
                        <span className={raw ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                          {raw ?? '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Calendario Deportivo */}
            <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]">
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-[#8A8A9A]">
                  <Trophy size={12} className="opacity-70" />
                  Calendario Deportivo
                </span>
                {isAdmin && !eventoForm && (
                  <button
                    onClick={() => { setEditingEvento(null); setEventoForm({ nombre: '', fecha: '', observacion: '' }) }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-dark transition-colors"
                  >
                    <Plus size={11} /> Agregar
                  </button>
                )}
              </div>

              {/* Formulario nuevo/editar evento */}
              {eventoForm && (
                <div className="px-4 py-3 border-b border-gray-200/60 dark:border-white/[0.06] bg-primary/[0.03] flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Nombre</label>
                    <input
                      autoFocus
                      value={eventoForm.nombre}
                      onChange={e => setEventoForm(f => f ? { ...f, nombre: e.target.value } : f)}
                      placeholder="Ej: Torneo provincial"
                      className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Fecha</label>
                    <input
                      type="date"
                      value={eventoForm.fecha}
                      onChange={e => setEventoForm(f => f ? { ...f, fecha: e.target.value } : f)}
                      className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Observación</label>
                    <input
                      value={eventoForm.observacion}
                      onChange={e => setEventoForm(f => f ? { ...f, observacion: e.target.value } : f)}
                      placeholder="Opcional"
                      className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setEventoForm(null); setEditingEvento(null) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 dark:border-white/[0.1] text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
                    >
                      <XCircle size={11} /> Cancelar
                    </button>
                    <button
                      onClick={handleSaveEvento}
                      disabled={savingEvento || !eventoForm.nombre || !eventoForm.fecha}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-primary text-black hover:bg-primary-dark disabled:opacity-50 transition-all"
                    >
                      <Save size={11} /> {savingEvento ? 'Guardando…' : editingEvento ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de eventos */}
              {eventos.length === 0 && !eventoForm ? (
                <div className="px-4 py-4 text-center text-xs text-gray-400 dark:text-[#4B4B5A]">
                  Sin eventos registrados
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {eventos.map(ev => {
                    const evDate  = parseISO(ev.fecha)
                    const isPast  = evDate < new Date()
                    const isEditing = editingEvento?.id === ev.id
                    return (
                      <div
                        key={ev.id}
                        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          isEditing
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : isPast
                            ? 'border-gray-200 dark:border-white/[0.08] bg-gray-100/60 dark:bg-white/[0.03] text-gray-400 dark:text-[#4B4B5A]'
                            : 'border-primary/30 bg-primary/10 dark:bg-primary/[0.08] text-gray-800 dark:text-white'
                        }`}
                      >
                        <Trophy size={10} className={isPast ? 'opacity-40' : 'text-primary'} />
                        <span>{ev.nombre}</span>
                        <span className={`text-[10px] ${isPast ? 'opacity-50' : 'opacity-70'}`}>
                          {format(evDate, "d MMM yyyy", { locale: es })}
                        </span>
                        {isAdmin && !eventoForm && (
                          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditEvento(ev)} className="p-0.5 rounded hover:text-primary transition-colors">
                              <Edit2 size={10} />
                            </button>
                            <button onClick={() => handleDeleteEvento(ev.id)} className="p-0.5 rounded hover:text-red-400 transition-colors">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ─── CONTENEDOR PRINCIPAL CON SIDEBAR INDEX FIJO PEgado a la pared izquierda ──────────────────────── */}
      <div className="relative w-full mt-6">
        {/* Sidebar Index — colapsable desde la izquierda */}
        <div
          className="hidden lg:block fixed left-4 xl:left-6 top-[32vh] z-30 transition-transform duration-300 ease-in-out"
          style={{ transform: navOpen ? 'translateX(0)' : 'translateX(calc(-100% + 12px))' }}
        >
          <div className="relative w-32 xl:w-40 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-black/50 backdrop-blur-2xl shadow-lg">

            {/* Flecha — borde derecho integrado, sin separador */}
            <button
              onClick={() => setNavOpen(v => !v)}
              className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center rounded-r-2xl hover:bg-primary/10 transition-colors"
              title={navOpen ? 'Ocultar' : 'Mostrar navegación'}
            >
              <ChevronRight
                size={11}
                className={`text-gray-400 dark:text-[#6A6A7A] transition-transform duration-300 ${navOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Contenido */}
            <div className="p-4 pr-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#6A6A7A] mb-3 px-1">
                Navegación
              </p>
              <div className="space-y-1">
                {[
                  { id: 'perfil',      label: 'Perfil',      icon: User       },
                  { id: 'rutinas',     label: 'Rutinas',     icon: BookOpen   },
                  { id: 'clases',      label: 'Clases',      icon: Dumbbell   },
                  { id: 'asistencia',  label: 'Asistencia',  icon: Activity   },
                  { id: 'membresias',  label: 'Membresías',  icon: Tag        },
                  { id: 'pagos',       label: 'Pagos',       icon: CreditCard },
                ].map(item => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="w-full flex items-center gap-2 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all text-left text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                    >
                      <Icon size={13} className="shrink-0 opacity-60" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bloque de Secciones de Contenido (Offset to clear the fixed sidebar) */}
        <div className="w-full space-y-6">
          {/* ─── SECCIÓN 1: RUTINAS ────────────────────────────────────────── */}
          <div id="rutinas" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Rutinas de Entrenamiento</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Planificación de rutinas y ejercicios del cliente</p>
                </div>
              </div>
              {(isAdmin || user?.role === 'profesor') && (
                <button
                  onClick={() => navigate(`/rutinas/crear?clienteId=${id}`)}
                  className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
                >
                  <Plus size={13} /> Nueva rutina
                </button>
              )}
            </div>

            {loadingRutinas ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <Skeleton className="h-4 w-28 rounded-lg" />
                  <Skeleton className="h-[140px] w-full rounded-2xl" />
                </div>
                <div className="lg:col-span-1 space-y-3">
                  <Skeleton className="h-4 w-36 rounded-lg" />
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                </div>
              </div>
            ) : rutinas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
                  <BookOpen size={20} className="text-gray-400 dark:text-[#8A8A9A]" />
                </div>
                <p className="text-sm text-gray-500 dark:text-[#8A8A9A]">Sin rutinas registradas</p>
                {(isAdmin || user?.role === 'profesor') && (
                  <button
                    onClick={() => navigate(`/rutinas/crear?clienteId=${id}`)}
                    className="text-xs text-primary hover:underline"
                  >
                    Crear la primera rutina →
                  </button>
                )}
              </div>
            ) : (() => {
              const activa = rutinas.find(r => r.activa)
              const inactivas = rutinas.filter(r => !r.activa)
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Rutina Activa (Izquierda/Main) */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] mb-1 px-1">Rutina Activa</h4>
                    {activa ? (
                      <div
                        onClick={() => navigate(`/clients/${id}/rutina?rid=${activa.id}`)}
                        className="group relative flex flex-col justify-between p-5 rounded-2xl border border-primary/20 bg-primary/[0.02] hover:bg-primary/[0.04] transition-all cursor-pointer overflow-hidden min-h-[140px]"
                      >
                        <div className="absolute inset-y-0 left-0 w-[4px] bg-primary rounded-full" />
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h5 className="text-base font-black text-gray-900 dark:text-white group-hover:text-primary transition-colors">{activa.nombre}</h5>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/25 shrink-0">
                              Activa
                            </span>
                          </div>
                          {activa.descripcion && (
                            <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-2 line-clamp-2">{activa.descripcion}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8A8A9A] pt-4 mt-4 border-t border-gray-100 dark:border-white/[0.05]">
                          <span>
                            {(activa.semanas ?? []).reduce((acc, s) => acc + (s.sesiones ?? []).reduce((a, ses) => a + (ses.bloques ?? []).reduce((b, bl) => b + (bl.ejerciciosPlan ?? []).length, 0), 0), 0)} ejercicios
                          </span>
                          <span>
                            {(activa.semanas ?? []).length} semana{(activa.semanas ?? []).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl min-h-[140px] text-center text-gray-400 dark:text-[#8A8A9A]">
                        <AlertTriangle size={20} className="mb-2 text-amber-500/80" />
                        <p className="text-xs font-semibold">No hay una rutina activa</p>
                        <p className="text-[10px] opacity-60">Activá una rutina desde el gestor o creá una nueva.</p>
                      </div>
                    )}
                  </div>

                  {/* Rutinas Inactivas/Viejas (Derecha/Chico) */}
                  <div className="lg:col-span-1 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] mb-1 px-1">Historial / Inactivas</h4>
                    {inactivas.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-[#6A6A7A] italic px-1">No hay rutinas inactivas.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {inactivas.map((rutina: Rutina) => (
                          <div
                            key={rutina.id}
                            onClick={() => navigate(`/clients/${id}/rutina?rid=${rutina.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.05] bg-white/40 dark:bg-white/[0.01] hover:bg-white/70 dark:hover:bg-white/[0.04] transition-all text-left cursor-pointer group"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gray-500/10 flex items-center justify-center shrink-0">
                              <BookOpen size={13} className="text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{rutina.nombre}</p>
                              <p className="text-[10px] text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                                {(rutina.semanas ?? []).length} sem.
                              </p>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 dark:text-[#8A8A9A] shrink-0">
                              Inactiva
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ─── SECCIÓN 2: CLASES ─────────────────────────────────────────── */}
          <div id="clases" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Dumbbell size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Clases y Turnos</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Inscripciones a clases y reservas semanales</p>
                </div>
              </div>
            </div>

            {(() => {
              const totalDiasUsados = inscripciones.reduce((acc, i) => acc + i.dias.length, 0)
              const planFreq = client.planFrequency ? Number(client.planFrequency) : null
              const limiteAlcanzado = !loadingTurnos && !!planFreq && totalDiasUsados >= planFreq
              return (
                <div className="flex flex-col">
                  {/* Encabezado inscripciones */}
                  <div className="flex items-center justify-between px-1 py-1 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">
                      Inscripciones activas
                      {!loadingTurnos && (
                        <span className="ml-1.5 tabular-nums text-gray-400 dark:text-white/40">{inscripciones.length}{planFreq ? `/${planFreq}` : ''}</span>
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
                      <div className="mt-2 mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-sm px-4 py-3">
                        <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 dark:text-red-300 leading-snug">
                          Límite alcanzado — el plan permite <span className="font-semibold">{planFreq} día{planFreq !== 1 ? 's' : ''} por semana</span> y ya tiene <span className="font-semibold">{totalDiasUsados} asignado{totalDiasUsados !== 1 ? 's' : ''}</span>. No se pueden agregar más.
                        </p>
                      </div>
                    ) : totalDiasUsados === planFreq - 1 ? (
                      <div className="mt-2 mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm px-4 py-3">
                        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                          Queda <span className="font-semibold">1 día disponible</span> según el plan ({planFreq} días/semana).
                        </p>
                      </div>
                    ) : null
                  )}

                  {/* Lista de inscripciones */}
                  {loadingTurnos ? (
                    <div className="divide-y divide-gray-100 dark:divide-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden bg-white/50 dark:bg-white/[0.01]">
                      {[1, 2].map(i => (
                        <div key={i} className="flex items-center gap-4 px-5 py-4">
                          <div className="h-11 w-11 rounded-2xl animate-pulse bg-gray-200/80 dark:bg-white/[0.07] shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-36 animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded" />
                            <div className="h-3 w-24 animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded" />
                          </div>
                          <div className="h-7 w-24 animate-pulse bg-gray-200/80 dark:bg-white/[0.07] rounded-xl shrink-0 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : inscripciones.length === 0 ? (
                    <div className="border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-6 bg-white/40 dark:bg-white/[0.01]">
                      <EmptyState icon={Dumbbell} message="Sin turnos asignados" />
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden bg-white/50 dark:bg-white/[0.01]">
                      {inscripciones.map(insc => (
                        <div key={insc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-100 dark:hover:bg-black/50 transition-colors">
                          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Dumbbell size={20} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {insc.horaInicio} – {insc.horaFin}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${insc.sala === 'A'
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                : 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                                }`}>
                                Sala {insc.sala}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">
                              {insc.dias.map(d => DIA_SHORT[d.toLowerCase()] ?? d).join(' · ')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDarDeBaja(insc.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-400 shrink-0 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/10"
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
                    <div className="mt-5">
                      <div className="flex items-center px-1 py-1 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">
                          Lista de espera
                          <span className="ml-1.5 tabular-nums text-gray-400 dark:text-white/40">{listaEsperaCliente.length}</span>
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-white/[0.06] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden bg-white/50 dark:bg-white/[0.01]">
                        {listaEsperaCliente.map(entry => (
                          <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-100 dark:hover:bg-black/50 transition-colors">
                            <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                              <Clock size={20} className="text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {entry.horaInicio} – {entry.horaFin}
                                </p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.estado === 'PENDIENTE'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  }`}>
                                  {entry.estado === 'PENDIENTE' ? 'Pendiente' : 'Notificado'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">
                                {entry.dias.map(d => DIA_SHORT[d.toLowerCase()] ?? d).join(' · ')}
                              </p>
                            </div>
                            <button
                              onClick={() => handleCancelarEspera(entry.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-red-500 shrink-0 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-all border border-transparent hover:border-white/5"
                            >
                              <XCircle size={13} />
                              Cancelar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* ─── SECCIÓN 3: ASISTENCIA ───────────────────────────────────────── */}
          <div id="asistencia" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Asistencia y Estadísticas</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Registro de ingresos y estadísticas de asistencia</p>
                </div>
              </div>
            </div>

            {attendance.length === 0 ? (
              <div className="border border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-6 bg-white/40 dark:bg-white/[0.01]">
                <EmptyState icon={Activity} message="Sin registros de asistencia" />
              </div>
            ) : (
              <AttendanceTabContent attendance={attendance} />
            )}
          </div>

          {/* ─── SECCIÓN 4: MEMBRESÍAS ──────────────────────────────────────────── */}
          <div id="membresias" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Tag size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Membresías</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Historial completo de membresías del cliente</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setNewMembresiaOpen(true)}
                  className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
                >
                  <Plus size={13} /> Nueva membresía
                </button>
              )}
            </div>

            {loadingMembresias ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : membresias.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
                  <Tag size={20} className="text-gray-400 dark:text-[#8A8A9A]" />
                </div>
                <p className="text-sm text-gray-500 dark:text-[#8A8A9A]">Sin membresías registradas</p>
                {isAdmin && (
                  <button onClick={() => setNewMembresiaOpen(true)} className="text-xs text-primary hover:underline transition-colors">
                    Crear la primera membresía →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {membresias.map(m => {
                  const statusCfg = MEMBRESIA_STATUS_CONFIG[m.estado] ?? MEMBRESIA_STATUS_CONFIG.CANCELADA
                  const daysLeftM = Math.ceil((new Date(m.fechaVencimiento).getTime() - Date.now()) / 86_400_000)
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.01] px-5 py-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{m.plan.nombre}</p>
                          <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-0.5">
                            {MODALIDAD_LABELS[m.modalidad] ?? m.modalidad} · {formatDate(m.fechaInicio)} → {formatDate(m.fechaVencimiento)}
                            {m.estado === 'ACTIVA' && daysLeftM > 0 && (
                              <span className={`ml-1.5 font-semibold ${daysLeftM <= 7 ? 'text-red-400' : daysLeftM <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                ({daysLeftM} días restantes)
                              </span>
                            )}
                            {m.estado === 'PENDIENTE' && (
                              <span className="ml-1.5 font-semibold text-blue-400">
                                (inicia en {Math.ceil((new Date(m.fechaInicio).getTime() - Date.now()) / 86_400_000)} días)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(m.precio)}
                        </span>
                        {isAdmin && (m.estado === 'ACTIVA' || m.estado === 'PENDIENTE') && (
                          <button
                            onClick={() => handleCancelarMembresia(m.id)}
                            className="text-xs font-semibold text-gray-400 hover:text-amber-400 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
                          >
                            Cancelar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleEliminarMembresia(m.id)}
                            className="text-xs font-semibold text-gray-400 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── SECCIÓN 5: PAGOS Y FACTURACIÓN ───────────────────────────────────── */}
          <div id="pagos" className={`${glassCard} p-6 space-y-6 scroll-mt-24`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Pagos y Facturación</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Membresía activa, cronograma de cuotas e historial de pagos</p>
                </div>
              </div>
            </div>

            {(client.planName && client.membershipStatus !== 'CANCELADA') ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Izquierda/Centro: Información de la Membresía y Cronograma de Cuotas */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] overflow-hidden">
                    {/* Header: nombre del plan + badge estado */}
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#5A5A6A] mb-0.5">Plan</p>
                        <h4 className="text-base font-black text-gray-900 dark:text-white leading-tight">{client.planName}</h4>
                        {client.planFrequency && (
                          <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5 flex items-center gap-1">
                            <CalendarDays size={11} />
                            {client.planFrequency} clase{Number(client.planFrequency) !== 1 ? 's' : ''} por semana
                          </p>
                        )}
                      </div>
                      {client.membershipStatus && MEMBRESIA_STATUS_CONFIG[client.membershipStatus] && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${MEMBRESIA_STATUS_CONFIG[client.membershipStatus].bg} ${MEMBRESIA_STATUS_CONFIG[client.membershipStatus].color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${MEMBRESIA_STATUS_CONFIG[client.membershipStatus].dot}`} />
                          {MEMBRESIA_STATUS_CONFIG[client.membershipStatus].label}
                        </span>
                      )}
                    </div>

                    {/* Stat strip: Frecuencia · Modalidad · Precio */}
                    <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/[0.06] border-t border-gray-100 dark:border-white/[0.06]">
                      {[
                        {
                          label: 'Frecuencia',
                          value: client.planFrequency ? `${client.planFrequency}× / sem.` : '—',
                          className: 'text-gray-900 dark:text-white font-black',
                        },
                        {
                          label: 'Modalidad',
                          value: client.membershipModalidad ? (MODALIDAD_LABELS[client.membershipModalidad] ?? client.membershipModalidad) : '—',
                          className: 'text-gray-900 dark:text-white font-bold leading-tight',
                        },
                        {
                          label: 'Precio',
                          value: client.membershipPrecio != null ? formatCurrency(client.membershipPrecio) : '—',
                          className: 'text-primary font-black tabular-nums',
                        },
                      ].map(({ label, value, className }) => (
                        <div key={label} className="px-4 py-3 text-center">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-[#5A5A6A] mb-1">{label}</p>
                          <p className={`text-sm ${className}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Barra de progreso */}
                    {progressPct > 0 && (
                      <div className="px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 dark:text-[#5A5A6A]">
                            {client.membershipStartDate ? formatDate(client.membershipStartDate) : '—'}
                            {' → '}
                            {client.membershipExpiresAt ? formatDate(client.membershipExpiresAt) : '—'}
                          </span>
                          {daysLeft !== null && (
                            <span className={`text-xs font-bold ${daysLeft <= 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {daysLeft > 0 ? `${daysLeft} días restantes` : 'Finalizada'}
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.07] overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cronograma de Cuotas */}
                  {cuotasSchedule.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                          Cronograma de Cuotas ({cuotasSchedule.length} mensual{cuotasSchedule.length !== 1 ? 'es' : ''})
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-[#8A8A9A]">
                          {cuotasSchedule.filter(c => c.pago).length} de {cuotasSchedule.length} abonadas
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cuotasSchedule.map(c => (
                          <div
                            key={c.numero}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-all ${c.pago
                              ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-500/[0.03]'
                              : 'border-gray-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.01]'
                              }`}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-bold leading-none ${c.pago ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#6A6A7A]'}`}>
                                Cuota {c.numero}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-1.5">
                                {c.pago
                                  ? `Abonada el ${formatDate(c.pago.paidAt)}`
                                  : `Vence el ${format(c.fechaEsperada, "d 'de' MMMM", { locale: es })}`
                                }
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.pago ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                                    {formatCurrency(c.pago.amount)}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-500 mt-1">Abonada</span>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/50 dark:bg-white/[0.04] text-gray-400 dark:text-[#5A5A6A]">
                                  Pendiente
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Historial de Pagos */}
                <div className="lg:col-span-1 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] mb-1 px-1">Historial de Pagos</h4>
                  {payments.length === 0 ? (
                    <EmptyState icon={CreditCard} message="Sin pagos registrados" />
                  ) : (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {payments.map(p => {
                        const cfg = METHOD_CONFIG[p.method] ?? METHOD_CONFIG.cash
                        const MethodIcon = cfg.Icon
                        return (
                          <div
                            key={p.id}
                            onClick={() => navigate(`/payments/${p.id}`)}
                            className="group p-3 rounded-xl border border-gray-200 dark:border-white/[0.05] bg-white/40 dark:bg-white/[0.01] hover:bg-white/70 dark:hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                <MethodIcon size={13} className={cfg.color} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{cfg.label}</p>
                                <p className="text-[10px] text-gray-400 dark:text-[#6A6A7A] mt-0.5">{formatDate(p.paidAt)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                                {formatCurrency(p.amount)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-5 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
                <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center shrink-0">
                  <CreditCard size={16} className="text-gray-400 dark:text-[#6A6A7A]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Sin membresía activa</p>
                  <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">Este cliente no tiene una membresía asignada.</p>
                </div>
              </div>
            )}
          </div>
          <div className="h-[35vh]" />
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
                <span className="text-sm font-semibold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A] border border-gray-200 dark:border-white/[0.08]">
                  {MODALIDAD_LABELS[client.membershipModalidad] ?? client.membershipModalidad}
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
                <div key={label} className="rounded-2xl bg-white/50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3">
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mb-1">{label}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Barra de progreso */}
            {progressPct > 0 && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500 dark:text-[#8A8A9A]">Período transcurrido</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── MODAL NUEVA MEMBRESÍA ───────────────────────────────────────────── */}
      <Modal isOpen={newMembresiaOpen} onClose={() => setNewMembresiaOpen(false)} title="Nueva membresía" size="md">
        <div className="space-y-4">
          {/* Plan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Plan</label>
            {loadingPlanes ? (
              <Skeleton className="h-10 w-full rounded-xl" />
            ) : (
              <select
                value={newMembresiaForm.planId}
                onChange={e => setNewMembresiaForm(f => ({ ...f, planId: e.target.value }))}
                className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
              >
                <option value="">— Seleccionar plan —</option>
                {planes.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.classesPerWeek}× / sem.)</option>
                ))}
              </select>
            )}
          </div>

          {/* Modalidad */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">Modalidad</label>
            <select
              value={newMembresiaForm.modalidad}
              onChange={e => setNewMembresiaForm(f => ({ ...f, modalidad: e.target.value as Modalidad }))}
              className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
            >
              {MODALIDADES.map(m => (
                <option key={m} value={m}>{MODALIDAD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {/* Precio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">
              Precio (ARS)
            </label>
            <input
              type="number"
              value={newMembresiaForm.precio}
              onChange={e => setNewMembresiaForm(f => ({ ...f, precio: e.target.value }))}
              placeholder="Se carga desde la tarifa vigente"
              className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
            />
          </div>

          {/* Fecha inicio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] uppercase tracking-wider">
              Fecha de inicio
              <span className="normal-case ml-1 font-normal text-gray-400">(sugerida automáticamente)</span>
            </label>
            <input
              type="date"
              value={newMembresiaForm.fechaInicio}
              onChange={e => setNewMembresiaForm(f => ({ ...f, fechaInicio: e.target.value }))}
              className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
            />
          </div>

          {/* Vencimiento calculado */}
          {newMembresiaForm.fechaInicio && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/[0.04] border border-primary/20">
              <CalendarDays size={13} className="text-primary shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Vencimiento calculado: <strong className="text-gray-900 dark:text-white">{calcVencimiento(newMembresiaForm.fechaInicio, newMembresiaForm.modalidad)}</strong>
              </span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setNewMembresiaOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateMembresia}
              disabled={savingMembresia || !newMembresiaForm.planId}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary-dark disabled:opacity-50 transition-all"
            >
              {savingMembresia ? 'Creando…' : 'Crear membresía'}
            </button>
          </div>
        </div>
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
              <p className="text-xs text-gray-500 dark:text-[#8A8A9A] leading-snug max-w-[260px]">
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
                  <div key={shift.id} className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {shift.startTime} – {shift.endTime}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-0.5">
                          {shift.days.map(d => WEEKDAY_SHORT[d] ?? d).join(' · ')}
                          {shift.profesorNombre && (
                            <span className="ml-2 opacity-60">· {shift.profesorNombre}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['A', 'B'] as const).map(sala => {
                        const insc = sala === 'A' ? shift.inscritosA : shift.inscritosB
                        const cupo = sala === 'A' ? shift.cupoMaximoSalaA : shift.cupoMaximoSalaB
                        const lleno = insc >= cupo
                        const loading = enrollingId === (String(shift.id) + sala)
                        return (
                          <button
                            key={sala}
                            disabled={lleno || !!enrollingId}
                            onClick={() => handleEnroll(String(shift.id), sala)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${lleno
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
                        <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-0.5">
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

    </motion.div>
  )
}
