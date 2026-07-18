import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainerFast, fadeUpItem } from '../lib/motion'
import {
  ArrowLeft, Phone, Mail, CalendarDays, CheckCircle2, XCircle,
  Edit2, CreditCard, Activity, Clock, Hash, Banknote, ArrowLeftRight,
  MessageCircle, Tag, Dumbbell, BookOpen, Plus, ChevronDown, ChevronRight, ChevronLeft,
  BarChart2, PieChart as PieIcon, LineChart as LineChartIcon,
  Receipt, AlertTriangle, MapPin, User, Trophy, Trash2, Save,
  CalendarX2, CalendarCheck2, RefreshCw, Check, ExternalLink, UserX, UserCheck, Shield,
} from 'lucide-react'
import { format, parseISO, addDays, isValid, type Locale } from 'date-fns'
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
import { reposicionesApi } from '../api/reposiciones.api'
import type { AusenciaTurno } from '../types/reposicion.types'
import ReposicionDrawer from '../components/reposiciones/ReposicionDrawer'
import { membresiasClienteApi } from '../api/membresiasCliente.api'
import { membershipsApi } from '../api/memberships.api'
import { inscripcionesApi } from '../api/inscripciones.api'
import type { InscripcionClienteEntry } from '../api/inscripciones.api'
import { listaEsperaApi } from '../api/listaEspera.api'
import type { ListaEsperaClienteEntry } from '../api/listaEspera.api'
import { shiftsApi } from '../api/shifts.api'
import { configuracionSistemaApi } from '../api/configuracion-sistema.api'
import type { Shift } from '../types/shift.types'
import { useRutinas } from '../hooks/useRutinas'
import { usePermissions } from '../hooks/usePermissions'
import type { Rutina } from '../types/rutina.types'
import { rutinasApi } from '../api/rutinas.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
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
  cuil:     z.string().optional(),
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
  // condición especial
  exentoDePago:   z.boolean().optional(),
  motivoExencion: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  // responsable (menores)
  responsableNombre:    z.string().optional(),
  responsableCuil:      z.string().optional(),
  responsableContacto:  z.string().optional(),
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
  if (status === 'debt') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return 'bg-gray-200/60 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400'
}

function statusBarColor(status: Client['status']) {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'expiring') return 'bg-amber-500'
  if (status === 'debt') return 'bg-amber-500'
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
function getStatusTooltip(client: Client, diasGracia?: number): string | null {
  if (client.status === 'active') return null
  if (client.status === 'expiring') {
    if (!client.membershipExpiresAt) return 'No tiene ninguna membresía activa registrada.'
    const exp  = new Date(client.membershipExpiresAt)
    const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
    const fecha = format(exp, "d 'de' MMMM 'de' yyyy", { locale: es })
    let base = ''
    if (days < 0)  base = `La membresía venció el ${fecha} (hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}).`
    else if (days === 0) base = 'La membresía vence hoy.'
    else base = `La membresía vence el ${fecha} — quedan ${days} día${days !== 1 ? 's' : ''}.`

    if (days < 0 && diasGracia !== undefined) {
      const inicioMesSig = new Date(exp.getFullYear(), exp.getMonth() + 1, 1)
      inicioMesSig.setDate(inicioMesSig.getDate() + diasGracia)
      if (new Date() < inicioMesSig) {
        base += ` Se inactiva automáticamente el ${format(inicioMesSig, "d/MM")}.`
      }
    }
    return base
  }
  return null
}

function StatusBadge({ client, size = 'md', diasGracia }: { client: Client; size?: 'sm' | 'md'; diasGracia?: number }) {
  const tooltip = getStatusTooltip(client, diasGracia)
  const paddingCls = size === 'sm' ? 'px-2 py-0.5 rounded-full font-semibold' : 'px-2.5 py-1.5 rounded-lg font-medium'

  // Badge de actividad: ACTIVO / INACTIVO
  const activityCls = client.activityStatus === 'inactive'
    ? 'bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50'
    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
  const activityDot = client.activityStatus === 'inactive' ? 'bg-gray-400' : 'bg-emerald-500'
  const activityLabel = client.activityStatus === 'inactive' ? 'INACTIVO' : 'ACTIVO'

  // Badge de estado de pago: AL DÍA / VENCIDA
  const paymentCls =
    client.status === 'active'   ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
    : client.status === 'expiring' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    : client.status === 'debt'     ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    : 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20'
  const paymentDot =
    client.status === 'active'   ? 'bg-emerald-500'
    : client.status === 'expiring' ? 'bg-amber-500'
    : client.status === 'debt'     ? 'bg-amber-500'
    : 'bg-gray-400'

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {/* Actividad */}
      <span className={`inline-flex items-center gap-1.5 text-xs ${paddingCls} ${activityCls}`}>
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${activityDot}`} />
        {activityLabel}
      </span>
      {/* Estado membresía */}
      <div className={`relative group inline-flex ${tooltip ? 'cursor-help' : ''}`}>
        <span className={`inline-flex items-center gap-1.5 text-xs ${paddingCls} ${paymentCls}`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${paymentDot}`} />
          {getStatusLabel(client.status)}
        </span>
        {tooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 px-3 py-2.5 rounded-xl bg-gray-900 dark:bg-[#0d0d0d] border border-white/[0.07] text-white text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-2xl text-center whitespace-normal">
            {tooltip}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900 dark:border-t-[#0d0d0d]" />
          </div>
        )}
      </div>
    </div>
  )
}

const DIA_SHORT: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', 'miércoles': 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', 'sábado': 'Sábado', domingo: 'Domingo',
}

const WEEKDAY_SHORT: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
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
        map.set(key, { mes: format(parseISO(a.date), 'MMMM yy', { locale: es }), presentes: 0, ausentes: 0 })
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
                  {format(parseISO(a.date), "d 'de' MMMM yyyy", { locale: es })}
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

// Clientes cargados al menos una vez en esta sesión (sobrevive a unmount/remount)
const loadedClientIds = new Set<string>()

// Formatea una fecha ISO (puede ser date-only "YYYY-MM-DD" o datetime completo)
function safeFormatDate(raw: string | null | undefined, pattern: string, locale?: Locale): string {
  if (!raw) return '—'
  try {
    const d = parseISO(raw.slice(0, 10) + 'T12:00:00')
    return isValid(d) ? format(d, pattern, locale ? { locale } : undefined) : '—'
  } catch {
    return '—'
  }
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const { can, isAdmin } = usePermissions()

  // Visita de regreso → no animar desde opacity:0 para evitar flash "solo navbar"
  const isReturnVisit = Boolean(id && loadedClientIds.has(id))

  const [navOpen, setNavOpen] = useState(false)
  const [deleteRutinaId, setDeleteRutinaId] = useState<string | null>(null)
  const [deletingRutina, setDeletingRutina] = useState(false)
  const [deleteAusenciaIds, setDeleteAusenciaIds] = useState<string[] | null>(null)
  const [deletingAusencia, setDeletingAusencia] = useState(false)
  const [client, setClient] = useState<Client | null>(null)
  const [ficha, setFicha] = useState<FichaEntrenamiento | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTogglingActivity, setIsTogglingActivity] = useState(false)
  const [showInactivarDialog, setShowInactivarDialog] = useState(false)
  const [showReactivarDialog, setShowReactivarDialog] = useState(false)
  const [diasGracia, setDiasGracia] = useState<number | undefined>(undefined)
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [eventos, setEventos] = useState<EventoDeportivo[]>([])
  const [eventoForm, setEventoForm] = useState<{ nombre: string; fecha: string; observacion: string } | null>(null)
  const [editingEvento, setEditingEvento] = useState<EventoDeportivo | null>(null)
  const [savingEvento, setSavingEvento] = useState(false)
  const [membershipDetailOpen, setMembershipDetailOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(true)
  const [membresias, setMembresias] = useState<MembresiaCliente[]>([])
  const [loadingMembresias, setLoadingMembresias] = useState(false)
  const [membPage, setMembPage] = useState(1)
  const MEMB_PAGE_SIZE = 6
  const PAYMENTS_PAGE_SIZE = 5
  const [visiblePayments, setVisiblePayments] = useState(PAYMENTS_PAGE_SIZE)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [newMembresiaOpen, setNewMembresiaOpen] = useState(false)
  const [savingMembresia, setSavingMembresia] = useState(false)
  const [newMembresiaForm, setNewMembresiaForm] = useState<{
    planId: string; modalidad: Modalidad; precio: string; fechaInicio: string
  }>({ planId: '', modalidad: 'TRANSFERENCIA_MENSUAL', precio: '', fechaInicio: '' })

  // Exención de pago
  const [showExentoConfirm, setShowExentoConfirm] = useState(false)

  // Exención de pago — confirm modal

  // Rutinas — solo para el resumen en el tab (la edición vive en ClientRutinaPage)
  const { rutinas, isLoading: loadingRutinas, refetch: refetchRutinas } = useRutinas(id)

  // Turnos — carga lazy al abrir el tab
  const [inscripciones, setInscripciones] = useState<InscripcionClienteEntry[]>([])
  const [listaEsperaCliente, setListaEsperaCliente] = useState<ListaEsperaClienteEntry[]>([])
  const [loadingTurnos, setLoadingTurnos] = useState(false)
  const [turnosLoaded, setTurnosLoaded] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [allShifts, setAllShifts] = useState<Shift[]>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [filterDia, setFilterDia] = useState<string | null>(null)
  const [filterHorario, setFilterHorario] = useState<string | null>(null)
  const [filterProfesor, setFilterProfesor] = useState<string | null>(null)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [selectedEnrolls, setSelectedEnrolls] = useState<{ turnoId: string; sala: 'A' | 'B' }[]>([])
  const [enrollingSaving, setEnrollingSaving] = useState(false)

  // Reposiciones
  const [asistenciaTab, setAsistenciaTab] = useState<'estadisticas' | 'ausencias'>('estadisticas')
  const [ausencias, setAusencias] = useState<AusenciaTurno[]>([])
  const [loadingAusencias, setLoadingAusencias] = useState(false)
  const [reposicionDrawerOpen, setReposicionDrawerOpen] = useState(false)
  const [drawerAusencia, setDrawerAusencia] = useState<AusenciaTurno | null>(null)
  const [drawerInscripcionId, setDrawerInscripcionId] = useState<string | null>(null)
  const [drawerMode, setDrawerMode] = useState<'ausencia' | 'recuperar'>('ausencia')
  const [chartView, setChartView] = useState<'mensual' | 'diasSemana'>('mensual')
  const [leftTab, setLeftTab] = useState<'historial' | 'presentes' | 'ausencias' | 'recuperos'>('historial')
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null)
  const [cancelingRecupId, setCancelingRecupId] = useState<string | null>(null)
  const [expandedHistorialGroups, setExpandedHistorialGroups] = useState<Set<string>>(new Set())

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })
  const watchExento = watch('exentoDePago')
  const watchFechaNacimiento = watch('fechaNacimiento')
  const showResponsable = (() => {
    const fn = isEditing ? watchFechaNacimiento : client?.fechaNacimiento?.slice(0, 10)
    if (!fn) return client?.esMenor ?? false
    const [y, m, d] = fn.split('-').map(Number)
    if (!y || !m || !d) return client?.esMenor ?? false
    const hoy = new Date()
    const diffM = hoy.getMonth() + 1 - m
    const ajuste = diffM < 0 || (diffM === 0 && hoy.getDate() < d) ? 1 : 0
    return hoy.getFullYear() - y - ajuste < 18
  })()

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
    if (tarifa) setNewMembresiaForm(prev => ({ ...prev, precio: client?.exentoDePago ? '0' : String(tarifa.precio) }))
  }, [newMembresiaForm.planId, newMembresiaForm.modalidad, planes])

  useEffect(() => {
    configuracionSistemaApi.get().then(c => setDiasGracia(c.diasGraciaInactivacion)).catch(() => {})
  }, [])

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
          exentoDePago: c.exentoDePago ?? false,
          motivoExencion: c.motivoExencion ?? '',
          fechaNacimiento: c.fechaNacimiento ? c.fechaNacimiento.slice(0, 10) : '',
          responsableNombre:   c.responsableNombre   ?? '',
          responsableCuil:     c.responsableCuil     ?? '',
          responsableContacto: c.responsableContacto ?? '',
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
    }).finally(() => { setLoading(false); setLoadingMembresias(false); if (id) loadedClientIds.add(id) })
  }, [id])

  useEffect(() => {
    if (!id || turnosLoaded) return
    setLoadingTurnos(true)
    Promise.allSettled([
      inscripcionesApi.getByCliente(id),
      listaEsperaApi.getByCliente(id),
    ]).then(([inscRes, espRes]) => {
      if (inscRes.status === 'fulfilled') {
        const DAY_ORDER: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 }
        setInscripciones(
          [...inscRes.value].sort((a, b) => {
            const minA = Math.min(...(a.dias.length ? a.dias.map(d => DAY_ORDER[d] ?? 7) : [7]))
            const minB = Math.min(...(b.dias.length ? b.dias.map(d => DAY_ORDER[d] ?? 7) : [7]))
            if (minA !== minB) return minA - minB
            return a.horaInicio.localeCompare(b.horaInicio)
          })
        )
      }
      if (espRes.status === 'fulfilled') setListaEsperaCliente(espRes.value)
      setTurnosLoaded(true)
    }).finally(() => setLoadingTurnos(false))
  }, [id, turnosLoaded])

  useEffect(() => {
    if (!enrollOpen) {
      setFilterDia(null)
      setFilterHorario(null)
      setFilterProfesor(null)
      setSelectedEnrolls([])
      return
    }
    setLoadingShifts(true)
    shiftsApi.getAll()
      .then(shifts => setAllShifts(shifts))
      .finally(() => setLoadingShifts(false))
  }, [enrollOpen])

  // Cargar ausencias del cliente
  function loadAusencias() {
    if (!id) return
    setLoadingAusencias(true)
    reposicionesApi.getAll({ clienteId: id })
      .then(setAusencias)
      .catch(() => {})
      .finally(() => setLoadingAusencias(false))
  }
  useEffect(() => { loadAusencias() }, [id])

  function openDrawerNuevaAusencia(inscripcionId: string) {
    setDrawerInscripcionId(inscripcionId)
    setDrawerAusencia(null)
    setDrawerMode('ausencia')
    setReposicionDrawerOpen(true)
  }
  function openDrawerRecuperar(ausencia: AusenciaTurno) {
    setDrawerAusencia(ausencia)
    setDrawerInscripcionId(null)
    setDrawerMode('recuperar')
    setReposicionDrawerOpen(true)
  }

  async function onEdit(data: EditValues) {
    if (!client) return
    setIsSaving(true)
    try {
      const toNum = (v?: string) => { const n = parseFloat(v ?? ''); return isNaN(n) ? undefined : n }
      await Promise.all([
        clientsApi.update(client.id, {
          name: data.name, lastName: data.lastName,
          email: data.email ?? '', phone: data.phone ?? '', cuil: data.cuil,
          sedeId: data.sedeId || null,
          exentoDePago: data.exentoDePago ?? false,
          motivoExencion: data.motivoExencion || null,
          fechaNacimiento: data.fechaNacimiento || null,
          responsableNombre:   data.responsableNombre   || null,
          responsableCuil:     data.responsableCuil     || null,
          responsableContacto: data.responsableContacto || null,
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
      // Re-fetch para garantizar que la UI refleje exactamente lo que guardó el servidor
      const [freshClient, freshFicha] = await Promise.all([
        clientsApi.getById(String(client.id)),
        clientsApi.getFichaConEventos(String(client.id)),
      ])
      setClient(freshClient)
      if (freshFicha) setFicha(freshFicha)
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

  async function handleDeleteAusencia() {
    if (!deleteAusenciaIds || deleteAusenciaIds.length === 0) return
    setDeletingAusencia(true)
    try {
      await Promise.allSettled(deleteAusenciaIds.map(id => reposicionesApi.deleteAusencia(id)))
      addToast(deleteAusenciaIds.length === 1 ? 'Ausencia eliminada' : `${deleteAusenciaIds.length} ausencias eliminadas`, 'success')
      loadAusencias()
    } catch {
      addToast('Error al eliminar la ausencia', 'error')
    } finally {
      setDeletingAusencia(false)
      setDeleteAusenciaIds(null)
    }
  }

  async function handleDeleteAttendance(
    recordId: string,
    opts?: { isAusenciaOnly?: boolean; ausenciaId?: string }
  ) {
    setDeletingAttendanceId(recordId)
    try {
      if (opts?.isAusenciaOnly) {
        // Es una AusenciaTurno directa — usar la API de reposiciones
        await reposicionesApi.deleteAusencia(recordId)
        setAusencias(prev => prev.filter(a => a.id !== recordId))
      } else {
        // Es un registro de Asistencia
        await attendanceApi.deleteById(recordId)
        setAttendance(prev => prev.filter(r => r.id !== recordId))
        // Refrescar ausencias para que el contador sea correcto
        loadAusencias()
      }
      addToast('Registro eliminado', 'success')
    } catch {
      addToast('Error al eliminar el registro', 'error')
    } finally {
      setDeletingAttendanceId(null)
    }
  }

  async function handleDeleteRutina() {
    if (!deleteRutinaId) return
    setDeletingRutina(true)
    try {
      await rutinasApi.remove(deleteRutinaId)
      addToast('Rutina eliminada', 'success')
      refetchRutinas()
    } catch {
      addToast('Error al eliminar la rutina', 'error')
    } finally {
      setDeletingRutina(false)
      setDeleteRutinaId(null)
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

  function handleToggleActividad() {
    if (!client) return
    if (client.activityStatus === 'active') {
      setShowInactivarDialog(true)
    } else {
      setShowReactivarDialog(true)
    }
  }

  async function ejecutarCambioActividad(newEstado: 'ACTIVO' | 'INACTIVO') {
    if (!client) return
    setIsTogglingActivity(true)
    setShowInactivarDialog(false)
    setShowReactivarDialog(false)
    try {
      const updated = await clientsApi.update(client.id, { estado: newEstado })
      setClient(updated)
      if (newEstado === 'INACTIVO') {
        const n = inscripciones.length
        setInscripciones([])
        addToast(`Cliente inactivado${n > 0 ? ` y dado de baja de ${n} turno${n !== 1 ? 's' : ''}` : ''}`, 'success')
      } else {
        addToast('Cliente reactivado', 'success')
      }
    } catch {
      addToast('Error al actualizar estado de actividad', 'error')
    } finally {
      setIsTogglingActivity(false)
    }
  }

  async function handleDeleteClient() {
    if (!client) return
    setIsDeleting(true)
    try {
      await clientsApi.remove(client.id)
      queryClient.removeQueries({ queryKey: ['clients'] })
      setShowDeleteModal(false)
      navigate(ROUTES.CLIENTS)
      addToast('Cliente eliminado', 'success')
    } catch (err) {
      console.error('[DELETE CLIENT ERROR]', err)
      addToast('Error al eliminar el cliente', 'error')
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  function toggleEnrollSelection(turnoId: string, sala: 'A' | 'B', turnosDias: number) {
    setSelectedEnrolls(prev => {
      const exists = prev.find(s => s.turnoId === turnoId)
      if (exists) {
        // Deseleccionar
        return prev.filter(s => s.turnoId !== turnoId)
      }
      // Seleccionar (verificar cupo disponible)
      const totalDiasUsados = inscripciones.reduce((acc, i) => acc + i.dias.length, 0)
      const diasYaSeleccionados = prev.reduce((acc, s) => {
        const shift = allShifts.find(sh => String(sh.id) === s.turnoId)
        return acc + (shift ? shift.days.length : 0)
      }, 0)
      const planFreq = client?.planFrequency ? Number(client.planFrequency) : null
      if (planFreq !== null && totalDiasUsados + diasYaSeleccionados + turnosDias > planFreq) {
        return prev // No agregar si excede
      }
      return [...prev, { turnoId, sala }]
    })
  }

  async function handleEnrollSave() {
    if (!id || selectedEnrolls.length === 0) return
    setEnrollingSaving(true)
    let ok = 0
    let listaEspera = 0
    for (const { turnoId, sala } of selectedEnrolls) {
      try {
        const result = await inscripcionesApi.enroll(id, turnoId, sala)
        if (result.enListaEspera) listaEspera++
        else ok++
      } catch {
        // continuar con los demás
      }
    }
    if (ok > 0) addToast(`${ok} inscripción${ok !== 1 ? 'es' : ''} registrada${ok !== 1 ? 's' : ''}`, 'success')
    if (listaEspera > 0) addToast(`${listaEspera} turno${listaEspera !== 1 ? 's' : ''} lleno${listaEspera !== 1 ? 's' : ''} — añadido a lista de espera`, 'success')
    inscripcionesApi.getByCliente(id).then(setInscripciones)
    listaEsperaApi.getByCliente(id).then(setListaEsperaCliente)
    setSelectedEnrolls([])
    setEnrollingSaving(false)
    setEnrollOpen(false)
  }

  // ─── Datos derivados ────────────────────────────────────────────────────────
  const presentDays = useMemo(() => attendance.filter(a => a.present).length, [attendance])

  const ausenciasPendientes    = useMemo(() => ausencias.filter(a => a.recuperacion?.estado === 'PENDIENTE'), [ausencias])
  const ausenciasRecuperadas   = useMemo(() => ausencias.filter(a => a.recuperacion?.estado === 'COMPLETADA'), [ausencias])
  const conAvisoCount = useMemo(() => ausencias.filter(a => a.conAviso).length, [ausencias])
  const recuperos = useMemo(
    () => ausencias
      .filter(a => a.recuperacion && a.recuperacion.estado !== 'CANCELADA')
      .sort((a, b) => (b.recuperacion!.fecha ?? '').localeCompare(a.recuperacion!.fecha ?? '')),
    [ausencias]
  )
  const recuperosPendientesCount = useMemo(() => recuperos.filter(a => a.recuperacion?.estado === 'PENDIENTE').length, [recuperos])
  // Créditos disponibles: ausencias SIN recuperación activa (ni pendiente ni completada)
  // Aplica tanto a ausencias con aviso como sin aviso
  const creditosDisponibles = useMemo(
    () => ausencias.filter(a => !a.recuperacion || a.recuperacion.estado === 'CANCELADA').length,
    [ausencias]
  )
  const porRecuperar = creditosDisponibles
  const recoveryRate  = ausencias.length > 0 ? Math.round(ausenciasRecuperadas.length / ausencias.length * 100) : 0

  // Ausencias implícitas: Asistencia(presente=false) de bulk sin AusenciaTurno asociada
  // Se muestran en el panel "Ausencias y Recuperaciones" como "sin aviso" simples
  const ausenciasImplicitas = useMemo(() => {
    const ausenciaKeys = new Set(
      ausencias.map(a => `${a.inscripcion?.turno?.id ?? ''}__${a.fecha.slice(0, 10)}`)
    )
    return attendance
      .filter(r => !r.present && !ausenciaKeys.has(`${r.shiftId}__${r.date.slice(0, 10)}`))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [attendance, ausencias])

  // Timeline unificado: combina attendance + ausencias en 3 estados
  const mergedTimeline = useMemo(() => {
    // Normalizar a.fecha a YYYY-MM-DD (el backend devuelve ISO datetime completo)
    const ausenciaMap = new Map(ausencias.map(a => [a.fecha.slice(0, 10), a]))

    // Registros de asistencia bulk
    const attendanceDates = new Set(attendance.map(r => r.date.slice(0, 10)))
    const attendanceEntries = attendance.map(r => {
      const dateKey = r.date.slice(0, 10)
      return {
        ...r,
        dateKey,
        state: r.present ? 'presente' as const
          : (ausenciaMap.get(dateKey)?.conAviso === true) ? 'con_aviso' as const
          : 'ausente' as const,
        ausencia: ausenciaMap.get(dateKey),
      }
    })

    // Ausencias registradas directamente (sin registro bulk de asistencia para esa fecha)
    const ausenciasExtras = ausencias
      .filter(a => !attendanceDates.has(a.fecha.slice(0, 10)))
      .map(a => {
        const dateKey = a.fecha.slice(0, 10)
        return {
          id: a.id,
          date: a.fecha,
          dateKey,
          present: false,
          conAviso: a.conAviso,
          state: (a.conAviso ? 'con_aviso' : 'ausente') as 'con_aviso' | 'ausente',
          ausencia: a,
          isAusenciaOnly: true as const,
          shiftId: a.inscripcion?.turno?.id,
        }
      })

    const attendanceWithFlag = attendanceEntries.map(r => ({ ...r, isAusenciaOnly: false as const }))

    return [...attendanceWithFlag, ...ausenciasExtras]
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [attendance, ausencias])

  type TimelineEntry = ReturnType<typeof mergedTimeline>[number]
  type TimelineDisplayItem =
    | { type: 'single'; entry: TimelineEntry }
    | { type: 'range'; key: string; entries: TimelineEntry[]; state: 'con_aviso' | 'ausente'; minDate: string; maxDate: string }

  // displayTimeline: igual que mergedTimeline pero colapsa runs consecutivas de ausencias del mismo turno
  const displayTimeline = useMemo((): TimelineDisplayItem[] => {
    // Identificar runs: entradas no-presentes del mismo shiftId con brecha ≤ 8 días entre sí
    const runKeyByEntryId = new Map<string, string>()
    const runsByKey = new Map<string, TimelineEntry[]>()

    // Agrupar entradas no-presentes por shiftId
    const byShift = new Map<string, TimelineEntry[]>()
    for (const r of mergedTimeline) {
      if (r.state !== 'presente' && r.shiftId) {
        if (!byShift.has(r.shiftId)) byShift.set(r.shiftId, [])
        byShift.get(r.shiftId)!.push(r)
      }
    }

    // Para cada turno, encontrar runs consecutivas
    for (const items of byShift.values()) {
      const asc = [...items].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      let cur: TimelineEntry[] = []
      const flushRun = () => {
        if (cur.length > 1) {
          const key = cur[0].id
          for (const e of cur) runKeyByEntryId.set(e.id, key)
          runsByKey.set(key, [...cur])
        }
        cur = []
      }
      for (const r of asc) {
        if (cur.length === 0) {
          cur.push(r)
        } else {
          const prev = cur[cur.length - 1]
          const diffDays = Math.round(
            (new Date(r.dateKey + 'T12:00:00').getTime() - new Date(prev.dateKey + 'T12:00:00').getTime()) / 86_400_000
          )
          if (diffDays <= 8) cur.push(r)
          else { flushRun(); cur = [r] }
        }
      }
      flushRun()
    }

    // Construir display items colapsando runs
    const seenRunKeys = new Set<string>()
    const result: TimelineDisplayItem[] = []

    for (const r of mergedTimeline) { // ya ordenado desc
      const runKey = runKeyByEntryId.get(r.id)
      if (!runKey) {
        result.push({ type: 'single', entry: r })
      } else if (!seenRunKeys.has(runKey)) {
        seenRunKeys.add(runKey)
        const entries = runsByKey.get(runKey)! // ordenado asc
        result.push({
          type: 'range',
          key: runKey,
          entries,
          state: entries[0].state as 'con_aviso' | 'ausente',
          minDate: entries[0].dateKey,
          maxDate: entries[entries.length - 1].dateKey,
        })
      }
      // else: ya incluido en un range, omitir
    }

    return result
  }, [mergedTimeline])


  // Ausencias agrupadas por registro masivo (ventana de 60 s en createdAt)
  const gruposAusencias = useMemo(() => {
    // Agrupar por fechas consecutivas: brecha > 8 días entre ausencias adyacentes → nuevo grupo
    // Cubre clases semanales (7 días exactos entre ausencias consecutivas) con margen para DST
    const sorted = [...ausencias].sort((a, b) => a.fecha.slice(0, 10).localeCompare(b.fecha.slice(0, 10)))
    const groups: AusenciaTurno[][] = []
    let cur: AusenciaTurno[] = []
    for (const a of sorted) {
      if (cur.length === 0) {
        cur.push(a)
      } else {
        const prev = cur[cur.length - 1]
        const diffDays = Math.round(
          (new Date(a.fecha.slice(0, 10) + 'T12:00:00').getTime() - new Date(prev.fecha.slice(0, 10) + 'T12:00:00').getTime()) / 86_400_000
        )
        if (diffDays <= 8) {
          cur.push(a)
        } else {
          groups.push(cur)
          cur = [a]
        }
      }
    }
    if (cur.length > 0) groups.push(cur)
    // Ordenar grupos por fecha más reciente de sus items (desc)
    return groups.sort((a, b) => {
      const maxA = a.map(x => x.fecha.slice(0, 10)).sort().at(-1) ?? ''
      const maxB = b.map(x => x.fecha.slice(0, 10)).sort().at(-1) ?? ''
      return maxB.localeCompare(maxA)
    })
  }, [ausencias])

  // Racha de presencias consecutivas (desde el registro más reciente)
  const rachaActual = useMemo(() => {
    const sorted = [...mergedTimeline].sort((a, b) => b.date.localeCompare(a.date))
    let streak = 0
    for (const r of sorted) {
      if (r.state === 'presente') streak++
      else break
    }
    return streak
  }, [mergedTimeline])

  // Días desde el último ingreso
  const diasSinVenir = useMemo(() => {
    const last = mergedTimeline.find(r => r.state === 'presente')
    if (!last) return null
    return Math.floor((Date.now() - new Date(last.date + 'T12:00:00').getTime()) / 86_400_000)
  }, [mergedTimeline])

  // Datos mensuales con los 3 estados (para el bar chart principal)
  const monthlyStacked = useMemo(() => {
    const map = new Map<string, { mes: string; presente: number; conAviso: number; ausente: number }>()
    mergedTimeline.forEach(r => {
      const key = r.date.slice(0, 7)
      if (!map.has(key)) map.set(key, { mes: format(parseISO(key + '-01'), 'MMMM yy', { locale: es }), presente: 0, conAviso: 0, ausente: 0 })
      const cur = map.get(key)!
      if (r.state === 'presente') cur.presente++
      else if (r.state === 'con_aviso') cur.conAviso++
      else cur.ausente++
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [mergedTimeline])

  // Patrón por día de semana
  const byDayOfWeek = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const counts = days.map(dia => ({ dia, presente: 0, conAviso: 0, ausente: 0 }))
    mergedTimeline.forEach(r => {
      const dow = (new Date(r.dateKey + 'T12:00:00').getDay() + 6) % 7
      if (dow < 6) {
        if (r.state === 'presente') counts[dow].presente++
        else if (r.state === 'con_aviso') counts[dow].conAviso++
        else counts[dow].ausente++
      }
    })
    return counts.filter(d => d.presente + d.conAviso + d.ausente > 0)
  }, [mergedTimeline])

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
  if (loading) return <SkeletonClientProfile />

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
      // Para planes de 1 cuota: pagos históricos sin cuotaNumero también cuentan como cuota 1
      const pago = payments.find(p =>
        p.membresiaId === client.membershipId &&
        (p.cuotaNumero === num || (n === 1 && p.cuotaNumero === null))
      )
      return { numero: num, fechaEsperada, pago: pago ?? null }
    })
  })()

  const MEMBRESIA_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    PENDIENTE:  { label: 'Programada',  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500'   },
    ACTIVA:     { label: 'Activa',      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
    VENCIDA:    { label: 'Expirada',    color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10',    dot: 'bg-red-500'    },
    CANCELADA:  { label: 'Cancelada',   color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-500/10',   dot: 'bg-gray-400'   },
  }

  const planFreqGlobal = client?.planFrequency ? Number(client.planFrequency) : null
  const TABS: { value: Tab; label: string; count: number; sublabel?: string }[] = [
    { value: 'rutina', label: 'Rutina', count: rutinas.length },
    { value: 'turnos', label: 'Clases', count: 0, sublabel: planFreqGlobal ? `${inscripciones.length}/${planFreqGlobal}` : inscripciones.length > 0 ? String(inscripciones.length) : undefined },
    { value: 'asistencia', label: 'Asistencia', count: presentDays },
    { value: 'pagos', label: 'Pagos', count: payments.length },
  ]

  const NAV_SECTIONS = [
    { id: 'rutinas', label: 'Rutina', icon: <Dumbbell size={12} /> },
    { id: 'turnos', label: 'Clases', icon: <Clock size={12} /> },
    { id: 'asistencia', label: 'Asistencia', icon: <Activity size={12} /> },
    { id: 'membresias', label: 'Membresías', icon: <Tag size={12} /> },
    { id: 'pagos', label: 'Pagos', icon: <CreditCard size={12} /> },
  ]


  // Badge styles compartidos entre header y tabla de datos
  const activityCls = client.activityStatus === 'inactive'
    ? 'bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50'
    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
  const activityDot   = client.activityStatus === 'inactive' ? 'bg-gray-400' : 'bg-emerald-500'
  const activityLabel = client.activityStatus === 'inactive' ? 'INACTIVO' : 'ACTIVO'
  const paymentCls =
    client.status === 'active'   ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
    : client.status === 'expiring' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    : client.status === 'debt'     ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    : 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20'
  const paymentDot =
    client.status === 'active'   ? 'bg-emerald-500'
    : client.status === 'expiring' ? 'bg-amber-500'
    : client.status === 'debt'     ? 'bg-amber-500'
    : 'bg-gray-400'
  const paymentLabel      = getStatusLabel(client.status)
  const membershipTooltip = getStatusTooltip(client, diasGracia)

  return (
    <>
    <motion.div
      initial={isReturnVisit ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 md:space-y-5"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <motion.button
        onClick={() => navigate('/clients')}
        whileTap={{ scale: 0.96 }}
        className="group flex items-center gap-2 text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Clientes</span>
      </motion.button>

      {/* ── HERO CARD ───────────────────────────────────────────────────────── */}
      <div id="perfil" className={`${glassCard} overflow-hidden`}>
        {/* Accent bar (status color / exento) */}
        <div className={`h-1 w-full ${client.exentoDePago ? 'bg-emerald-500' : statusBarColor(client.status)}`} />

        {/* ── Contenedor 1: Header ────────────────────────────────────────── */}
        <div className={`px-5 md:px-7 pt-5 md:pt-7 pb-3 md:pb-4 transition-colors${client.exentoDePago ? ' bg-emerald-500/[0.04] dark:bg-emerald-500/[0.05]' : ''}`}>
          <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
            {/* Avatar */}
            <div className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-2xl md:text-3xl font-black shrink-0 ${avatarColors(client.status)}`}>
              {initials}
            </div>

            {/* Nombre + badges + acciones */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Izquierda: nombre, fecha, badges con título */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                    {client.name} {client.lastName}
                  </h1>
                  <p className="text-sm text-gray-400 dark:text-[#8A8A9A] mt-1.5">
                    Miembro desde {formatDate(client.createdAt)}
                  </p>
                  {/* Badge exento */}
                  {client.exentoDePago && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Shield size={11} />
                      Exento de pago
                      {client.motivoExencion && <span className="opacity-60">· {client.motivoExencion}</span>}
                    </div>
                  )}
                  {/* Badges con etiqueta — Actividad + Estado membresía */}
                  <div className="flex items-center gap-5 mt-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A]">Actividad</span>
                      {isAdmin && isEditing ? (
                        <div
                          role="button"
                          onClick={handleToggleActividad}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${client.activityStatus === 'active' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${client.activityStatus === 'active' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                            {client.activityStatus === 'active' ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold ${activityCls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${activityDot}`} />
                          {activityLabel}
                        </span>
                      )}
                    </div>
                    <div className="w-px h-9 bg-gray-200 dark:bg-white/[0.07] self-end mb-0.5" />
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A]">
                        Estado membresía
                        {isEditing && <span className="ml-1 font-normal normal-case tracking-normal text-gray-300 dark:text-[#5A5A6A]">(automático)</span>}
                      </span>
                      <div className={`relative group inline-flex ${membershipTooltip ? 'cursor-help' : ''}`}>
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold ${paymentCls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${paymentDot}`} />
                          {paymentLabel}
                        </span>
                        {membershipTooltip && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 px-3 py-2.5 rounded-xl bg-gray-900 dark:bg-[#0d0d0d] border border-white/[0.07] text-white text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-2xl text-center whitespace-normal">
                            {membershipTooltip}
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900 dark:border-t-[#0d0d0d]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Derecha: botón Editar / Cancelar + Guardar */}
                <div className="flex items-center gap-2 shrink-0">
                  {can('clients', 'update') && (
                    isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { reset({ name: client.name, lastName: client.lastName, email: client.email ?? '', phone: client.phone ?? '', cuil: client.cuil ?? '', peso: ficha?.peso != null ? String(ficha.peso) : '', altura: ficha?.altura != null ? String(ficha.altura) : '', actividadDiaria: ficha?.actividadDiaria ?? '', objetivos: ficha?.objetivos ?? '', deportePractica: ficha?.deportePractica ?? '', experiencia: ficha?.experiencia ?? '', lesiones: ficha?.lesiones ?? '', patologiasBase: ficha?.patologiasBase ?? '', exentoDePago: client.exentoDePago ?? false, motivoExencion: client.motivoExencion ?? '', fechaNacimiento: client.fechaNacimiento ? client.fechaNacimiento.slice(0, 10) : '', responsableNombre: client.responsableNombre ?? '', responsableCuil: client.responsableCuil ?? '', responsableContacto: client.responsableContacto ?? '' }); setIsEditing(false) }}
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
                      </>
                    ) : (
                      <button
                        onClick={() => { reset({ name: client.name, lastName: client.lastName, email: client.email ?? '', phone: client.phone ?? '', cuil: client.cuil ?? '', peso: ficha?.peso != null ? String(ficha.peso) : '', altura: ficha?.altura != null ? String(ficha.altura) : '', actividadDiaria: ficha?.actividadDiaria ?? '', objetivos: ficha?.objetivos ?? '', deportePractica: ficha?.deportePractica ?? '', experiencia: ficha?.experiencia ?? '', lesiones: ficha?.lesiones ?? '', patologiasBase: ficha?.patologiasBase ?? '', exentoDePago: client.exentoDePago ?? false, motivoExencion: client.motivoExencion ?? '', fechaNacimiento: client.fechaNacimiento ? client.fechaNacimiento.slice(0, 10) : '', responsableNombre: client.responsableNombre ?? '', responsableCuil: client.responsableCuil ?? '', responsableContacto: client.responsableContacto ?? '' }); setIsEditing(true) }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                      >
                        <Edit2 size={12} />
                        Editar
                      </button>
                    )
                  )}
                  {can('clients', 'delete') && !isEditing && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.06] text-red-500 hover:bg-red-100 dark:hover:bg-red-500/[0.12] transition-all"
                    >
                      <Trash2 size={12} />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ── Contenedor 2: Tablas de Datos ───────────────────────────────── */}
        <div className="px-5 md:px-7 pt-3 md:pt-4 pb-5 md:pb-7">
          {/* Tabla unificada: Datos Personales + Responsable legal */}
          <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] overflow-hidden text-xs">
            <div className="border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">Datos Personales</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/[0.04]">

              {/* Col 1 — Nombre, Apellido, CUIL, Email, Teléfono */}
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {([
                  { label: 'Nombre',   regKey: 'name'     as keyof EditValues, Icon: User,  placeholder: 'Sin nombre',   raw: client.name },
                  { label: 'Apellido', regKey: 'lastName' as keyof EditValues, Icon: User,  placeholder: 'Sin apellido', raw: client.lastName },
                  ...(!showResponsable ? [{ label: 'CUIL', regKey: 'cuil' as keyof EditValues, Icon: Hash, placeholder: 'Sin CUIL', raw: client.cuil }] : []),
                  { label: 'Email',    regKey: 'email'    as keyof EditValues, Icon: Mail,  placeholder: 'Sin email',    raw: client.email },
                  { label: 'Teléfono', regKey: 'phone'    as keyof EditValues, Icon: Phone, placeholder: 'Sin teléfono', raw: client.phone },
                ]).map(({ label, regKey, Icon, placeholder, raw }) => (
                  <div key={regKey} className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
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

                {/* Fecha de nacimiento / Edad */}
                <div className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                  <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                    <CalendarDays size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                    Edad
                  </span>
                  {isEditing ? (
                    <input
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                      {...register('fechaNacimiento')}
                    />
                  ) : (
                    <span className={client.fechaNacimiento ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                      {client.fechaNacimiento ? (() => {
                        const str = client.fechaNacimiento.slice(0, 10)
                        const [y, m, d] = str.split('-').map(Number)
                        const hoy = new Date()
                        const diffM = hoy.getMonth() + 1 - m
                        const ajuste = diffM < 0 || (diffM === 0 && hoy.getDate() < d) ? 1 : 0
                        const edad = hoy.getFullYear() - y - ajuste
                        return `${edad} años · ${format(parseISO(str), 'dd/MM/yyyy')}`
                      })() : '—'}
                    </span>
                  )}
                </div>

              </div>

              {/* Col 2 — Sede, Act. diaria, Objetivos, Deporte, Experiencia */}
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                <div className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-center">
                  <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold">
                    <MapPin size={12} className="opacity-60 text-gray-400 dark:text-gray-500" />
                    Sede
                  </span>
                  {isEditing ? (
                    <select className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all" {...register('sedeId')}>
                      <option value="">— Sin sede —</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  ) : (
                    <span className={client.sede ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400 dark:text-gray-500'}>
                      {client.sede?.nombre ?? 'Sin sede'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                  <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                    <Activity size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                    Act. diaria
                  </span>
                  {isEditing ? (
                    <select className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all" {...register('actividadDiaria')}>
                      {ACTIVIDAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <span className={ficha?.actividadDiaria ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                      {ficha?.actividadDiaria ? (ACTIVIDAD_LABELS[ficha.actividadDiaria] ?? ficha.actividadDiaria) : '—'}
                    </span>
                  )}
                </div>
                {([
                  { label: 'Objetivos',   regKey: 'objetivos'       as keyof EditValues, Icon: Tag,      raw: ficha?.objetivos },
                  { label: 'Deporte',     regKey: 'deportePractica' as keyof EditValues, Icon: Dumbbell, raw: ficha?.deportePractica },
                  { label: 'Experiencia', regKey: 'experiencia'     as keyof EditValues, Icon: BookOpen, raw: ficha?.experiencia },
                ]).map(({ label, regKey, Icon, raw }) => (
                  <div key={regKey} className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                    <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                      <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                      {label}
                    </span>
                    {isEditing ? (
                      <input className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all" {...register(regKey)} />
                    ) : (
                      <span className={raw ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>{raw ?? '—'}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Col 3 — Peso, Altura, Lesiones, Patologías */}
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {([
                  { label: 'Peso',       regKey: 'peso'          as keyof EditValues, Icon: Activity,      isNum: true,  unit: 'kg', raw: ficha?.peso   && ficha.peso   > 20 ? `${ficha.peso} kg`   : null },
                  { label: 'Altura',     regKey: 'altura'        as keyof EditValues, Icon: Activity,      isNum: true,  unit: 'cm', raw: ficha?.altura && ficha.altura > 50 ? `${ficha.altura} cm` : null },
                  { label: 'Lesiones',   regKey: 'lesiones'      as keyof EditValues, Icon: AlertTriangle, isNum: false, unit: '',   raw: ficha?.lesiones },
                  { label: 'Patologías', regKey: 'patologiasBase' as keyof EditValues, Icon: Receipt,      isNum: false, unit: '',   raw: ficha?.patologiasBase },
                ] as Array<{ label: string; regKey: keyof EditValues; Icon: typeof Activity; isNum: boolean; unit: string; raw: string | null | undefined }>).map(({ label, regKey, Icon, isNum, unit, raw }) => (
                  <div key={regKey} className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                    <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                      <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                      {label}
                    </span>
                    {isEditing ? (
                      isNum ? (
                        <div className="flex items-center gap-1">
                          <input type="number" className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all" {...register(regKey)} />
                          <span className="text-gray-400 shrink-0">{unit}</span>
                        </div>
                      ) : (
                        <input className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all" {...register(regKey)} />
                      )
                    ) : (
                      <span className={raw ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>{raw ?? '—'}</span>
                    )}
                  </div>
                ))}

                {/* Exento de pago — solo visible para admin o si ya es exento */}
                {(isAdmin || client.exentoDePago) && (
                  <div className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-center">
                    <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold">
                      <Shield size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                      Exento
                    </span>
                    {isEditing && isAdmin ? (
                      <div
                        role="button"
                        onClick={() => watchExento ? setValue('exentoDePago', false) : setShowExentoConfirm(true)}
                        className="flex items-center gap-2 cursor-pointer w-fit"
                      >
                        <div className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${watchExento ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${watchExento ? 'translate-x-3' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {watchExento ? 'Sí' : 'No'}
                        </span>
                      </div>
                    ) : (
                      <span className={client.exentoDePago ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}>
                        {client.exentoDePago ? 'Sí' : 'No'}
                      </span>
                    )}
                  </div>
                )}

                {/* Motivo exención */}
                {(isAdmin || client.motivoExencion) && (watchExento || (!isEditing && client.exentoDePago)) && (
                  <div className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                    <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                      <Shield size={12} className="opacity-0 shrink-0" />
                      Motivo
                    </span>
                    {isEditing ? (
                      <input
                        placeholder="Convenio, socio fundador…"
                        className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                        {...register('motivoExencion')}
                      />
                    ) : (
                      <span className={client.motivoExencion ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                        {client.motivoExencion || '—'}
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>


          {/* ── Responsable legal (menores de edad) ─────────────────────────── */}
          {showResponsable && (
            <div className="lg:w-64 lg:shrink-0 rounded-2xl border border-amber-400/25 dark:border-amber-400/20 bg-white/20 dark:bg-white/[0.01] overflow-hidden text-xs">
              <div className="border-b border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <User size={11} className="opacity-80" /> Responsable legal
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {([
                  { label: 'Nombre',   regKey: 'responsableNombre'   as keyof EditValues, raw: client.responsableNombre },
                  { label: 'CUIL',     regKey: 'responsableCuil'     as keyof EditValues, raw: client.responsableCuil },
                  { label: 'Contacto', regKey: 'responsableContacto' as keyof EditValues, raw: client.responsableContacto },
                ]).map(({ label, regKey, raw }) => (
                  <div key={regKey} className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-start">
                    <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold pt-1">
                      <User size={12} className="opacity-60 text-gray-400 dark:text-gray-500 shrink-0" />
                      {label}
                    </span>
                    {isEditing ? (
                      <input
                        placeholder="—"
                        className="w-full bg-white/60 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.15] rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all"
                        {...register(regKey)}
                      />
                    ) : (
                      <span className={raw ? 'text-gray-900 dark:text-white font-semibold pt-0.5' : 'text-gray-400 dark:text-gray-500 pt-0.5'}>
                        {raw || '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>{/* end flex datos + responsable */}

          {/* ── Membresía + Calendario en grid ──────────────────────────────── */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

            {/* Resumen de Membresía */}
            <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] overflow-hidden text-xs">
              <div className="border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02] px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#8A8A9A]">Resumen de Membresía</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {(() => {
                  const hasActiveMembership = !!(client.planName && client.membershipStatus !== 'CANCELADA')
                  return [
                    { label: 'Plan', value: hasActiveMembership ? formatPlanName(client.planName!) : 'Sin membresía activa', icon: Dumbbell, color: hasActiveMembership ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-400 dark:text-[#8A8A9A] font-semibold' },
                    { label: 'Modalidad', value: hasActiveMembership && client.membershipModalidad ? MODALIDAD_LABELS[client.membershipModalidad] ?? client.membershipModalidad : '—', icon: Clock, color: hasActiveMembership ? 'text-gray-700 dark:text-gray-300 font-semibold' : 'text-gray-400 dark:text-[#8A8A9A]' },
                    { label: 'Precio', value: hasActiveMembership && client.membershipPrecio != null ? formatCurrency(client.membershipPrecio) : '—', icon: Banknote, color: hasActiveMembership ? 'text-primary font-bold' : 'text-gray-400 dark:text-[#8A8A9A]' },
                    { label: 'Vencimiento', value: !hasActiveMembership ? '—' : daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} días restantes` : 'Finalizada') : 'Sin fecha', icon: CalendarDays, color: !hasActiveMembership ? 'text-gray-400 dark:text-[#8A8A9A]' : daysLeft !== null ? (daysLeft <= 0 ? 'text-red-500 dark:text-red-400 font-semibold' : daysLeft <= 30 ? 'text-amber-500 dark:text-amber-400 font-semibold' : 'text-emerald-500 dark:text-emerald-400 font-semibold') : 'text-gray-500 dark:text-[#8A8A9A]' },
                  ]
                })().map((row, idx) => {
                  const Icon = row.icon
                  return (
                    <div key={idx} className="grid grid-cols-[3fr_5fr] px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors items-center">
                      <span className="text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5 font-semibold">
                        <Icon size={12} className="opacity-60 text-gray-400 dark:text-gray-500" />
                        {row.label}
                      </span>
                      <span className={`${row.color} truncate`}>{row.value}</span>
                    </div>
                  )
                })}
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
                    className="flex items-center gap-1.5 rounded-xl btn-action px-3 py-1.5 text-xs"
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
                          {format(evDate, "d 'de' MMMM yyyy", { locale: es })}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="hidden lg:block fixed left-4 xl:left-6 top-[32vh] z-30 transition-transform duration-300 ease-in-out"
          style={{ transform: navOpen ? 'translateX(0)' : 'translateX(calc(-100% + 12px))' }}
        >
          <div className="relative w-32 xl:w-40 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">

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
                  { id: 'perfil',      label: 'Perfil',      icon: User,       show: true },
                  { id: 'rutinas',      label: 'Rutinas',      icon: BookOpen,      show: can('clients', 'view_rutinas') },
                  { id: 'clases',       label: 'Clases',       icon: Dumbbell,      show: can('clients', 'view_turnos') },
                  { id: 'asistencia',   label: 'Asistencia',   icon: Activity,      show: can('clients', 'view_asistencia') },
                  { id: 'membresias',   label: 'Membresías',   icon: Tag,           show: can('clients', 'view_membresias') },
                  { id: 'pagos',        label: 'Pagos',        icon: CreditCard,    show: can('clients', 'view_pagos') },
                ].filter(item => item.show).map(item => {
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
        </motion.div>

        {/* Bloque de Secciones de Contenido (Offset to clear the fixed sidebar) */}
        <motion.div className="w-full space-y-6" variants={staggerContainerFast} initial="initial" animate="animate">
          {/* ─── SECCIÓN 1: RUTINAS ────────────────────────────────────────── */}
          {can('clients', 'view_rutinas') && <motion.div variants={fadeUpItem} id="rutinas" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
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
                        className="group relative flex flex-col justify-between p-5 rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-primary/30 dark:hover:border-primary/20 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_40px_rgba(251,198,8,0.06)] transition-all duration-300 cursor-pointer overflow-hidden min-h-[148px] active:scale-[0.97]"
                      >
                        {/* Sutil glow de acento en la esquina superior */}
                        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/[0.07] blur-3xl" />

                        <div className="relative">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25">
                                <BookOpen size={17} className="text-primary" />
                              </div>
                              <div>
                                <h5 className="text-base font-black text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200 leading-tight">{activa.nombre}</h5>
                                {activa.descripcion && (
                                  <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A] mt-0.5 line-clamp-1">{activa.descripcion}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/25">
                                Activa
                              </span>
                              {(isAdmin || user?.role === 'profesor') && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setDeleteRutinaId(activa.id) }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Eliminar rutina"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="relative flex items-center justify-between text-xs text-gray-500 dark:text-[#8A8A9A] pt-4 mt-4 border-t border-white/50 dark:border-white/[0.06]">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <Dumbbell size={11} className="text-gray-400" />
                              {(activa.semanas ?? []).reduce((acc, s) => acc + (s.sesiones ?? []).reduce((a, ses) => a + (ses.bloques ?? []).reduce((b, bl) => b + (bl.ejerciciosPlan ?? []).length, 0), 0), 0)} ejercicios
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CalendarDays size={11} className="text-gray-400" />
                              {(activa.semanas ?? []).length} semana{(activa.semanas ?? []).length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <span className="text-[10px] text-primary/70 font-semibold group-hover:text-primary transition-colors">Ver rutina →</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl min-h-[148px] text-center text-gray-400 dark:text-[#8A8A9A]">
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
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {inactivas.map((rutina: Rutina) => (
                          <div
                            key={rutina.id}
                            onClick={() => navigate(`/clients/${id}/rutina?rid=${rutina.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/50 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.02] backdrop-blur-sm hover:bg-white/40 dark:hover:bg-white/[0.05] hover:border-white/70 dark:hover:border-white/[0.10] transition-all duration-200 text-left cursor-pointer group active:scale-[0.98]"
                          >
                            <div className="h-8 w-8 rounded-lg bg-gray-500/10 border border-gray-200 dark:border-white/[0.06] flex items-center justify-center shrink-0">
                              <BookOpen size={13} className="text-gray-400 dark:text-[#8A8A9A]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{rutina.nombre}</p>
                              <p className="text-[10px] text-gray-400 dark:text-[#6A6A7A] mt-0.5">
                                {(rutina.semanas ?? []).length} sem.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(isAdmin || user?.role === 'profesor') && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setDeleteRutinaId(rutina.id) }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Eliminar rutina"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              <ChevronRight size={13} className="text-gray-300 dark:text-white/20 group-hover:text-gray-400 dark:group-hover:text-white/40 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </motion.div>}

          {/* ─── SECCIÓN 2: CLASES ─────────────────────────────────────────── */}
          {can('clients', 'view_turnos') && <motion.div variants={fadeUpItem} id="clases" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
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
                    {can('shifts', 'create') && (
                      <button
                        onClick={() => { if (!limiteAlcanzado) setEnrollOpen(true) }}
                        disabled={limiteAlcanzado}
                        title={limiteAlcanzado ? `Límite del plan alcanzado (${planFreq} días/semana)` : undefined}
                        className={`flex items-center gap-1.5 rounded-xl btn-action px-4 py-2.5 text-sm ${limiteAlcanzado ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                            onClick={() => navigate(`/shifts/${insc.turnoId}`)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 shrink-0 px-3 py-1.5 rounded-xl hover:bg-amber-500/10 transition-all border border-transparent hover:border-amber-500/10"
                          >
                            <ExternalLink size={13} />
                            Ver turno
                          </button>
                          {(isAdmin || user?.role === 'staff') && (
                            <button
                              onClick={() => handleDarDeBaja(insc.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-400 shrink-0 px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/10"
                            >
                              <XCircle size={13} />
                              Dar de baja
                            </button>
                          )}
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
          </motion.div>}

          {/* ─── SECCIÓN 3: ASISTENCIA ───────────────────────────────────────── */}
          {can('clients', 'view_asistencia') && <motion.div variants={fadeUpItem} id="asistencia" className={`${glassCard} overflow-hidden scroll-mt-24`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Asistencia y Estadísticas</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Registro de ingresos y análisis de presencia</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {porRecuperar > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <CalendarX2 size={11} /> {porRecuperar} a recuperar
                  </span>
                )}
                <button
                  disabled={inscripciones.length === 0}
                  onClick={() => inscripciones.length > 0 && navigate(`/clients/${id}/ausencia?inscripcionId=${inscripciones[0].id}&dias=${inscripciones[0].dias.join(',')}`)}
                  title={inscripciones.length === 0 ? 'No disponible porque el cliente no tiene ningún turno asignado' : undefined}
                  className={`flex items-center gap-1.5 rounded-xl btn-action px-4 py-2.5 text-sm ${inscripciones.length === 0 ? 'opacity-40 cursor-not-allowed saturate-50' : ''}`}
                >
                  <CalendarX2 size={12} /> Registrar ausencia
                </button>
              </div>
            </div>

            {/* Cuerpo */}
            {mergedTimeline.length === 0 ? (
              <div className="p-6"><EmptyState icon={Activity} message="Sin registros de asistencia" /></div>
            ) : (() => {
              const total     = mergedTimeline.length
              const nPresente = mergedTimeline.filter(r => r.state === 'presente').length
              const nConAviso = mergedTimeline.filter(r => r.state === 'con_aviso').length
              const nAusente  = mergedTimeline.filter(r => r.state === 'ausente').length
              const pct       = total > 0 ? Math.round(nPresente / total * 100) : 0
              const isDark    = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
              const tooltipStyle = { background: isDark ? '#1A1A1A' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 10, fontSize: 11 }

              return (
                <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-white/[0.06]">

                  {/* ── Columna izquierda: stats + subnav + lista ── */}
                  <div className="flex flex-col">
                    {/* Stats 2×2 */}
                    <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 dark:divide-white/[0.06] border-b border-gray-200 dark:border-white/[0.06]">
                      {[
                        { label: 'Total',            value: total,     color: 'text-gray-900 dark:text-white' },
                        { label: 'Presente',         value: nPresente, color: 'text-emerald-500' },
                        { label: 'Ausencia c/aviso', value: nConAviso, color: 'text-blue-500' },
                        { label: 'Ausencia s/aviso', value: nAusente,  color: 'text-red-500' },
                      ].map(s => (
                        <div key={s.label} className="py-4 text-center">
                          <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Subnav */}
                    <div className="flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-white/[0.06]">
                      {([
                        ['historial',  'Historial'],
                        ['presentes',  `Presentes${presentDays > 0 ? ` (${presentDays})` : ''}`],
                        ['ausencias',  `Ausencias${(ausencias.length + ausenciasImplicitas.length) > 0 ? ` (${ausencias.length + ausenciasImplicitas.length})` : ''}`],
                        ['recuperos',  `Recuperos${recuperosPendientesCount > 0 ? ` (${recuperosPendientesCount})` : ''}`],
                      ] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setLeftTab(v)}
                          className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all ${
                            leftTab === v
                              ? 'bg-gray-200 dark:bg-white/[0.09] text-gray-900 dark:text-white'
                              : 'text-gray-400 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white'
                          }`}
                        >{l}</button>
                      ))}
                    </div>

                    {/* Lista scrollable */}
                    <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-white/[0.05]" style={{ maxHeight: 260 }}>
                      {leftTab === 'historial' ? (
                        displayTimeline.map(item => {
                          if (item.type === 'range') {
                            const isExp = expandedHistorialGroups.has(item.key)
                            const stateColor = item.state === 'con_aviso' ? 'bg-blue-500' : 'bg-red-500'
                            const stateLabel = item.state === 'con_aviso' ? 'C/aviso' : 'S/aviso'
                            const stateTextColor = item.state === 'con_aviso' ? 'text-blue-500' : 'text-red-400'
                            return (
                              <div key={item.key} className="border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                                <button
                                  onClick={() => setExpandedHistorialGroups(prev => {
                                    const next = new Set(prev)
                                    if (next.has(item.key)) next.delete(item.key)
                                    else next.add(item.key)
                                    return next
                                  })}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-left"
                                >
                                  <div className={`h-2 w-2 rounded-full shrink-0 ${stateColor}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white capitalize">
                                      {safeFormatDate(item.minDate + 'T12:00:00', "d 'de' MMMM", es)} – {safeFormatDate(item.maxDate + 'T12:00:00', "d 'de' MMMM yyyy", es)}
                                    </p>
                                    <p className="text-[10px] text-gray-400 dark:text-[#666]">{item.entries.length} ausencias</p>
                                  </div>
                                  <span className={`text-[10px] font-semibold shrink-0 ${stateTextColor}`}>{stateLabel}</span>
                                  {/* Botón detalle grupo — solo si hay ausencias con ID */}
                                  {(() => {
                                    const ausenciaIds = item.entries.map(e => e.ausencia?.id).filter(Boolean) as string[]
                                    return ausenciaIds.length > 0 && (
                                      <button
                                        onClick={e => { e.stopPropagation(); navigate(`/clients/${id}/ausencias-grupo?ids=${ausenciaIds.join(',')}`) }}
                                        className="text-gray-300 dark:text-[#444] hover:text-primary transition-colors shrink-0 p-0.5"
                                        title="Ver grupo y gestionar recuperaciones"
                                      >
                                        <CalendarCheck2 size={12} />
                                      </button>
                                    )
                                  })()}
                                  <ChevronRight size={12} className={`text-gray-300 dark:text-[#444] transition-transform duration-200 shrink-0 ${isExp ? 'rotate-90' : ''}`} />
                                </button>
                                {isExp && item.entries.slice().reverse().map(r => (
                                  <div key={r.id} className="flex items-center gap-2.5 px-6 py-2 border-t border-gray-100 dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${stateColor}`} />
                                    <p className="text-[11px] font-semibold text-gray-900 dark:text-white flex-1 truncate capitalize">
                                      {safeFormatDate(r.dateKey + 'T12:00:00', "EEEE d 'de' MMMM", es)}
                                    </p>
                                    {r.shiftId && (
                                      <button onClick={() => navigate(`/shifts/${r.shiftId}?date=${r.dateKey}`)} className="text-gray-300 dark:text-[#555] hover:text-primary transition-colors shrink-0" title="Ver turno">→</button>
                                    )}
                                    {can('attendance', 'delete') && (
                                      <button
                                        onClick={() => handleDeleteAttendance(r.id, { isAusenciaOnly: r.isAusenciaOnly, ausenciaId: r.ausencia?.id })}
                                        disabled={deletingAttendanceId === r.id}
                                        className="text-gray-300 dark:text-[#555] hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                                      >
                                        {deletingAttendanceId === r.id ? <span className="text-[9px]">...</span> : <Trash2 size={11} />}
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )
                          }

                          const r = item.entry
                          return (
                          <div key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${r.state === 'presente' ? 'bg-emerald-500' : r.state === 'con_aviso' ? 'bg-blue-500' : 'bg-red-500'}`} />
                            <p className="text-xs font-semibold text-gray-900 dark:text-white flex-1 truncate capitalize">
                              {safeFormatDate(r.dateKey + 'T12:00:00', "EEEE d 'de' MMMM yyyy", es)}
                            </p>
                            <span className={`text-[10px] font-semibold shrink-0 ${r.state === 'presente' ? 'text-emerald-500' : r.state === 'con_aviso' ? 'text-blue-500' : 'text-red-400'}`}>
                              {r.state === 'presente' ? 'Presente' : r.state === 'con_aviso' ? 'C/aviso' : 'S/aviso'}
                            </span>
                            {r.shiftId && (
                              <button
                                onClick={() => navigate(`/shifts/${r.shiftId}?date=${r.dateKey}`)}
                                className="text-gray-300 dark:text-[#555] hover:text-primary dark:hover:text-primary transition-colors shrink-0"
                                title="Ver turno en esa fecha"
                              >
                                →
                              </button>
                            )}
                            {can('attendance', 'delete') && (
                              <button
                                onClick={() => handleDeleteAttendance(r.id, {
                                  isAusenciaOnly: r.isAusenciaOnly,
                                  ausenciaId: r.ausencia?.id,
                                })}
                                disabled={deletingAttendanceId === r.id}
                                className="text-gray-300 dark:text-[#555] hover:text-red-400 dark:hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                                title="Eliminar registro"
                              >
                                {deletingAttendanceId === r.id
                                  ? <span className="text-[9px]">...</span>
                                  : <Trash2 size={11} />}
                              </button>
                            )}
                          </div>
                          )
                        })
                      ) : leftTab === 'presentes' ? (
                        (() => {
                          const presentes = mergedTimeline.filter(r => r.state === 'presente')
                          if (presentes.length === 0) return (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                              <CalendarCheck2 size={20} className="text-gray-300 dark:text-[#444] mb-2" />
                              <p className="text-xs text-gray-400 dark:text-[#666]">Sin presentes registrados</p>
                            </div>
                          )
                          return presentes.map(r => (
                            <div key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                              <div className="h-2 w-2 rounded-full shrink-0 bg-emerald-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white capitalize truncate">
                                  {safeFormatDate(r.dateKey + 'T12:00:00', "EEEE d 'de' MMMM yyyy", es)}
                                </p>
                                {'shiftLabel' in r && r.shiftLabel && (
                                  <p className="text-[10px] text-gray-400 dark:text-[#666]">{r.shiftLabel}</p>
                                )}
                              </div>
                              {r.shiftId && (
                                <button
                                  onClick={() => navigate(`/shifts/${r.shiftId}?date=${r.dateKey}`)}
                                  className="text-gray-300 dark:text-[#555] hover:text-primary dark:hover:text-primary transition-colors shrink-0"
                                  title="Ver turno"
                                >
                                  <ExternalLink size={12} />
                                </button>
                              )}
                            </div>
                          ))
                        })()
                      ) : leftTab === 'ausencias' && ausencias.length === 0 && ausenciasImplicitas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <CalendarCheck2 size={20} className="text-gray-300 dark:text-[#444] mb-2" />
                          <p className="text-xs text-gray-400 dark:text-[#666]">Sin ausencias registradas</p>
                        </div>
                      ) : leftTab === 'ausencias' ? (
                        <>
                        {gruposAusencias.map((grupo, gi) => {
                          const isBulk = grupo.length > 1
                          const sortedItems = [...grupo].sort((a, b) => b.fecha.localeCompare(a.fecha))
                          const minFecha = sortedItems[sortedItems.length - 1].fecha
                          const maxFecha = sortedItems[0].fecha
                          const allConAviso = grupo.every(a => a.conAviso)
                          const someConAviso = grupo.some(a => a.conAviso)
                          const avisoBadge = (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              allConAviso ? 'bg-blue-500/10 text-blue-500'
                              : someConAviso ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-red-400/10 text-red-400'
                            }`}>
                              {allConAviso ? 'c/aviso' : someConAviso ? 'mixto' : 's/aviso'}
                            </span>
                          )

                          if (isBulk) {
                            const rangoLabel = minFecha === maxFecha
                              ? safeFormatDate(minFecha, "EEEE d 'de' MMMM yyyy", es)
                              : `${safeFormatDate(minFecha, "d 'de' MMMM", es)} – ${safeFormatDate(maxFecha, "d 'de' MMMM yyyy", es)}`
                            const grupoIds = grupo.map(a => a.id)

                            return (
                              <div
                                key={gi}
                                onClick={() => navigate(`/clients/${id}/ausencias-grupo?ids=${grupoIds.join(',')}`)}
                                className="flex items-center gap-2 px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors cursor-pointer group border-b border-gray-100 dark:border-white/[0.04] last:border-0"
                              >
                                <CalendarX2 size={13} className="text-gray-400 dark:text-[#555] shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-900 dark:text-white capitalize leading-tight">
                                    {rangoLabel}
                                  </p>
                                  <p className="text-[10px] text-gray-400 dark:text-[#666] mt-0.5">
                                    {grupo.length} ausencias
                                  </p>
                                </div>
                                {avisoBadge}
                                <div className="flex items-center gap-1 shrink-0">
                                  {grupo[0].inscripcion?.turno?.id && (
                                    <button
                                      onClick={e => { e.stopPropagation(); navigate(`/shifts/${grupo[0].inscripcion.turno.id}`) }}
                                      className="p-1.5 rounded-lg text-gray-300 dark:text-[#444] hover:text-primary hover:bg-primary/10 transition-all"
                                      title="Ver turno"
                                    >
                                      <ExternalLink size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); navigate(`/clients/${id}/ausencia?editGroupIds=${grupoIds.join(',')}`) }}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#666] hover:text-primary hover:bg-primary/10 transition-all"
                                    title="Editar grupo de ausencias"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setDeleteAusenciaIds(grupoIds) }}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#666] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    title="Eliminar grupo de ausencias"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                  <ChevronRight size={13} className="text-gray-300 dark:text-[#444] group-hover:text-gray-400 dark:group-hover:text-[#666] transition-colors" />
                                </div>
                              </div>
                            )
                          }

                          // Grupo de 1 item — render normal
                          const a = sortedItems[0]
                          return (
                            <div
                              key={gi}
                              onClick={() => navigate(`/clients/${id}/ausencia?ausenciaId=${a.id}`)}
                              className="hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors cursor-pointer group border-b border-gray-100 dark:border-white/[0.04] last:border-0 px-4 py-3"
                            >
                              <div className="flex items-start gap-2">
                                <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${a.conAviso ? 'bg-blue-500' : 'bg-red-400'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-gray-900 dark:text-white capitalize leading-tight">
                                      {safeFormatDate(a.fecha, "EEEE d 'de' MMMM yyyy", es)}
                                    </p>
                                    {avisoBadge}
                                  </div>
                                  <span className={`text-[10px] font-semibold ${
                                    a.recuperacion?.estado === 'COMPLETADA' ? 'text-emerald-500'
                                    : a.recuperacion?.estado === 'PENDIENTE' ? 'text-amber-500'
                                    : 'text-gray-400 dark:text-[#555]'
                                  }`}>
                                    {a.recuperacion?.estado === 'COMPLETADA' ? '✓ Recuperada'
                                      : a.recuperacion?.estado === 'PENDIENTE' ? `Pendiente${a.recuperacion.fecha ? ` — ${safeFormatDate(a.recuperacion.fecha, "d 'de' MMMM", es)}` : ''}${a.recuperacion.turnoDestino ? ` · ${a.recuperacion.turnoDestino.horaInicio}` : ''}`
                                      : 'Sin recuperar'}
                                  </span>
                                  {a.notas && (
                                    <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A] mt-0.5 leading-snug">{a.notas}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {a.inscripcion?.turno?.id && (
                                    <button
                                      onClick={e => { e.stopPropagation(); navigate(`/shifts/${a.inscripcion.turno.id}?date=${a.fecha.slice(0, 10)}`) }}
                                      className="p-1.5 rounded-lg text-gray-300 dark:text-[#444] hover:text-primary hover:bg-primary/10 transition-all"
                                      title="Ver turno"
                                    >
                                      <ExternalLink size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); navigate(`/clients/${id}/ausencia?ausenciaId=${a.id}`) }}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#666] hover:text-primary hover:bg-primary/10 transition-all"
                                    title="Editar ausencia"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setDeleteAusenciaIds([a.id]) }}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-[#666] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    title="Eliminar ausencia"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                  <ChevronRight size={13} className="text-gray-300 dark:text-[#444] group-hover:text-gray-400 dark:group-hover:text-[#666] transition-colors" />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {ausenciasImplicitas.map(r => {
                          const insc = inscripciones.find(i => i.turnoId === r.shiftId)
                          const fechaStr = r.date.slice(0, 10)
                          return (
                            <div
                              key={`impl-${r.id}`}
                              onClick={() => insc && navigate(`/clients/${id}/ausencia?inscripcionId=${insc.id}&fecha=${fechaStr}&dias=${insc.dias.join(',')}`)}
                              className={`hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group border-b border-gray-100 dark:border-white/[0.04] last:border-0 px-4 py-3 ${insc ? 'cursor-pointer' : ''}`}
                            >
                              <div className="flex items-start gap-2">
                                <div className="h-2 w-2 rounded-full shrink-0 mt-1.5 bg-red-400" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-gray-900 dark:text-white capitalize leading-tight">
                                      {safeFormatDate(r.date, "EEEE d 'de' MMMM yyyy", es)}
                                    </p>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-red-400/10 text-red-400">
                                      s/aviso
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 dark:text-[#666] mt-0.5">
                                    {r.shiftLabel}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {insc && (
                                    <button
                                      onClick={e => { e.stopPropagation(); navigate(`/clients/${id}/ausencia?inscripcionId=${insc.id}&fecha=${fechaStr}&dias=${insc.dias.join(',')}`) }}
                                      className="p-1.5 rounded-lg text-primary opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
                                      title="Registrar y agendar recupero"
                                    >
                                      <CalendarCheck2 size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); navigate(`/shifts/${r.shiftId}`) }}
                                    className="p-1.5 rounded-lg text-gray-300 dark:text-[#444] hover:text-primary hover:bg-primary/10 transition-all"
                                    title="Ver turno"
                                  >
                                    <ExternalLink size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        </>
                      ) : recuperos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <CalendarCheck2 size={20} className="text-gray-300 dark:text-[#444] mb-2" />
                          <p className="text-xs text-gray-400 dark:text-[#666]">Sin recuperos registrados</p>
                        </div>
                      ) : (
                        recuperos.map(a => {
                          const rec = a.recuperacion!
                          const isCanceling = cancelingRecupId === rec.id
                          return (
                            <div
                              key={rec.id}
                              className="px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group"
                            >
                              <div className="flex items-start gap-2">
                                {/* Dot de estado */}
                                <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                                  rec.estado === 'COMPLETADA' ? 'bg-emerald-500' : 'bg-amber-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  {/* Fecha de recupero */}
                                  <p className="text-xs font-bold text-gray-900 dark:text-white capitalize leading-tight">
                                    {safeFormatDate(rec.fecha, "EEEE d 'de' MMMM yyyy", es)}
                                  </p>
                                  {/* Turno destino */}
                                  <p className="text-[11px] text-gray-500 dark:text-[#8A8A9A] mt-0.5">
                                    {rec.turnoDestino.horaInicio}–{rec.turnoDestino.horaFin}
                                    {rec.turnoDestino.diasSemana.length > 0 && (
                                      <> · {rec.turnoDestino.diasSemana.join(', ')}</>
                                    )}
                                  </p>
                                  {/* Ausencia origen */}
                                  <p className="text-[10px] text-gray-400 dark:text-[#555] mt-0.5">
                                    Ausencia: {safeFormatDate(a.fecha, "d 'de' MMMM yyyy", es)}
                                  </p>
                                  {/* Estado badge */}
                                  <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                    rec.estado === 'COMPLETADA'
                                      ? 'bg-emerald-500/10 text-emerald-500'
                                      : 'bg-amber-400/10 text-amber-500'
                                  }`}>
                                    {rec.estado === 'COMPLETADA' ? '✓ Completada' : 'Pendiente'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Cancelar recupero (solo PENDIENTE) */}
                                  {rec.estado === 'PENDIENTE' && (
                                    <button
                                      disabled={isCanceling}
                                      onClick={async () => {
                                        setCancelingRecupId(rec.id)
                                        try {
                                          await reposicionesApi.cancelarRecuperacion(rec.id)
                                          // Actualización optimista: eliminar la recuperación del estado local
                                          setAusencias(prev => prev.map(au =>
                                            au.id === a.id
                                              ? { ...au, recuperacion: null }
                                              : au
                                          ))
                                          addToast('Recupero eliminado', 'success')
                                        } catch {
                                          addToast('Error al cancelar el recupero', 'error')
                                        } finally {
                                          setCancelingRecupId(null)
                                        }
                                      }}
                                      className="p-1.5 rounded-lg text-gray-300 dark:text-[#444] hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Cancelar recupero"
                                    >
                                      {isCanceling
                                        ? <span className="block h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                                        : <Trash2 size={13} />
                                      }
                                    </button>
                                  )}
                                  {/* Ir al turno */}
                                  <button
                                    onClick={() => navigate(`/shifts/${rec.turnoDestinoId}?date=${rec.fecha.slice(0, 10)}`)}
                                    className="p-1.5 rounded-lg text-gray-300 dark:text-[#444] hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                                    title="Ver turno"
                                  >
                                    <ChevronRight size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* ── Columna derecha: gráficos ── */}
                  <div className="flex flex-col">
                    {/* Torta — 3 estados */}
                    <div className="p-4 border-b border-gray-100 dark:border-white/[0.06]">
                      <div className="relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Presente',        value: nPresente, color: '#10B981' },
                                { name: 'Ausencia c/aviso', value: nConAviso, color: '#3B82F6' },
                                { name: 'Ausencia s/aviso', value: nAusente,  color: '#EF4444' },
                              ].filter(d => d.value > 0)}
                              cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                              paddingAngle={2} dataKey="value"
                            >
                              {['#10B981','#3B82F6','#EF4444'].map((c, i) => <Cell key={i} fill={c} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center pointer-events-none">
                          <span className="text-2xl font-black text-gray-900 dark:text-white">{pct}%</span>
                          <span className="text-[9px] uppercase tracking-wider text-gray-400">asistencia</span>
                        </div>
                      </div>
                      <div className="flex gap-3 justify-center flex-wrap">
                        {[
                          { label: 'Presente',        color: 'bg-emerald-500', n: nPresente },
                          { label: 'Ausencia c/aviso', color: 'bg-blue-500',    n: nConAviso },
                          { label: 'Ausencia s/aviso', color: 'bg-red-500',     n: nAusente },
                        ].map(l => (
                          <div key={l.label} className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${l.color}`} />
                            <span className="text-[10px] text-gray-500 dark:text-[#8A8A9A]">{l.label} ({l.n})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Toggle + Bar chart */}
                    <div className="flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-white/[0.06]">
                      {([['mensual','Por mes'],['diasSemana','Por día']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setChartView(v)}
                          className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all ${
                            chartView === v ? 'bg-gray-200 dark:bg-white/[0.09] text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#8A8A9A] hover:text-gray-700 dark:hover:text-white'
                          }`}
                        >{l}</button>
                      ))}
                    </div>
                    <div className="px-2 py-3 flex-1">
                      {chartView === 'mensual' ? (
                        monthlyStacked.length < 2 ? (
                          <p className="text-xs text-center text-gray-400 dark:text-[#555] py-6">Más datos disponibles con el tiempo</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={130}>
                            <BarChart data={monthlyStacked} barSize={12} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.07)" />
                              <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#8A8A9A' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#8A8A9A' }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [v, n === 'presente' ? 'Presente' : n === 'conAviso' ? 'Ausencia c/aviso' : 'Ausencia s/aviso']} />
                              <Bar dataKey="ausente"  stackId="a" fill="#EF4444" radius={[0,0,0,0]} />
                              <Bar dataKey="conAviso" stackId="a" fill="#3B82F6" radius={[0,0,0,0]} />
                              <Bar dataKey="presente" stackId="a" fill="#10B981" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      ) : (
                        byDayOfWeek.length === 0 ? (
                          <p className="text-xs text-center text-gray-400 dark:text-[#555] py-6">Sin datos</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={130}>
                            <BarChart data={byDayOfWeek} barSize={12} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.07)" />
                              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#8A8A9A' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#8A8A9A' }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [v, n === 'presente' ? 'Presente' : n === 'conAviso' ? 'Ausencia c/aviso' : 'Ausencia s/aviso']} />
                              <Bar dataKey="ausente"  stackId="a" fill="#EF4444" radius={[0,0,0,0]} />
                              <Bar dataKey="conAviso" stackId="a" fill="#3B82F6" radius={[0,0,0,0]} />
                              <Bar dataKey="presente" stackId="a" fill="#10B981" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </motion.div>}

          {/* ─── SECCIÓN 4: MEMBRESÍAS ──────────────────────────────────────────── */}
          {can('clients', 'view_membresias') && <motion.div variants={fadeUpItem} id="membresias" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
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
              {can('memberships', 'create') && (
                <button
                  onClick={() => navigate(`${ROUTES.PAYMENT_NEW}?clienteId=${client.id}`)}
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
                {can('memberships', 'create') && (
                  <button onClick={() => setNewMembresiaOpen(true)} className="text-xs text-primary hover:underline transition-colors">
                    Crear la primera membresía →
                  </button>
                )}
              </div>
            ) : (
              (() => {
                const membTotalPages = Math.ceil(membresias.length / MEMB_PAGE_SIZE)
                const membPageItems  = membresias.slice((membPage - 1) * MEMB_PAGE_SIZE, membPage * MEMB_PAGE_SIZE)
                return (
                  <div className="space-y-2.5">
                    {membPageItems.map(m => {
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
                            {can('memberships', 'update') && (m.estado === 'ACTIVA' || m.estado === 'PENDIENTE') && (
                              <button
                                onClick={() => handleCancelarMembresia(m.id)}
                                className="text-xs font-semibold text-gray-400 hover:text-amber-400 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
                              >
                                Cancelar
                              </button>
                            )}
                            {can('memberships', 'delete') && (
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

                    {/* Paginación */}
                    {membTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-1 px-1">
                        <span className="text-xs text-gray-500 dark:text-[#8A8A9A]">
                          {(membPage - 1) * MEMB_PAGE_SIZE + 1}–{Math.min(membPage * MEMB_PAGE_SIZE, membresias.length)} de {membresias.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setMembPage(p => Math.max(1, p - 1))}
                            disabled={membPage === 1}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/20 text-gray-500 dark:text-gray-400 transition-all hover:bg-white/60 dark:hover:bg-black/40 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          {Array.from({ length: membTotalPages }, (_, i) => i + 1).map(p => (
                            <button
                              key={p}
                              onClick={() => setMembPage(p)}
                              className={`h-7 min-w-[1.75rem] rounded-lg px-2 text-xs font-bold transition-all ${
                                membPage === p
                                  ? 'bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900'
                                  : 'border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/20 text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-black/40'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            onClick={() => setMembPage(p => Math.min(membTotalPages, p + 1))}
                            disabled={membPage === membTotalPages}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/20 text-gray-500 dark:text-gray-400 transition-all hover:bg-white/60 dark:hover:bg-black/40 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </motion.div>}

          {/* ─── SECCIÓN 5: PAGOS Y FACTURACIÓN ───────────────────────────────────── */}
          {can('clients', 'view_pagos') && <motion.div variants={fadeUpItem} id="pagos" className={`${glassCard} p-6 space-y-6 scroll-mt-24`}>
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
                    <div className="space-y-2.5">
                      {payments.slice(0, visiblePayments).map(p => {
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
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums leading-none">
                                  {formatCurrency(p.amount)}
                                </p>
                                <span className="text-[10px] font-bold text-primary flex items-center gap-0.5 justify-end mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  Ver pago <ChevronRight size={10} className="stroke-[3]" />
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {visiblePayments < payments.length && (
                        <button
                          onClick={() => setVisiblePayments(v => v + PAYMENTS_PAGE_SIZE)}
                          className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02] text-xs font-semibold text-gray-500 dark:text-[#8A8A9A] hover:bg-white/60 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white transition-all"
                        >
                          Ver más · {payments.length - visiblePayments} restantes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : client.exentoDePago ? (
              <div className="flex items-center gap-4 p-5 border border-dashed border-emerald-500/20 dark:border-emerald-500/15 rounded-2xl bg-emerald-500/[0.03]">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Cliente exento de pago</p>
                  <p className="text-xs text-gray-400 dark:text-[#6A6A7A] mt-0.5">El sistema lo marca como al día automáticamente. Podés asignarle una membresía para llevar registro de su período activo.</p>
                </div>
                {can('memberships', 'create') && (
                  <button onClick={() => setNewMembresiaOpen(true)} className="shrink-0 text-xs text-primary hover:underline transition-colors">
                    Asignar →
                  </button>
                )}
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
          </motion.div>}
          {/* ─── SECCIÓN 6: REPOSICIONES (eliminada — movida a Sección 3 Asistencia) ─ */}
          {false && <motion.div variants={fadeUpItem} id="reposiciones" className={`${glassCard} p-6 space-y-5 scroll-mt-24`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <CalendarX2 size={18} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">Ausencias y Recuperaciones</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">Historial de faltas y clases recuperadas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadAusencias}
                  disabled={loadingAusencias}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all active:scale-[0.92]"
                  title="Recargar"
                >
                  <RefreshCw size={14} className={loadingAusencias ? 'animate-spin' : ''} />
                </button>
                <button
                  disabled={inscripciones.length === 0}
                  onClick={() => inscripciones.length > 0 && navigate(`/clients/${id}/ausencia?inscripcionId=${inscripciones[0].id}&dias=${inscripciones[0].dias.join(',')}`)}
                  title={inscripciones.length === 0 ? 'No disponible porque el cliente no tiene ningún turno asignado' : undefined}
                  className={`flex items-center gap-1.5 rounded-xl btn-action px-4 py-2.5 text-sm ${inscripciones.length === 0 ? 'opacity-40 cursor-not-allowed saturate-50' : ''}`}
                >
                  <CalendarX2 size={12} /> Registrar ausencia
                </button>
              </div>
            </div>

            {loadingAusencias ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
              </div>
            ) : ausencias.length === 0 && ausenciasImplicitas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="h-14 w-14 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] flex items-center justify-center">
                  <CalendarCheck2 size={22} className="text-gray-300 dark:text-[#444]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]">Sin ausencias registradas</p>
                  <p className="text-xs text-gray-400 dark:text-[#555] mt-1">¡Excelente asistencia!</p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                <div className="space-y-3">
                  {ausenciasImplicitas.map(r => {
                    const insc = inscripciones.find(i => i.turnoId === r.shiftId)
                    const fechaStr = r.date.slice(0, 10)
                    return (
                      <motion.div
                        key={`impl-${r.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/40 dark:bg-white/[0.02] px-4 py-4 group"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <CalendarX2 size={14} className="text-red-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatDate(r.date)}
                              </p>
                              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20">
                                sin aviso
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">{r.shiftLabel}</p>
                          </div>
                        </div>
                        {insc && (
                          <button
                            onClick={() => navigate(`/clients/${id}/ausencia?inscripcionId=${insc.id}&fecha=${fechaStr}&dias=${insc.dias.join(',')}`)}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all active:scale-[0.96] opacity-0 group-hover:opacity-100"
                          >
                            <CalendarCheck2 size={12} /> Agendar
                          </button>
                        )}
                      </motion.div>
                    )
                  })}
                  {ausencias.map(a => {
                    const recup = a.recuperacion
                    const estado = recup?.estado ?? 'SIN_RECUPERACION'

                    const estadoCfg = {
                      SIN_RECUPERACION: {
                        icon: <CalendarX2 size={14} className="text-red-400 shrink-0" />,
                        badge: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20',
                        label: 'Sin recuperar',
                        dot: 'bg-red-500',
                      },
                      PENDIENTE: {
                        icon: <CalendarCheck2 size={14} className="text-amber-400 shrink-0" />,
                        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                        label: 'Recuperación pendiente',
                        dot: 'bg-amber-500',
                      },
                      COMPLETADA: {
                        icon: <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />,
                        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        label: 'Recuperada',
                        dot: 'bg-emerald-500',
                      },
                      CANCELADA: {
                        icon: <XCircle size={14} className="text-gray-400 shrink-0" />,
                        badge: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20',
                        label: 'Cancelada',
                        dot: 'bg-gray-400',
                      },
                    }[estado] ?? {
                      icon: <CalendarX2 size={14} className="text-red-400 shrink-0" />,
                      badge: 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20',
                      label: 'Sin recuperar',
                      dot: 'bg-red-500',
                    }

                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="flex items-start justify-between gap-3 rounded-2xl
                          border border-gray-200 dark:border-white/[0.07]
                          bg-white/40 dark:bg-white/[0.02]
                          px-4 py-4
                          group"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {estadoCfg.icon}
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatDate(a.fecha)}
                              </p>
                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${estadoCfg.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${estadoCfg.dot}`} />
                                {estadoCfg.label}
                              </span>
                              {a.conAviso ? (
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                                  con aviso
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20">
                                  sin aviso
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-[#8A8A9A]">
                              {a.inscripcion?.turno?.horaInicio} – {a.inscripcion?.turno?.horaFin}
                            </p>
                            {recup && estado === 'PENDIENTE' && (
                              <p className="text-xs font-semibold text-amber-500 dark:text-amber-400 flex items-center gap-1">
                                <CalendarCheck2 size={11} />
                                {formatDate(recup.fecha)} · {recup.turnoDestino?.horaInicio} – {recup.turnoDestino?.horaFin}
                              </p>
                            )}
                            {recup && estado === 'COMPLETADA' && (
                              <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 size={11} />
                                Recuperó el {formatDate(recup.fecha)}
                              </p>
                            )}
                            {a.notas && (
                              <p className="text-xs text-gray-400 dark:text-[#666] italic truncate">{a.notas}</p>
                            )}
                          </div>
                        </div>
                        {/* Acción: agendar recuperación */}
                        {estado === 'SIN_RECUPERACION' && (
                          <button
                            onClick={() => openDrawerRecuperar(a)}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                              text-xs font-bold
                              text-primary border border-primary/20
                              bg-primary/5 hover:bg-primary/10
                              transition-all active:scale-[0.96]
                              opacity-0 group-hover:opacity-100"
                          >
                            <CalendarCheck2 size={12} /> Agendar
                          </button>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </AnimatePresence>
            )}
          </motion.div>}

          <div className="h-[35vh]" />
        </motion.div>
      </div>


      {/* ── REPOSICION DRAWER ────────────────────────────────────────────────── */}
      <ReposicionDrawer
        isOpen={reposicionDrawerOpen}
        onClose={() => setReposicionDrawerOpen(false)}
        onSuccess={loadAusencias}
        mode={drawerMode}
        ausencia={drawerAusencia ?? undefined}
        inscripcionId={drawerInscripcionId ?? undefined}
        clienteNombre={client ? `${client.name} ${client.lastName}` : undefined}
        turnoLabel={
          drawerInscripcionId
            ? inscripciones.find(i => i.id === drawerInscripcionId)
              ? (() => {
                  const insc = inscripciones.find(i => i.id === drawerInscripcionId)
                  return insc ? `${insc.startTime} – ${insc.endTime}` : undefined
                })()
              : undefined
            : drawerAusencia?.inscripcion?.turno
              ? `${drawerAusencia.inscripcion.turno.horaInicio} – ${drawerAusencia.inscripcion.turno.horaFin}`
              : undefined
        }
      />

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
                { label: 'Días restantes', value: daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} días` : 'Expirada') : '—' },
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
            {client.exentoDePago && newMembresiaForm.planId && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <Shield size={11} /> Cliente exento — precio cargado en $0, podés modificarlo
              </div>
            )}
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
      <Modal isOpen={enrollOpen} onClose={() => setEnrollOpen(false)} title="Añadir turno" size="3xl" noScroll>
        {(() => {
          const totalDiasUsados = inscripciones.reduce((acc, i) => acc + i.dias.length, 0)
          const planFreq = client.planFrequency ? Number(client.planFrequency) : null
          const diasYaSeleccionados = selectedEnrolls.reduce((acc, s) => {
            const shift = allShifts.find(sh => String(sh.id) === s.turnoId)
            return acc + (shift ? shift.days.length : 0)
          }, 0)
          const diasDisponibles = planFreq !== null ? planFreq - totalDiasUsados - diasYaSeleccionados : Infinity
          const limiteAlcanzado = planFreq !== null && diasDisponibles <= 0 && selectedEnrolls.length === 0

          if (limiteAlcanzado) return (
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

          const enrolledIds = new Set(inscripciones.map(i => i.turnoId))
          const notEnrolled = allShifts.filter(s => !enrolledIds.has(String(s.id)))

          // Profesores únicos para el filtro
          const profesores = Array.from(new Set(
            notEnrolled.map(s => s.profesorSalaANombre || s.profesorSalaBNombre).filter((p): p is string => !!p)
          )).sort()

          // Aplicar filtros
          const filtered = notEnrolled.filter(s => {
            if (filterDia && !s.days.includes(filterDia as WeekDay)) return false
            if (filterProfesor && (s.profesorSalaANombre || s.profesorSalaBNombre) !== filterProfesor) return false
            if (filterHorario) {
              const h = parseInt(s.startTime.split(':')[0], 10)
              if (filterHorario === 'mañana' && h >= 12) return false
              if (filterHorario === 'tarde' && (h < 12 || h >= 18)) return false
              if (filterHorario === 'noche' && h < 18) return false
            }
            return true
          })

          // Separar disponibles vs exceden
          const diasDisponiblesBase = planFreq !== null ? planFreq - totalDiasUsados : Infinity
          const available = filtered.filter(s => s.days.length <= diasDisponiblesBase)
          const exceden = planFreq !== null ? filtered.filter(s => s.days.length > diasDisponiblesBase) : []

          const DIAS_SEMANA: { key: WeekDay; label: string }[] = [
            { key: 'monday', label: 'Lun' }, { key: 'tuesday', label: 'Mar' },
            { key: 'wednesday', label: 'Mié' }, { key: 'thursday', label: 'Jue' },
            { key: 'friday', label: 'Vie' }, { key: 'saturday', label: 'Sáb' },
          ]
          const HORARIOS = [
            { key: 'mañana', label: 'Mañana', sub: 'antes de 12 h' },
            { key: 'tarde',  label: 'Tarde',  sub: '12 – 18 h' },
            { key: 'noche',  label: 'Noche',  sub: 'después de 18 h' },
          ]

          const hayFiltros = filterDia || filterHorario || filterProfesor

          return (
            <div className="flex flex-col min-h-0 flex-1 relative h-[680px]">
              {/* Blobs decorativos */}
              <div className="pointer-events-none absolute -inset-6 -z-10">
                <div className="absolute -top-10 -left-10 w-80 h-80 rounded-full bg-primary/25 blur-[100px]" />
                <div className="absolute -bottom-10 -right-10 w-72 h-72 rounded-full bg-blue-500/20 blur-[100px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-primary/10 blur-[80px]" />
              </div>

              {/* ── Indicador de cupo ── */}
              {planFreq !== null && (
                <div className="flex items-center justify-between px-1 pb-3 mb-0 border-b border-white/10 dark:border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-[#8A8A9A]">
                      Inscripciones disponibles
                    </span>
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900">
                      {Math.max(diasDisponibles, 0)} de {planFreq} día{planFreq !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {selectedEnrolls.length > 0 && (
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      {selectedEnrolls.length} turno{selectedEnrolls.length !== 1 ? 's' : ''} seleccionado{selectedEnrolls.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              <div className="flex gap-0 min-h-0 flex-1 pt-3">
              {/* ── 2/3 Grilla de turnos ── */}
              <div className="flex-[2] min-w-0 overflow-y-auto pr-4 border-r border-white/10 dark:border-white/[0.06]">
                {loadingShifts ? (
                  <div className="space-y-2 p-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-20 rounded-2xl animate-pulse bg-gray-100 dark:bg-white/[0.05]" />
                    ))}
                  </div>
                ) : notEnrolled.length === 0 ? (
                  <p className="text-sm text-center text-gray-500 dark:text-[#8A8A9A] py-12">
                    El cliente ya está inscripto en todos los turnos disponibles.
                  </p>
                ) : (available.length === 0 && exceden.length === 0) ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <p className="text-sm text-gray-500 dark:text-white/40">Sin turnos para los filtros aplicados</p>
                    <button onClick={() => { setFilterDia(null); setFilterHorario(null); setFilterProfesor(null) }} className="text-xs text-primary hover:underline">
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
                    {available.map((shift, idx) => {
                      const selected = selectedEnrolls.find(s => s.turnoId === String(shift.id))
                      const shiftDays = shift.days.length
                      const bloqueado = !selected && diasDisponibles < shiftDays

                      return (
                      <motion.div
                        key={shift.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: Math.min(idx * 0.04, 0.24) }}
                        className={`rounded-2xl border backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] p-4 space-y-3 [transition:background-color_150ms_ease-out,border-color_150ms_ease-out] ${
                          selected
                            ? 'border-primary/50 bg-primary/[0.08] dark:bg-primary/[0.06] ring-1 ring-primary/30'
                            : bloqueado
                              ? 'border-white/15 dark:border-white/[0.04] bg-white/10 dark:bg-white/[0.02] opacity-45'
                              : 'border-white/30 dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.04] hover:bg-white/30 dark:hover:bg-white/[0.07] hover:border-white/50 dark:hover:border-white/[0.14]'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {shift.startTime} – {shift.endTime}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-0.5">
                            {shift.days.map(d => WEEKDAY_SHORT[d] ?? d).join(' · ')}
                          </p>
                          {(shift.profesorSalaANombre || shift.profesorSalaBNombre) && (
                            <p className="text-[11px] text-gray-400 dark:text-white/35 mt-0.5">
                              {shift.profesorSalaANombre && shift.profesorSalaBNombre && shift.profesorSalaANombre !== shift.profesorSalaBNombre
                                ? '2 profesores'
                                : shift.profesorSalaANombre || shift.profesorSalaBNombre}
                            </p>
                          )}
                        </div>
                        {bloqueado ? (
                          <span className="block text-center text-[10px] font-semibold text-gray-400 dark:text-white/30 py-1">Sin cupo disponible en el plan</span>
                        ) : (
                        <div className="flex gap-2">
                          {(['A', 'B'] as const).map(sala => {
                            const insc = sala === 'A' ? shift.inscritosA : shift.inscritosB
                            const cupo = sala === 'A' ? shift.cupoMaximoSalaA : shift.cupoMaximoSalaB
                            const lleno = insc >= cupo
                            const isSelected = selected?.sala === sala
                            return (
                              <button
                                key={sala}
                                disabled={lleno || enrollingSaving}
                                onClick={() => toggleEnrollSelection(String(shift.id), sala, shiftDays)}
                                style={{ transition: 'background-color 150ms ease-out, border-color 150ms ease-out, transform 100ms ease-out' }}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border ${
                                  isSelected
                                    ? 'bg-primary/25 text-amber-800 dark:text-amber-300 border-primary ring-1 ring-primary/30'
                                    : lleno
                                      ? 'opacity-40 cursor-not-allowed bg-gray-200/50 dark:bg-gray-500/10 text-gray-400 border-gray-300 dark:border-white/10'
                                      : 'bg-primary/10 text-amber-800 dark:text-amber-300 border-amber-700/40 dark:border-amber-400/40 hover:bg-primary/20 hover:border-amber-700/60 dark:hover:border-amber-400/60 active:scale-[0.97]'
                                }`}
                              >
                                {isSelected
                                  ? <><Check size={12} className="text-primary" /><span>Sala {sala}</span></>
                                  : <><span>Sala {sala}</span><span className="opacity-60 font-normal">{insc}/{cupo}</span></>}
                              </button>
                            )
                          })}
                        </div>
                        )}
                      </motion.div>
                      )
                    })}
                    {exceden.map(shift => (
                      <div key={shift.id} className="rounded-2xl border border-white/15 dark:border-white/[0.04] bg-white/10 dark:bg-white/[0.02] backdrop-blur-xl p-4 opacity-45">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{shift.startTime} – {shift.endTime}</p>
                            <p className="text-xs text-gray-500 dark:text-[#8A8A9A] mt-0.5">{shift.days.map(d => WEEKDAY_SHORT[d] ?? d).join(' · ')}</p>
                            {(shift.profesorSalaANombre || shift.profesorSalaBNombre) && <p className="text-[11px] text-gray-400 dark:text-white/35 mt-0.5">{shift.profesorSalaANombre || shift.profesorSalaBNombre}</p>}
                          </div>
                          <span className="shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">Excede el plan</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 1/3 Panel de filtros ── */}
              <div className="flex-[1] min-w-[180px] pl-4 space-y-3 overflow-y-auto">

                {/* Header filtros */}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-white/25">Filtros</p>
                  {hayFiltros && (
                    <button
                      onClick={() => { setFilterDia(null); setFilterHorario(null); setFilterProfesor(null) }}
                      className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold transition-colors duration-150 hover:text-amber-900 dark:hover:text-amber-200 active:scale-[0.97]"
                      style={{ transition: 'color 150ms ease-out, transform 100ms ease-out' }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Card: Día */}
                <div className="rounded-2xl border border-white/20 dark:border-white/[0.08] bg-white/15 dark:bg-white/[0.04] backdrop-blur-sm p-3 space-y-2.5">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-white/35 uppercase tracking-widest">Día</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map(({ key, label }) => {
                      const active = filterDia === key
                      return (
                        <button
                          key={key}
                          onClick={() => setFilterDia(active ? null : key)}
                          style={{ transition: 'color 150ms ease-out, transform 100ms ease-out' }}
                          className={`relative px-2.5 py-1.5 rounded-full text-[11px] font-bold active:scale-[0.97] ${
                            active
                              ? 'text-white dark:text-gray-900 border border-transparent'
                              : 'text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white border border-dashed border-gray-300 dark:border-white/20'
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="enroll-dia-pill"
                              className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                              style={{ zIndex: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            />
                          )}
                          <span className="relative z-10">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Card: Horario */}
                <div className="rounded-2xl border border-white/20 dark:border-white/[0.08] bg-white/15 dark:bg-white/[0.04] backdrop-blur-sm p-3 space-y-2.5">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-white/35 uppercase tracking-widest">Horario</p>
                  <div className="space-y-1.5">
                    {HORARIOS.map(({ key, label, sub }) => {
                      const active = filterHorario === key
                      return (
                        <button
                          key={key}
                          onClick={() => setFilterHorario(active ? null : key)}
                          style={{ transition: 'color 150ms ease-out, transform 100ms ease-out' }}
                          className={`relative w-full text-left px-3 py-2 rounded-full text-[11px] font-semibold active:scale-[0.97] ${
                            active
                              ? 'text-white dark:text-gray-900 border border-transparent'
                              : 'text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white border border-dashed border-gray-300 dark:border-white/20'
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="enroll-horario-pill"
                              className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                              style={{ zIndex: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            />
                          )}
                          <span className="relative z-10">{label}<span className="ml-1.5 font-normal opacity-55 text-[10px]">{sub}</span></span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Card: Profesor */}
                {profesores.length > 0 && (
                  <div className="rounded-2xl border border-white/20 dark:border-white/[0.08] bg-white/15 dark:bg-white/[0.04] backdrop-blur-sm p-3 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-white/35 uppercase tracking-widest">Profesor</p>
                    <div className="space-y-1.5">
                      {profesores.map(prof => {
                        const active = filterProfesor === prof
                        return (
                          <button
                            key={prof}
                            onClick={() => setFilterProfesor(active ? null : prof)}
                            style={{ transition: 'color 150ms ease-out, border-color 150ms ease-out, transform 100ms ease-out' }}
                            className={`relative w-full text-left px-3 py-2 rounded-full text-[11px] font-semibold border active:scale-[0.97] ${
                              active
                                ? 'text-white dark:text-gray-900 border-transparent'
                                : 'border-dashed border-gray-300 dark:border-white/20 text-gray-500 dark:text-white/45 hover:border-gray-400 dark:hover:border-white/30 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            {active && (
                              <motion.div
                                layoutId="enroll-profesor-pill"
                                className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                                style={{ zIndex: 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              />
                            )}
                            <span className="relative z-10 truncate">{prof}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              </div>

              {/* ── Aviso días superpuestos ── */}
              {(() => {
                if (selectedEnrolls.length < 2) return null
                const dayCounts: Record<string, number> = {}
                selectedEnrolls.forEach(s => {
                  const shift = allShifts.find(sh => String(sh.id) === s.turnoId)
                  if (shift) shift.days.forEach(d => { dayCounts[d] = (dayCounts[d] ?? 0) + 1 })
                })
                const diasRepetidos = Object.entries(dayCounts).filter(([, c]) => c >= 2).map(([d]) => WEEKDAY_SHORT[d] ?? d)
                if (diasRepetidos.length === 0) return null
                return (
                  <div className="shrink-0 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] dark:bg-amber-400/[0.04] px-3.5 py-2.5 mt-3 mb-1">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 leading-relaxed">
                      Seleccionaste 2 o más turnos el mismo día: <span className="font-black">{diasRepetidos.join(', ')}</span>.
                    </p>
                  </div>
                )
              })()}

              {/* ── Botón Guardar ── */}
              {selectedEnrolls.length > 0 && (
                <div className="shrink-0 pt-3 mt-0 border-t border-white/10 dark:border-white/[0.06]">
                  <button
                    onClick={handleEnrollSave}
                    disabled={enrollingSaving}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl btn-action px-5 py-3 text-sm font-bold disabled:opacity-60"
                  >
                    {enrollingSaving
                      ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
                      : null}
                    Guardar {selectedEnrolls.length} inscripción{selectedEnrolls.length !== 1 ? 'es' : ''}
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      <ConfirmDialog
        isOpen={deleteRutinaId !== null}
        title="Eliminar rutina"
        message={`¿Eliminás la rutina "${rutinas.find(r => r.id === deleteRutinaId)?.nombre ?? ''}"? Esta acción no se puede deshacer.`}
        warning={rutinas.find(r => r.id === deleteRutinaId)?.activa
          ? 'Esta es la rutina activa del cliente. Al eliminarla quedará sin rutina activa.'
          : undefined}
        confirmLabel="Eliminar"
        isLoading={deletingRutina}
        onConfirm={() => void handleDeleteRutina()}
        onClose={() => setDeleteRutinaId(null)}
      />

      <ConfirmDialog
        isOpen={showExentoConfirm}
        title="Activar exención de pago"
        message={`${client?.name} ${client?.lastName} quedará marcado como cliente exento. Esto tiene las siguientes implicancias:`}
        details={[
          'Siempre figurará como "Al día" en el sistema, aunque su membresía esté vencida o sin renovar.',
          'No será afectado por la baja automática por vencimiento: el cron de inactivación lo saltea.',
          'No aparecerá en alertas de deuda del dashboard ni en los correos de notificación de mora.',
          'Igual necesita una membresía activa para que el sistema sepa en qué turnos puede inscribirse y cuándo vence su período.',
        ]}
        warning="Esta exención debe ser por un motivo puntual. Completá el campo Motivo antes de guardar para dejar registro del contexto."
        confirmLabel="Activar exención"
        confirmVariant="primary"
        onConfirm={() => { setValue('exentoDePago', true); setShowExentoConfirm(false) }}
        onClose={() => setShowExentoConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showInactivarDialog}
        title={`Inactivar a ${client?.name} ${client?.lastName}`}
        message="El cliente pasará a estado inactivo. Esto desencadenará los siguientes efectos:"
        details={[
          ...(inscripciones.length > 0
            ? [`Se dará de baja de ${inscripciones.length} turno${inscripciones.length !== 1 ? 's' : ''} activo${inscripciones.length !== 1 ? 's' : ''}, liberando los cupos.`]
            : ['No tiene turnos activos, por lo que no se afectarán inscripciones.']),
          'Sus membresías quedan registradas pero el cliente deja de figurar en el listado de activos.',
          'No recibirá notificaciones automáticas del sistema mientras esté inactivo.',
          'Se puede reactivar manualmente desde este perfil, o automáticamente al registrar un pago desde la sección de pagos (el formulario pregunta si reactivar al detectar que está inactivo).',
        ]}
        warning={inscripciones.length > 0 ? 'El cliente deberá reinscribirse manualmente en los turnos si se reactiva.' : undefined}
        confirmLabel="Inactivar cliente"
        isLoading={isTogglingActivity}
        onConfirm={() => void ejecutarCambioActividad('INACTIVO')}
        onClose={() => setShowInactivarDialog(false)}
      />

      <ConfirmDialog
        isOpen={showReactivarDialog}
        title={`Reactivar a ${client?.name} ${client?.lastName}`}
        message="El cliente volverá al estado activo. Esto desencadenará los siguientes efectos:"
        details={[
          'Volverá a figurar en el listado de clientes activos.',
          'Sus membresías vigentes quedarán disponibles nuevamente.',
          'Deberá inscribirse manualmente a los turnos que desee asistir.',
          'Comenzará a recibir notificaciones automáticas del sistema.',
        ]}
        confirmLabel="Reactivar cliente"
        confirmVariant="primary"
        isLoading={isTogglingActivity}
        onConfirm={() => void ejecutarCambioActividad('ACTIVO')}
        onClose={() => setShowReactivarDialog(false)}
      />

      <ConfirmDialog
        isOpen={deleteAusenciaIds !== null}
        title={deleteAusenciaIds && deleteAusenciaIds.length > 1 ? 'Eliminar grupo de ausencias' : 'Eliminar ausencia'}
        message={deleteAusenciaIds && deleteAusenciaIds.length > 1
          ? `¿Eliminás las ${deleteAusenciaIds.length} ausencias del grupo? Si tienen recuperaciones agendadas, también se eliminarán.`
          : '¿Eliminás esta ausencia? Si tiene una recuperación agendada, también se eliminará.'}
        confirmLabel="Eliminar"
        isLoading={deletingAusencia}
        onConfirm={() => void handleDeleteAusencia()}
        onClose={() => setDeleteAusenciaIds(null)}
      />

    </motion.div>

    {createPortal(

      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/50 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <Trash2 size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">¿Eliminar cliente?</h3>
                  <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">
                    Vas a eliminar a <span className="font-semibold text-gray-700 dark:text-white/70">{client?.name} {client?.lastName}</span> y <span className="font-semibold text-gray-700 dark:text-white/70">todos sus datos asociados</span>: pagos, membresías, inscripciones a turnos, asistencias, rutinas y ficha de entrenamiento. Esta acción no tiene vuelta atrás.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-black text-black hover:bg-primary-dark transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteClient}
                  disabled={isDeleting}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-black text-white hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  )
}
