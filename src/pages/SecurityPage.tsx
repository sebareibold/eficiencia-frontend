import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, cardVariants } from '../lib/motion'
import {
  Shield, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp,
  RefreshCw, LogIn, LogOut, KeyRound, Settings, Trash2, UserCheck,
  MonitorCheck, Clock, Activity, Info, Search, X, ListChecks,
  CheckCircle2, ArrowLeft,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { auditoriaApi, type EventoSeguridad, type ResumenSeguridad, type TipoEvento } from '../api/auditoria.api'
import KpiCard from '../components/ui/KpiCard'
import Skeleton from '../components/ui/Skeleton'

// ── Configuración visual por tipo de evento ──────────────────────────────────

const TIPO_CONFIG: Record<TipoEvento, {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge: string
  color: string
}> = {
  LOGIN_EXITOSO:       { label: 'Login',          icon: LogIn,       badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', color: '#34d399' },
  LOGIN_FALLIDO:       { label: 'Login fallido',  icon: ShieldAlert, badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',              color: '#f87171' },
  LOGOUT:              { label: 'Logout',          icon: LogOut,      badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',        color: '#94a3b8' },
  CONTRASENA_CAMBIADA: { label: 'Contraseña',      icon: KeyRound,    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',     color: '#818cf8' },
  PERMISO_MODIFICADO:  { label: 'Permiso',         icon: Settings,    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',        color: '#fbbf24' },
  ROL_CAMBIADO:        { label: 'Rol cambiado',    icon: UserCheck,   badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',    color: '#c084fc' },
  PAGO_ELIMINADO:      { label: 'Pago eliminado',  icon: Trash2,      badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',               color: '#fb923c' },
}

const TIPO_FILTER_OPTIONS = [
  { value: '',                   label: 'Todos' },
  { value: 'LOGIN_FALLIDO',      label: 'Login fallido' },
  { value: 'PAGO_ELIMINADO',     label: 'Pago eliminado' },
  { value: 'PERMISO_MODIFICADO', label: 'Permiso' },
  { value: 'ROL_CAMBIADO',       label: 'Rol cambiado' },
]

const PERIODO_OPTIONS = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d',  label: '7 días' },
  { value: '30d', label: '30 días' },
] as const
type Periodo = typeof PERIODO_OPTIONS[number]['value']

// ── Tipos de alerta y severidad ───────────────────────────────────────────────

type AlertSeverity = 'danger' | 'warning' | 'info'

interface AlertItem {
  id: string
  severity: AlertSeverity
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  description: string
  action: string
  events?: EventoSeguridad[]
}

const SEV: Record<AlertSeverity, {
  wrap: string; iconBg: string; iconColor: string; title: string
  dot: string; evBg: string; blob: string; step: string
  urgencyBadge: string; cardGlow: string
}> = {
  danger: {
    wrap:         'bg-red-50/80 dark:bg-red-500/[0.07] border-red-200 dark:border-red-500/20',
    iconBg:       'bg-red-100 dark:bg-red-500/15',
    iconColor:    'text-red-500 dark:text-red-400',
    title:        'text-red-700 dark:text-red-300',
    dot:          'bg-red-400',
    evBg:         'bg-red-100/60 dark:bg-red-500/[0.06] border-red-200 dark:border-red-500/10',
    blob:         'bg-red-500',
    step:         'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    urgencyBadge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    cardGlow:     'shadow-red-500/5',
  },
  warning: {
    wrap:         'bg-amber-50/80 dark:bg-amber-500/[0.07] border-amber-200 dark:border-amber-500/20',
    iconBg:       'bg-amber-100 dark:bg-amber-500/15',
    iconColor:    'text-amber-600 dark:text-amber-400',
    title:        'text-amber-700 dark:text-amber-300',
    dot:          'bg-amber-400',
    evBg:         'bg-amber-100/60 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/10',
    blob:         'bg-amber-500',
    step:         'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    urgencyBadge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    cardGlow:     'shadow-amber-500/5',
  },
  info: {
    wrap:         'bg-blue-50/80 dark:bg-blue-500/[0.07] border-blue-200 dark:border-blue-500/20',
    iconBg:       'bg-blue-100 dark:bg-blue-500/15',
    iconColor:    'text-blue-600 dark:text-blue-400',
    title:        'text-blue-700 dark:text-blue-300',
    dot:          'bg-blue-400',
    evBg:         'bg-blue-100/60 dark:bg-blue-500/[0.06] border-blue-200 dark:border-blue-500/10',
    blob:         'bg-blue-500',
    step:         'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    urgencyBadge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    cardGlow:     'shadow-blue-500/5',
  },
}

// ── Protocolos de respuesta ───────────────────────────────────────────────────

interface Protocol {
  id: string
  severity: AlertSeverity
  urgency: string
  title: string
  description: string
  steps: string[]
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const PROTOCOLS: Protocol[] = [
  {
    id: 'login-fallidos',
    severity: 'danger',
    urgency: 'Alta',
    icon: ShieldAlert,
    title: 'Login fallidos repetidos',
    description: 'Múltiples intentos de acceso con credenciales incorrectas. Puede ser un error del usuario o un ataque de fuerza bruta desde el exterior.',
    steps: [
      'Expandí el evento en la tabla para ver la IP de origen exacta y la hora.',
      'Verificá si esa IP es reconocida: ¿es el WiFi del gimnasio, tu casa u otro lugar conocido?',
      'Si la IP es desconocida → contactá al usuario afectado de inmediato por teléfono o mensaje.',
      'Pedile que cambie su contraseña desde Configuración → Seguridad → Cambiar contraseña.',
      'Si los intentos continúan desde la misma IP → anotá la IP y reportá el incidente a tu hosting (Railway) para bloquearla a nivel de red.',
      'Documentá el incidente con fecha, IP afectada, email del usuario objetivo y todas las acciones tomadas.',
    ],
  },
  {
    id: 'pagos-eliminados',
    severity: 'warning',
    urgency: 'Media–Alta',
    icon: Trash2,
    title: 'Pagos eliminados del sistema',
    description: 'Se borraron uno o más registros de pago. Esta acción es irreversible y puede afectar el historial financiero del gimnasio.',
    steps: [
      'Expandí el evento en la tabla para ver exactamente quién eliminó el pago, a qué hora y desde qué IP.',
      'Buscá el comprobante físico o digital del cobro correspondiente a ese pago.',
      'Si fue un error tuyo: podés recrear el pago manualmente desde la sección Pagos con los datos del comprobante.',
      'Si lo hizo otro usuario: hablá con esa persona directamente para entender el motivo antes de actuar.',
      'Si la eliminación es sospechosa o no la reconocés: cambiá las contraseñas de todos los usuarios con rol admin de inmediato.',
      'Para evitar que se repita, revisá quién tiene permiso de eliminar pagos en Usuarios → Roles y Permisos y ajustá según corresponda.',
    ],
  },
  {
    id: 'cambios-permisos',
    severity: 'warning',
    urgency: 'Alta',
    icon: UserCheck,
    title: 'Cambios de roles o permisos',
    description: 'Se modificaron los permisos o el rol de un usuario del sistema. Un cambio no autorizado puede dar acceso indebido a secciones sensibles.',
    steps: [
      'Expandí el evento para ver qué usuario fue modificado, quién realizó el cambio y desde qué IP.',
      'Accedé a Usuarios → Roles y Permisos para revisar el estado actual de cada usuario del sistema.',
      'Si el cambio fue no autorizado: revertilo manualmente desde esa pantalla antes de continuar.',
      'Cambiá la contraseña del usuario que realizó el cambio no autorizado como medida inmediata.',
      'Revisá si ese usuario realizó otras acciones sensibles en el mismo período usando el filtro de búsqueda de la tabla.',
      'Documentá el incidente con fecha, usuarios involucrados, cambios revertidos y acciones preventivas tomadas.',
    ],
  },
  {
    id: 'off-hours',
    severity: 'info',
    urgency: 'Baja–Media',
    icon: Clock,
    title: 'Acceso fuera de horario laboral',
    description: 'Se detectó actividad en el sistema entre las 22:00 y las 07:00. Puede ser legítima o indicar un acceso no autorizado.',
    steps: [
      'Usá el buscador de la tabla para filtrar todos los eventos del usuario que accedió fuera de horario.',
      'Revisá qué tipo de acciones realizó: ¿solo login/logout, o también cambios críticos como pagos o permisos?',
      'Si fue solo login de alguien conocido → puede ser trabajo remoto nocturno legítimo. Consultale directamente.',
      'Si hubo acciones sensibles (pagos eliminados, cambios de rol) fuera de horario → escalá al protocolo correspondiente.',
      'Si no reconocés al usuario o no podés justificar el acceso → tratalo como acceso no autorizado.',
      'Como medida preventiva, pedile a todos los usuarios que activen notificaciones de inicio de sesión si el sistema lo permite.',
    ],
  },
]

// ── Guía de anomalías (tips rápidos) ─────────────────────────────────────────

const ANOMALY_TIPS = [
  { icon: ShieldAlert, color: 'text-red-500',    tip: 'Más de 5 login fallidos seguidos desde la misma IP → posible fuerza bruta. Cambiá la contraseña del usuario afectado.' },
  { icon: Clock,       color: 'text-amber-500',  tip: 'Accesos entre las 22:00 y 07:00 son inusuales. Verificá si fue acceso autorizado o alguien entró sin permiso.' },
  { icon: Trash2,      color: 'text-orange-500', tip: 'Varios PAGO_ELIMINADO en poco tiempo pueden indicar manipulación. Cruzá con comprobantes físicos.' },
  { icon: UserCheck,   color: 'text-purple-500', tip: 'Cambios de ROL o PERMISO fuera del horario laboral deben ser verificados. Solo el admin debería hacerlos.' },
]

// ── Design tokens ─────────────────────────────────────────────────────────────

const GLASS    = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const GLASS_SM = 'rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl shadow-sm'
const GLASS_HOVER = `${GLASS_SM} hover:-translate-y-0.5 hover:bg-white/50 dark:hover:bg-black/50 hover:shadow-md transition-all duration-200`

const TooltipStyle = {
  contentStyle: { background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#fff', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)', padding: '10px 14px' },
  labelStyle:   { color: '#9ca3af', fontWeight: 700, marginBottom: 4, fontSize: 10 },
  itemStyle:    { color: '#fff', fontWeight: 900, padding: '2px 0', fontSize: 11 },
  cursor:       { fill: 'rgba(255,255,255,0.04)' },
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: TipoEvento }) {
  const cfg = TIPO_CONFIG[tipo]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.badge}`}>
      <Icon size={11} />{cfg.label}
    </span>
  )
}

function DetalleJson({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sin detalle</span>
  try {
    return (
      <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-100/80 dark:bg-black/30 rounded-xl p-3 overflow-auto max-h-32 leading-relaxed">
        {JSON.stringify(JSON.parse(raw), null, 2)}
      </pre>
    )
  } catch {
    return <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{raw}</span>
  }
}

function InfoTip({ text }: { text: string }) {
  return (
    <div className="group relative shrink-0">
      <Info size={13} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-help transition-colors" />
      <div className="pointer-events-none absolute left-0 top-5 z-20 w-64 rounded-2xl bg-white/95 dark:bg-[#111]/95 border border-white/50 dark:border-white/10 backdrop-blur-xl shadow-lg p-3 text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {text}
      </div>
    </div>
  )
}

/** Título de sección grande + bold, con tag pequeño opcional arriba */
function SectionHeader({ tag, label, description, count, info }: {
  tag?: string; label: string; description?: string; count?: number; info?: string
}) {
  return (
    <div className="mb-6">
      {tag && <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-1.5">{tag}</p>}
      <div className="flex items-start gap-2.5">
        <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white flex-1">{label}</h2>
        {info && <InfoTip text={info} />}
        {count != null && count > 0 && (
          <span className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">
            {count} resultado{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {description && <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{description}</p>}
    </div>
  )
}

/** Pill container + botón — igual que PaymentsPage */
function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-0.5 shrink-0">
      {children}
    </div>
  )
}

function PillBtn({ active, onClick, disabled, children }: {
  active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={`relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      {active && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
      <span className="relative" style={{ zIndex: 1 }}>{children}</span>
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeDateRange(periodo: Periodo): { desde: string; hasta: string } {
  const ahora = new Date()
  const hasta = ahora.toISOString()
  if (periodo === 'hoy') {
    return { desde: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString(), hasta }
  }
  return { desde: new Date(ahora.getTime() - (periodo === '7d' ? 7 : 30) * 86400000).toISOString(), hasta }
}

function formatHora(iso: string) {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? format(d, 'HH:mm')
    : format(d, "d MMM · HH:mm", { locale: es })
}

function formatHoraRelativa(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es })
}

function avatarColor(email: string | null): string {
  if (!email) return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
  const colors = [
    'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300',
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
    'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300',
    'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300',
  ]
  return colors[email.charCodeAt(0) % colors.length]
}

function initials(email: string | null) {
  return email ? email.charAt(0).toUpperCase() : '?'
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SecurityPage() {
  const navigate = useNavigate()
  const [resumen, setResumen] = useState<ResumenSeguridad | null>(null)
  const [eventos, setEventos] = useState<EventoSeguridad[]>([])
  const [chartEvents, setChartEvents] = useState<EventoSeguridad[]>([])
  const [total, setTotal] = useState(0)
  const [resumenLoading, setResumenLoading] = useState(true)
  const [eventosLoading, setEventosLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [tipoFilter, setTipoFilter] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [emailSearch, setEmailSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25
  const [usuarioEmailFilter, setUsuarioEmailFilter] = useState<string | null>(null)

  const emailFinal = usuarioEmailFilter ?? (emailSearch || undefined)
  const { desde, hasta } = useMemo(() => computeDateRange(periodo), [periodo])

  const fetchResumen = useCallback(async () => {
    try { const d = await auditoriaApi.getResumen(); setResumen(d) }
    catch { /* silenciar */ } finally { setResumenLoading(false) }
  }, [])

  const fetchEventos = useCallback(async () => {
    setEventosLoading(true)
    try {
      const d = await auditoriaApi.getEventos({ tipo: tipoFilter || undefined, email: emailFinal, desde, hasta, page, pageSize: PAGE_SIZE })
      setEventos(d.eventos); setTotal(d.total)
    } catch { setEventos([]); setTotal(0) }
    finally { setEventosLoading(false) }
  }, [tipoFilter, emailFinal, desde, hasta, page])

  const fetchChartEvents = useCallback(async () => {
    try { const d = await auditoriaApi.getEventos({ desde, hasta, pageSize: 500, page: 1 }); setChartEvents(d.eventos) }
    catch { setChartEvents([]) }
  }, [desde, hasta])

  useEffect(() => { fetchResumen() }, [fetchResumen])
  useEffect(() => { fetchEventos() }, [fetchEventos])
  useEffect(() => { fetchChartEvents() }, [fetchChartEvents])
  useEffect(() => { setPage(1) }, [tipoFilter, periodo, emailSearch, usuarioEmailFilter])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchResumen(), fetchEventos(), fetchChartEvents()])
    setRefreshing(false)
  }

  function handleUserCardClick(email: string | null) {
    if (!email) return
    if (usuarioEmailFilter === email) { setUsuarioEmailFilter(null) }
    else { setUsuarioEmailFilter(email); setEmailSearch('') }
  }

  // Alertas derivadas
  const activeAlerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = []

    if (resumen && resumen.loginFallidos24h > 0) {
      out.push({
        id: 'login-fallidos', severity: 'danger', icon: ShieldAlert,
        title: `${resumen.loginFallidos24h} intento${resumen.loginFallidos24h > 1 ? 's' : ''} de login fallido en las últimas 24h`,
        description: 'Credenciales incorrectas repetidas pueden indicar un ataque de fuerza bruta o intentos de acceso no autorizado.',
        action: 'Revisá las IPs de origen. Si son desconocidas, cambiá las contraseñas de los usuarios afectados de inmediato.',
        events: resumen.alertas,
      })
    }

    const pagosEl = chartEvents.filter(ev => ev.tipo === 'PAGO_ELIMINADO')
    if (pagosEl.length > 0) {
      out.push({
        id: 'pagos-eliminados', severity: 'warning', icon: Trash2,
        title: `${pagosEl.length} pago${pagosEl.length > 1 ? 's eliminados' : ' eliminado'} en el período`,
        description: 'Las eliminaciones de pagos son irreversibles y afectan el historial financiero.',
        action: 'Cruzá con los comprobantes físicos. Si alguna eliminación no fue tuya, identificá quién la realizó.',
        events: pagosEl,
      })
    }

    const cambios = chartEvents.filter(ev => ev.tipo === 'ROL_CAMBIADO' || ev.tipo === 'PERMISO_MODIFICADO')
    if (cambios.length > 0) {
      out.push({
        id: 'cambios-permisos', severity: 'warning', icon: UserCheck,
        title: `${cambios.length} cambio${cambios.length > 1 ? 's' : ''} de permisos o roles en el período`,
        description: 'Modificaciones en roles y permisos definen qué puede hacer cada usuario.',
        action: 'Verificá que cada cambio fue realizado por vos o un administrador de confianza.',
        events: cambios,
      })
    }

    const offHours = chartEvents.filter(ev => { const h = new Date(ev.createdAt).getHours(); return h >= 22 || h < 7 })
    if (offHours.length >= 3) {
      out.push({
        id: 'off-hours', severity: 'info', icon: Clock,
        title: `${offHours.length} eventos fuera del horario laboral (22:00 – 07:00)`,
        description: 'Actividad detectada en horas inusuales. Puede ser legítima pero merece revisión.',
        action: 'Verificá si el acceso fue realizado por vos o por personal autorizado.',
        events: offHours.slice(0, 10),
      })
    }

    return out
  }, [resumen, chartEvents])

  // Datos para gráficos
  const eventosByHour = useMemo(() => {
    const map = new Map<number, { total: number; fallidos: number }>()
    for (let h = 0; h < 24; h++) map.set(h, { total: 0, fallidos: 0 })
    chartEvents.forEach(ev => {
      const h = new Date(ev.createdAt).getHours()
      const cur = map.get(h)!
      map.set(h, { total: cur.total + 1, fallidos: cur.fallidos + (ev.tipo === 'LOGIN_FALLIDO' ? 1 : 0) })
    })
    return Array.from(map.entries()).map(([h, v]) => ({
      hora: `${String(h).padStart(2, '0')}h`, Eventos: v.total, Fallidos: v.fallidos,
    }))
  }, [chartEvents])

  const eventosByType = useMemo(() => {
    const map = new Map<TipoEvento, number>()
    chartEvents.forEach(ev => map.set(ev.tipo, (map.get(ev.tipo) ?? 0) + 1))
    return Array.from(map.entries())
      .map(([tipo, count]) => ({ tipo, label: TIPO_CONFIG[tipo].label, count, color: TIPO_CONFIG[tipo].color }))
      .filter(x => x.count > 0).sort((a, b) => b.count - a.count)
  }, [chartEvents])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasChartData = chartEvents.length > 0

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-8 md:space-y-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Seguridad</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Auditoría y monitoreo de eventos del sistema</p>
          </div>
        </div>
        <button
          onClick={handleRefresh} disabled={refreshing}
          className={`${GLASS_SM} flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 disabled:opacity-40`}
        >
          <RefreshCw size={13} className={`text-gray-400 dark:text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Login fallidos" value={resumenLoading ? '—' : String(resumen?.loginFallidos24h ?? 0)}
          icon={ShieldAlert}
          iconBg={resumen && resumen.loginFallidos24h > 0 ? 'bg-red-500/10' : 'bg-gray-100/60 dark:bg-white/5'}
          iconColor={resumen && resumen.loginFallidos24h > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}
          sub="últimas 24 horas"
          subColor={resumen && resumen.loginFallidos24h > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}
          isLoading={resumenLoading}
        />
        <KpiCard
          label="Acciones críticas" value={resumenLoading ? '—' : String(resumen?.accionesCriticas ?? 0)}
          icon={AlertTriangle}
          iconBg={resumen && resumen.accionesCriticas > 0 ? 'bg-amber-500/10' : 'bg-gray-100/60 dark:bg-white/5'}
          iconColor={resumen && resumen.accionesCriticas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}
          sub="este mes"
          subColor={resumen && resumen.accionesCriticas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}
          isLoading={resumenLoading}
        />
        <KpiCard
          label="Eventos hoy" value={resumenLoading ? '—' : String(resumen?.eventosHoy ?? 0)}
          icon={Activity} iconBg="bg-primary/10" iconColor="text-primary"
          sub="login, logout, cambios" subColor="text-gray-400 dark:text-gray-500"
          isLoading={resumenLoading}
        />
        <KpiCard
          label="Usuarios activos" value={resumenLoading ? '—' : String(resumen?.usuariosActivosHoy ?? 0)}
          icon={MonitorCheck} iconBg="bg-emerald-500/10" iconColor="text-emerald-500 dark:text-emerald-400"
          sub="sesiones registradas hoy" subColor="text-gray-400 dark:text-gray-500"
          isLoading={resumenLoading}
        />
      </div>

      {/* ── Alertas activas ── */}
      <AnimatePresence>
        {!resumenLoading && activeAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <SectionHeader
              tag="Estado actual"
              label="Alertas activas"
              description={`${activeAlerts.length} situación${activeAlerts.length > 1 ? 'es que requieren' : ' que requiere'} tu atención — hacé click para ver el detalle y los eventos involucrados`}
              info="Se calculan automáticamente en base a los eventos del período seleccionado."
            />
            <div className="space-y-3">
              {activeAlerts.map(alert => {
                const s = SEV[alert.severity]
                const Icon = alert.icon
                const isExp = expandedAlertId === alert.id
                return (
                  <div key={alert.id} className={`rounded-2xl border ${s.wrap} overflow-hidden`}>
                    <button onClick={() => setExpandedAlertId(p => p === alert.id ? null : alert.id)} className="w-full flex items-start gap-3 p-4 text-left">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${s.iconBg} mt-0.5`}>
                        <Icon size={16} className={s.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${s.title} mb-0.5`}>{alert.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{alert.description}</p>
                        <div className="flex items-start gap-1.5 mt-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">Acción:</span>
                          <span className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{alert.action}</span>
                        </div>
                      </div>
                      {alert.events && alert.events.length > 0 && (
                        <div className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${isExp ? `${s.iconBg}` : 'bg-black/[0.04] dark:bg-white/[0.05]'}`}>
                          <span className={`text-[10px] font-bold ${isExp ? s.iconColor : 'text-gray-500 dark:text-gray-400'}`}>{alert.events.length}</span>
                          {isExp
                            ? <ChevronUp size={12} className={s.iconColor} />
                            : <ChevronDown size={12} className="text-gray-400 dark:text-gray-500" />
                          }
                        </div>
                      )}
                    </button>
                    <AnimatePresence>
                      {isExp && alert.events && alert.events.length > 0 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }} className="overflow-hidden">
                          <div className="px-4 pb-4 space-y-2">
                            {alert.events.map(ev => (
                              <div key={ev.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${s.evBg}`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${s.dot} shrink-0`} />
                                <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 min-w-0 truncate">
                                  <span className="font-medium text-gray-800 dark:text-gray-100">{ev.email ?? 'desconocido'}</span>
                                  {ev.ip && <span className="text-gray-400 dark:text-gray-500 font-mono ml-2 text-[10px]">{ev.ip}</span>}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 flex items-center gap-1">
                                  <Clock size={9} />{formatHoraRelativa(ev.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Guía rápida de anomalías ── */}
      <div className={`${GLASS} relative overflow-hidden p-6`}>
        {/* Blob decorativo */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-primary/[0.07] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-amber-400/[0.05] blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Info size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-0.5">Referencia rápida</p>
              <p className="text-base font-black text-gray-900 dark:text-white">Señales de alerta a conocer</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {ANOMALY_TIPS.map((tip, i) => {
              const Icon = tip.icon
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] p-3">
                  <Icon size={14} className={`${tip.color} shrink-0 mt-0.5`} />
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{tip.tip}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Gráficos ── */}
      <div>
        <SectionHeader
          tag="Análisis visual"
          label="Actividad en el período"
          description="Detectá patrones inusuales — picos fuera de horario, tipos de eventos dominantes"
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Actividad por hora */}
          <div className={`${GLASS} relative overflow-hidden p-5`}>
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-primary/[0.07] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-red-500/[0.04] blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-0.5">Distribución horaria</p>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">Actividad por hora</h3>
                  {hasChartData && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{chartEvents.length} eventos en el período</p>}
                </div>
                <InfoTip text="Un pico antes de las 8:00 o después de las 22:00 puede indicar acceso no autorizado. La línea roja muestra solo login fallidos." />
              </div>
              {!hasChartData ? (
                <div className="h-44 flex items-center justify-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos en este período</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={156}>
                    <AreaChart data={eventosByHour} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradEvt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#FBC608" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#FBC608" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradFail" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f87171" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={0.8} strokeOpacity={0.8} />
                      <XAxis dataKey="hora" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <RechartsTooltip {...TooltipStyle} />
                      <Area type="monotone" dataKey="Eventos"  stroke="#FBC608" strokeWidth={2} fill="url(#gradEvt)"  dot={false} />
                      <Area type="monotone" dataKey="Fallidos" stroke="#f87171" strokeWidth={2} fill="url(#gradFail)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                      <span className="h-1.5 w-4 rounded-full bg-primary inline-block" />Eventos totales
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                      <span className="h-1.5 w-4 rounded-full bg-red-400 inline-block" />Login fallidos
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Distribución por tipo */}
          <div className={`${GLASS} relative overflow-hidden p-5`}>
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-purple-500/[0.06] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-amber-500/[0.04] blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-0.5">Tipos de evento</p>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">Distribución por tipo</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Lo normal: Login y Logout dominan la distribución</p>
                </div>
                <InfoTip text="Una concentración alta de PAGO_ELIMINADO o ROL_CAMBIADO es señal de alerta. El perfil normal es Login y Logout como tipos dominantes." />
              </div>
              {!hasChartData ? (
                <div className="h-44 flex items-center justify-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos en este período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={196}>
                  <BarChart data={eventosByType} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={0.8} strokeOpacity={0.8} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={80} />
                    <RechartsTooltip {...TooltipStyle} />
                    <Bar dataKey="count" name="Eventos" radius={[0, 4, 4, 0]} maxBarSize={14}>
                      {eventosByType.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabla de eventos ── */}
      <div>
        <SectionHeader
          tag="Registro completo"
          label="Historial de eventos"
          count={total}
          description="Cada acción registrada en el sistema. Expandí una fila para ver IP, timestamp exacto y datos del evento."
          info="Usá los filtros para encontrar eventos específicos. Hacé click en un usuario de la sección de abajo para filtrar por esa persona."
        />

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 mb-5">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Tipo</span>
            <PillGroup>
              {TIPO_FILTER_OPTIONS.map(opt => (
                <PillBtn key={opt.value} active={tipoFilter === opt.value} onClick={() => setTipoFilter(opt.value)}>{opt.label}</PillBtn>
              ))}
            </PillGroup>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Período</span>
            <PillGroup>
              {PERIODO_OPTIONS.map(opt => (
                <PillBtn key={opt.value} active={periodo === opt.value} onClick={() => setPeriodo(opt.value)}>{opt.label}</PillBtn>
              ))}
            </PillGroup>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Buscar usuario</span>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text" placeholder="email..."
                value={usuarioEmailFilter ?? emailSearch}
                readOnly={!!usuarioEmailFilter}
                onChange={e => { setEmailSearch(e.target.value); setUsuarioEmailFilter(null) }}
                className="h-[34px] w-48 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-8 pr-7 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-all"
              />
              {(usuarioEmailFilter || emailSearch) && (
                <button onClick={() => { setUsuarioEmailFilter(null); setEmailSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className={`${GLASS} overflow-hidden`}>
          <div className="hidden md:grid grid-cols-[160px_1fr_120px_90px_48px] px-4 py-2.5 border-b border-gray-200/60 dark:border-white/[0.06]">
            {['Tipo', 'Actor', 'IP', 'Hora', ''].map(h => (
              <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{h}</span>
            ))}
          </div>

          {eventosLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-white/[0.03]">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ))}
            </div>
          ) : eventos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100/80 dark:bg-white/[0.04]">
                <Shield size={22} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">Sin eventos en este período</p>
            </div>
          ) : (
            <div>
              {eventos.map((ev, idx) => {
                const isExpanded = expandedId === ev.id
                const isLast = idx === eventos.length - 1
                return (
                  <div key={ev.id}>
                    <div
                      onClick={() => setExpandedId(p => p === ev.id ? null : ev.id)}
                      className={`grid grid-cols-[160px_1fr_120px_90px_48px] px-4 py-3 cursor-pointer transition-colors duration-150 ${isExpanded ? 'bg-gray-50/80 dark:bg-white/[0.04]' : 'hover:bg-gray-50/60 dark:hover:bg-white/[0.025]'} ${!isLast || isExpanded ? 'border-b border-gray-100 dark:border-white/[0.04]' : ''}`}
                    >
                      <div className="flex items-center"><TipoBadge tipo={ev.tipo} /></div>
                      <div className="flex items-center min-w-0">
                        <span className={`text-sm truncate ${ev.email ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                          {ev.email ?? 'desconocido'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{ev.ip ?? '—'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{formatHora(ev.createdAt)}</span>
                      </div>
                      {/* Ícono expand mejorado */}
                      <div className="flex items-center justify-center">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ${isExpanded ? 'bg-primary/10' : ''}`}>
                          {isExpanded
                            ? <ChevronUp size={13} className="text-primary" />
                            : <ChevronDown size={13} className="text-gray-300 dark:text-gray-600" />
                          }
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }} className="overflow-hidden">
                          <div className={`px-4 py-3 bg-gray-50/60 dark:bg-black/20 ${!isLast ? 'border-b border-gray-100 dark:border-white/[0.04]' : ''}`}>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Detalle del evento</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <div>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">ID evento</p>
                                <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">{ev.id}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Fecha y hora</p>
                                <p className="text-[11px] text-gray-600 dark:text-gray-300">{format(new Date(ev.createdAt), "d 'de' MMMM yyyy · HH:mm:ss", { locale: es })}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">IP de origen</p>
                                <p className="text-[11px] font-mono text-gray-600 dark:text-gray-300">{ev.ip ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">ID usuario</p>
                                <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">{ev.usuarioId ?? '—'}</p>
                              </div>
                            </div>
                            <DetalleJson raw={ev.detalle} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">Página {page} de {totalPages}</span>
            <PillGroup>
              <PillBtn active={false} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</PillBtn>
              <PillBtn active={false} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente →</PillBtn>
            </PillGroup>
          </div>
        )}
      </div>

      {/* ── Actividad por usuario ── */}
      {!resumenLoading && resumen && resumen.topUsuarios.length > 0 && (
        <motion.div variants={cardVariants} initial="initial" animate="animate">
          <SectionHeader
            tag="Usuarios"
            label="Actividad por usuario · hoy"
            description="Hacé click en un usuario para filtrar la tabla a sus eventos — los críticos incluyen pagos eliminados y cambios de permisos"
            info="Un usuario con muchos eventos críticos o actividad inusual requiere atención inmediata."
          />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {resumen.topUsuarios.map(u => {
              const isActive = usuarioEmailFilter === u.email
              return (
                <button
                  key={u.usuarioId}
                  onClick={() => handleUserCardClick(u.email)}
                  className={`${GLASS_HOVER} p-4 text-left w-full ${isActive ? '!border-primary/40 !bg-primary/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${avatarColor(u.email)}`}>
                      {initials(u.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                        {u.email?.split('@')[0] ?? 'Desconocido'}
                      </p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 truncate leading-tight">
                        {u.email?.split('@')[1] ?? ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl bg-gray-100/80 dark:bg-black/20 px-2 py-1.5 text-center">
                      <p className="text-base font-black text-primary leading-none">{u.total}</p>
                      <p className="text-[8px] text-gray-400 dark:text-gray-500 mt-0.5">eventos</p>
                    </div>
                    <div className={`rounded-xl px-2 py-1.5 text-center ${u.criticos > 0 ? 'bg-amber-50 dark:bg-amber-500/[0.08]' : 'bg-gray-100/80 dark:bg-black/20'}`}>
                      <p className={`text-base font-black leading-none ${u.criticos > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>
                        {u.criticos}
                      </p>
                      <p className="text-[8px] text-gray-400 dark:text-gray-500 mt-0.5">críticos</p>
                    </div>
                  </div>
                  {isActive && <p className="text-[9px] text-primary/70 text-center mt-2">Filtrando tabla ↑</p>}
                </button>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Protocolos de respuesta ── */}
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <SectionHeader
          tag="Guía de acción"
          label="Protocolos de respuesta"
          description="Qué hacer paso a paso ante cada situación de seguridad detectada en este panel"
          info="Seguí estos pasos exactamente ante cada tipo de alerta para minimizar el impacto y documentar correctamente el incidente."
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {PROTOCOLS.map(protocol => {
            const s = SEV[protocol.severity]
            const Icon = protocol.icon
            return (
              <div key={protocol.id} className={`${GLASS} relative overflow-hidden p-6`}>
                {/* Blob decorativo de color */}
                <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full ${s.blob} opacity-[0.06] blur-3xl pointer-events-none`} />
                <div className={`absolute -bottom-8 -left-8 w-32 h-32 rounded-full ${s.blob} opacity-[0.04] blur-3xl pointer-events-none`} />

                <div className="relative">
                  {/* Header del protocolo */}
                  <div className="flex items-start gap-3 mb-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${s.iconBg}`}>
                      <Icon size={20} className={s.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-black text-gray-900 dark:text-white">{protocol.title}</h3>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${s.urgencyBadge}`}>
                          URGENCIA {protocol.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{protocol.description}</p>
                    </div>
                  </div>

                  {/* Pasos */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <ListChecks size={13} className="text-gray-400 dark:text-gray-500" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Pasos a seguir</p>
                    </div>
                    {protocol.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black mt-0.5 ${s.step}`}>
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="mt-5 pt-4 border-t border-gray-200/60 dark:border-white/[0.06] flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Documentá siempre el incidente con fecha, usuarios involucrados y acciones tomadas.
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

    </motion.div>
  )
}
