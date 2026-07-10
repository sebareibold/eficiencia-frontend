import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette,
  Sun,
  Moon,
  Check,
  RotateCcw,
  Save,
  Search,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Bell,
  Send,
  Shield,
  ArrowRight,
  BookOpen,
  Lock,
  CheckCircle2,
} from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { configuracionApi } from '../api/configuracion.api'
import { notificacionesApi } from '../api/notificaciones.api'
import { authApi } from '../api/auth.api'
import { permisosApi, type PermisosMap } from '../api/permisos.api'
import { ROUTES } from '../constants/routes'
import { ManualContent } from './ManualPage'

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const { appearance } = useSettingsStore()
  
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${
        checked ? 'shadow-[0_0_12px_rgba(0,0,0,0.15)]' : 'bg-gray-200/80 dark:bg-gray-700/50'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-105'}`}
      style={checked ? { backgroundColor: appearance.accentColor } : {}}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
          checked ? 'translate-x-[22px]' : 'translate-x-[4px]'
        }`}
      />
    </button>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-2xl bg-gray-100/80 dark:bg-black/20 p-1.5 gap-1.5 border border-white/50 dark:border-white/5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 ${
              isActive
                ? 'bg-white dark:bg-white/[0.10] backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)] text-gray-900 dark:text-white scale-[1.02]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-white/[0.06]'
            }`}
          >
            {opt.icon && <span className={isActive ? 'text-primary' : ''}>{opt.icon}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ProbarBtn({ tipo }: { tipo: string }) {
  const [loading, setLoading] = useState(false)
  const { addToast } = useUiStore()

  async function handle() {
    setLoading(true)
    try {
      const res = await notificacionesApi.probar(tipo)
      addToast(`Prueba enviada a ${res.destino}`, 'success')
    } catch {
      addToast('Error al enviar email de prueba', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      title="Enviar email de prueba"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {loading
        ? <span className="h-3 w-3 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
        : <Send size={11} />
      }
      {!loading && 'Probar'}
    </button>
  )
}

const TIPO_LABEL: Record<string, string> = {
  'resumen-diario': 'Resumen diario',
  'nuevo-cliente': 'Nuevos clientes',
  'nuevo-usuario': 'Nuevos usuarios',
  'solicitud-aprobada': 'Solicitudes aprobadas',
  'prueba': 'Emails de prueba',
  'general': 'Otros',
}

function ConteoEmailsCard() {
  const [data, setData] = useState<{
    hoy: number
    esteMes: number
    limites: { diario: number; mensual: number }
    desglose: { tipo: string; count: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    notificacionesApi.conteoEmails()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function ProgressBar({ value, max }: { value: number; max: number }) {
    const pct = Math.min(100, (value / max) * 100)
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-primary'
    return (
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    )
  }

  return (
    <SectionCard>
      <div className="px-8 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Uso de emails (Resend)</p>
          {!loading && data && (
            <span className="text-xs text-gray-400 dark:text-gray-500">Plan gratuito</span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-40 rounded-lg bg-gray-100 dark:bg-white/10 animate-pulse" />
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
            <div className="h-4 w-40 rounded-lg bg-gray-100 dark:bg-white/10 animate-pulse" />
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-600 dark:text-gray-400">Hoy</span>
                <span className="font-black tabular-nums text-gray-900 dark:text-gray-100">
                  {data.hoy} <span className="font-medium text-gray-400">/ {data.limites.diario}</span>
                </span>
              </div>
              <ProgressBar value={data.hoy} max={data.limites.diario} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-600 dark:text-gray-400">Este mes</span>
                <span className="font-black tabular-nums text-gray-900 dark:text-gray-100">
                  {data.esteMes} <span className="font-medium text-gray-400">/ {data.limites.mensual}</span>
                </span>
              </div>
              <ProgressBar value={data.esteMes} max={data.limites.mensual} />
            </div>

            {data.desglose.length > 0 && (
              <div className="pt-2 border-t border-gray-100/50 dark:border-white/5">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2.5">
                  Desglose del mes <span className="normal-case font-medium">(desde que se activó el tracking)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.desglose.map(d => (
                    <span
                      key={d.tipo}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100/80 dark:bg-white/[0.06] text-xs font-semibold text-gray-600 dark:text-gray-400"
                    >
                      {TIPO_LABEL[d.tipo] ?? d.tipo}
                      <span className="font-black text-gray-900 dark:text-gray-200">{d.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No se pudo cargar el conteo</p>
        )}
      </div>
    </SectionCard>
  )
}

function EnviarResumenCard() {
  const [loading, setLoading] = useState(false)
  const { addToast } = useUiStore()

  async function handle() {
    setLoading(true)
    try {
      const res = await notificacionesApi.enviarResumenAhora()
      addToast(res.mensaje, res.enviado ? 'success' : 'info')
    } catch {
      addToast('Error al enviar el resumen', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-6 px-8 py-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">Enviar resumen ahora</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            Dispara el resumen diario real en este momento — membresías por vencer y clientes con deuda — sin esperar al cron de las 9 AM. Solo se envía si hay datos para reportar.
          </p>
        </div>
        <button
          type="button"
          onClick={handle}
          disabled={loading}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm btn-action disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading
            ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : <Send size={15} />
          }
          {loading ? 'Enviando...' : 'Enviar ahora'}
        </button>
      </div>
    </SectionCard>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden transition-all hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] hover:bg-white/40 dark:hover:bg-black/40">
      {children}
    </div>
  )
}

function SectionRow({
  label,
  description,
  children,
  last,
}: {
  label: string
  description?: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 px-8 py-6 ${
        !last ? 'border-b border-gray-100/50 dark:border-white/5' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 px-2 mb-4 mt-10 first:mt-2">
      <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
      <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {title}
      </p>
    </div>
  )
}

// ─── Accent color picker ──────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { value: '#FBC608', label: 'Amarillo Eficiencia' },
  { value: '#F5A623', label: 'Naranja' },
  { value: '#D4880A', label: 'Ámbar Oscuro' },
  { value: '#10B981', label: 'Verde' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#EF4444', label: 'Rojo' },
]

// ─── Sections ─────────────────────────────────────────────────────────────────

function AppearanceSection() {
  const { appearance, updateAppearance } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Tema" />
      <SectionCard>
        <SectionRow label="Modo" description="Apariencia general de la interfaz" last>
          <SegmentedControl
            options={[
              { value: 'light', label: 'Claro', icon: <Sun size={13} /> },
              { value: 'dark', label: 'Oscuro', icon: <Moon size={13} /> },
            ]}
            value={appearance.theme}
            onChange={(v) => updateAppearance({ theme: v })}
          />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Color de acento" />
      <SectionCard>
        <div className="px-8 py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Personalizá el color principal de la plataforma
          </p>
          <div className="flex items-center gap-4">
            {ACCENT_COLORS.map((color) => {
              const isSelected = appearance.accentColor === color.value;
              return (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  onClick={() => updateAppearance({ accentColor: color.value })}
                  className={`relative h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none ${
                    isSelected ? 'scale-110 shadow-[0_0_15px_rgba(0,0,0,0.2)] ring-4 ring-offset-2 ring-offset-[#F6F7F9] dark:ring-offset-[#111111]' : 'hover:scale-110 hover:shadow-md'
                  }`}
                  style={{ 
                    backgroundColor: color.value,
                    ...(isSelected ? { ringColor: color.value } : {})
                  }}
                >
                  {isSelected && (
                    <Check size={16} className="text-white drop-shadow-md" strokeWidth={3.5} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </SectionCard>

    </div>
  )
}


function NotificationsSection() {
  const { notifications, updateNotifications } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Destino" />
      <SectionCard>
        <SectionRow
          label="Email de notificaciones"
          description="Dirección donde llegan los avisos. Si lo dejás vacío, se usa el email del administrador registrado en el sistema."
          last
        >
          <input
            type="email"
            value={notifications.emailDestino}
            onChange={(e) => updateNotifications({ emailDestino: e.target.value })}
            placeholder="admin@eficiencia.com"
            className="w-52 rounded-xl border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Qué notificar" />

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
        <AlertCircle size={15} className="shrink-0 mt-0.5 text-primary/70" />
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Los resúmenes de <strong className="text-gray-800 dark:text-gray-200">membresías y deudas</strong> se envían todos los días a las <strong className="text-gray-800 dark:text-gray-200">9:00 AM</strong> solo si hay datos para reportar.
          Los avisos de <strong className="text-gray-800 dark:text-gray-200">nuevos clientes y usuarios</strong> se envían <strong className="text-gray-800 dark:text-gray-200">al instante</strong> cuando ocurren.
        </p>
      </div>

      <SectionCard>
        <SectionRow
          label="Membresías por vencer"
          description="Recibís un email con la lista de membresías activas que vencen pronto. Incluye nombre del cliente, plan, fecha de vencimiento y días restantes."
        >
          <div className="flex items-center gap-2.5">
            <ProbarBtn tipo="vencimientos" />
            <Toggle
              checked={notifications.notifVencimientos}
              onChange={(v) => updateNotifications({ notifVencimientos: v })}
            />
          </div>
        </SectionRow>
        <AnimatePresence initial={false}>
          {notifications.notifVencimientos && (
            <motion.div
              key="dias"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <SectionRow label="Días de anticipación" description="El sistema buscará membresías que venzan dentro de este rango. Ej: 7 días = avisás una semana antes.">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateNotifications({ diasAnticipacion: Math.max(1, notifications.diasAnticipacion - 1) })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm"
                  >−</button>
                  <span className="w-8 text-center text-sm font-black text-gray-900 dark:text-white tabular-nums">{notifications.diasAnticipacion}</span>
                  <button
                    type="button"
                    onClick={() => updateNotifications({ diasAnticipacion: Math.min(30, notifications.diasAnticipacion + 1) })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm"
                  >+</button>
                </div>
              </SectionRow>
            </motion.div>
          )}
        </AnimatePresence>
        <SectionRow
          label="Clientes con deuda"
          description="Email diario con todos los clientes en estado DEUDA. Incluye nombre, email y teléfono para facilitar el contacto."
        >
          <div className="flex items-center gap-2.5">
            <ProbarBtn tipo="deudas" />
            <Toggle
              checked={notifications.notifDeudas}
              onChange={(v) => updateNotifications({ notifDeudas: v })}
            />
          </div>
        </SectionRow>
        <SectionRow
          label="Nuevos clientes"
          description="Email inmediato al registrar un cliente. Incluye nombre, CUIL y email del nuevo socio."
        >
          <div className="flex items-center gap-2.5">
            <ProbarBtn tipo="nuevos-clientes" />
            <Toggle
              checked={notifications.notifNuevosClientes}
              onChange={(v) => updateNotifications({ notifNuevosClientes: v })}
            />
          </div>
        </SectionRow>
        <SectionRow
          label="Nuevos usuarios del sistema"
          description="Email inmediato al crear un usuario (staff, profesor o admin) o al aprobar una solicitud de acceso. Incluye nombre, email y rol asignado."
        >
          <div className="flex items-center gap-2.5">
            <ProbarBtn tipo="nuevos-usuarios" />
            <Toggle
              checked={notifications.notifNuevosUsuarios}
              onChange={(v) => updateNotifications({ notifNuevosUsuarios: v })}
            />
          </div>
        </SectionRow>
        <SectionRow
          label="Email al aprobar solicitudes"
          description="Cuando cualquier admin aprueba una solicitud de acceso, todos los admins con esta opción activa reciben un email con el nombre, email, rol asignado, quién aprobó y la fecha y hora exactas."
          last
        >
          <div className="flex items-center gap-2.5">
            <ProbarBtn tipo="solicitud-aprobada" />
            <Toggle
              checked={notifications.emailAlAprobarSolicitudes}
              onChange={(v) => updateNotifications({ emailAlAprobarSolicitudes: v })}
            />
          </div>
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Uso de emails" />
      <ConteoEmailsCard />

      <SectionHeader title="Enviar ahora" />
      <EnviarResumenCard />

      <SectionHeader title="Canal" />
      <SectionCard>
        <SectionRow
          label="Cómo recibir los avisos"
          description="Dashboard: las alertas aparecen en la sección de inicio. Email: recibís los avisos en tu correo. Ambos: las dos opciones activas."
          last
        >
          <SegmentedControl
            options={[
              { value: 'app', label: 'Dashboard' },
              { value: 'email', label: 'Email' },
              { value: 'both', label: 'Ambos' },
            ]}
            value={notifications.canal}
            onChange={(v) => updateNotifications({ canal: v as 'app' | 'email' | 'both' })}
          />
        </SectionRow>
      </SectionCard>
    </div>
  )
}

function AccountSection() {
  const { user } = useAuthStore()
  const { addToast } = useUiStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  const [formData, setFormData] = useState({
    name: user?.name || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  })

  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwForm.nueva !== pwForm.confirmar) {
      setPwError('Las contraseñas nuevas no coinciden')
      return
    }
    if (pwForm.nueva.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    setPwLoading(true)
    try {
      await authApi.changePassword({ passwordActual: pwForm.actual, passwordNueva: pwForm.nueva })
      addToast('Contraseña actualizada correctamente', 'success')
      setPwForm({ actual: '', nueva: '', confirmar: '' })
      setShowPwForm(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg || 'Error al actualizar la contraseña')
    } finally {
      setPwLoading(false)
    }
  }

  const inputClass = "w-full bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 pr-11 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"

  return (
    <div className="space-y-6">
      <SectionHeader title="Datos Personales" />
      <SectionCard>
        <div className="p-8 flex flex-col gap-8 relative overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FBC608]/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Apellido</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FBC608]/50 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Correo Electrónico</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FBC608]/50 transition-all"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionHeader title="Contraseña" />
      <SectionCard>
        <div className="p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Cambiar contraseña</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Actualizá tu contraseña de acceso a la plataforma.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowPwForm(!showPwForm); setPwError('') }}
            className="shrink-0 px-5 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl transition-all"
          >
            {showPwForm ? 'Cancelar' : 'Solicitar cambio'}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showPwForm && (
            <motion.div
              key="pw-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <form onSubmit={handleChangePassword} className="px-8 pb-8 space-y-4 border-t border-gray-100/50 dark:border-white/5 pt-6">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Contraseña actual</label>
                  <input
                    type={showActual ? 'text' : 'password'}
                    value={pwForm.actual}
                    onChange={(e) => setPwForm({ ...pwForm, actual: e.target.value })}
                    autoComplete="current-password"
                    className={inputClass}
                    required
                  />
                  <button type="button" onClick={() => setShowActual(!showActual)} className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    {showActual ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Nueva contraseña</label>
                  <input
                    type={showNueva ? 'text' : 'password'}
                    value={pwForm.nueva}
                    onChange={(e) => setPwForm({ ...pwForm, nueva: e.target.value })}
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                  <button type="button" onClick={() => setShowNueva(!showNueva)} className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    {showNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Confirmar nueva contraseña</label>
                  <input
                    type={showNueva ? 'text' : 'password'}
                    value={pwForm.confirmar}
                    onChange={(e) => setPwForm({ ...pwForm, confirmar: e.target.value })}
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                </div>

                <AnimatePresence>
                  {pwError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400"
                    >
                      <AlertCircle size={15} className="shrink-0" />
                      {pwError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={pwLoading || !pwForm.actual || !pwForm.nueva || !pwForm.confirmar}
                    className="flex items-center gap-2 rounded-xl btn-action px-6 py-2.5 text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pwLoading ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionCard>

      {isAdmin && (
        <>
          <SectionHeader title="Seguridad" />
          <SectionCard>
            <SectionRow
              label="Registro de actividad"
              description="Revisá intentos de acceso, cambios de permisos, pagos eliminados y otras acciones críticas del sistema."
              last
            >
              <button
                type="button"
                onClick={() => navigate(ROUTES.SECURITY)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.10] hover:text-gray-900 dark:hover:text-white transition-all"
              >
                <Shield size={14} className="text-amber-500 dark:text-amber-400" />
                Abrir
                <ArrowRight size={13} className="text-gray-400 dark:text-white/30" />
              </button>
            </SectionRow>
          </SectionCard>
        </>
      )}
    </div>
  )
}


// ─── Permissions Section ──────────────────────────────────────────────────────

const MODULO_LABELS: Record<string, string> = {
  clients:      'Clientes',
  payments:     'Pagos',
  shifts:       'Turnos',
  attendance:   'Asistencia',
  expenses:     'Gastos',
  memberships:  'Membresías',
  dashboard:    'Dashboard',
  users:        'Usuarios',
  rutinas:      'Rutinas',
  exercises:    'Ejercicios',
  plantillas:   'Plantillas',
  reposiciones: 'Reposiciones',
}

const ACCION_LABELS: Record<string, string> = {
  read:   'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  mark:   'Marcar asistencia',
}

// Módulos excluidos de la vista principal (aparecen como sub-filas de otro módulo o no aplican)
const EXCLUDE_MODULES = ['dashboard', 'attendance', 'reposiciones']

// Acciones principales por módulo (columnas de la matriz)
const MODULE_ACTIONS: Record<string, string[]> = {
  clients:      ['read', 'create', 'update', 'delete'],
  payments:     ['read', 'create', 'update', 'delete'],
  shifts:       ['read', 'create', 'update', 'delete'],
  attendance:   ['read', 'mark', 'delete'],
  expenses:     ['read', 'create', 'update', 'delete'],
  memberships:  ['read', 'create', 'update', 'delete'],
  users:        ['read', 'create', 'update', 'delete'],
  rutinas:      ['read', 'create', 'update', 'delete'],
  exercises:    ['read', 'create', 'update', 'delete'],
  plantillas:   ['read', 'create', 'update', 'delete'],
  reposiciones: ['read', 'create', 'update', 'delete'],
}

// Sub-acciones anidadas debajo de su módulo padre.
// fromModule: si se define, el permiso se lee de permisos[fromModule][key] en vez del módulo padre.
const MODULE_SUBACTIONS: Record<string, { key: string; label: string; fromModule?: string }[]> = {
  clients: [
    { key: 'view_pagos',      label: 'Ver pagos del cliente' },
    { key: 'view_membresias', label: 'Ver membresías del cliente' },
    { key: 'view_rutinas',    label: 'Ver rutinas del cliente' },
    { key: 'read',   label: 'Ver reposiciones y ausencias del cliente',  fromModule: 'reposiciones' },
    { key: 'create', label: 'Registrar ausencias y agendar recuperaciones', fromModule: 'reposiciones' },
  ],
  shifts: [
    { key: 'mark',   label: 'Marcar asistencia a clases',          fromModule: 'attendance' },
    { key: 'read',   label: 'Ver historial de asistencia',          fromModule: 'attendance' },
    { key: 'delete', label: 'Eliminar registros de asistencia',     fromModule: 'attendance' },
  ],
}

// Descripción de qué puede hacer el usuario en cada módulo según sus permisos
const MODULE_DESCRIPTIONS: Record<string, string> = {
  clients:      'Ver el listado de socios, acceder a su perfil, gestionar ausencias y reposiciones de clases.',
  payments:     'Registrar cobros de cuotas, ver el historial de pagos y filtrar por método o período.',
  shifts:       'Ver la grilla de turnos, horarios y cupos. Incluye marcar asistencia y ver el historial por clase.',
  attendance:   'Consultar el historial de asistencia de los clientes y marcar presentes en cada clase.',
  expenses:     'Ver y registrar los gastos del gimnasio (sueldos, fijos, variables) con resumen mensual.',
  memberships:  'Gestionar las membresías de los clientes: crear, renovar, cancelar y ver el estado.',
  users:        'Administrar los usuarios del sistema: crear cuentas de staff, profesores y administradores.',
  rutinas:      'Crear y editar rutinas de entrenamiento, asignarlas a clientes y registrar ejecuciones.',
  exercises:    'Acceder al catálogo de ejercicios con videos, patrones de movimiento y categorías.',
  plantillas:   'Ver y usar plantillas de rutina predefinidas para crear rutinas rápidamente.',
  reposiciones: 'Gestionar ausencias de clientes y agendar clases de recuperación en otro horario.',
}

const ACCION_ORDER = ['read', 'create', 'update', 'delete', 'mark']

const ROL_LABELS: Record<string, string> = {
  admin:    'Administrador',
  staff:    'Staff',
  profesor: 'Profesor',
}

function PermissionsSection() {
  const { user } = useAuthStore()
  const [permisos, setPermisos] = useState<PermisosMap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    permisosApi.getForMyRole()
      .then(setPermisos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 rounded-3xl bg-gray-100/60 dark:bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    )
  }

  if (!permisos) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 px-5 py-4 text-sm text-red-600 dark:text-red-400">
        <AlertCircle size={15} className="shrink-0" />
        No se pudieron cargar los permisos.
      </div>
    )
  }

  // Todos los módulos excepto los excluidos (dashboard)
  const modulosFiltrados = Object.entries(permisos).filter(
    ([modulo]) => !EXCLUDE_MODULES.includes(modulo)
  )

  // Columnas fijas (las acciones principales)
  const columnasActivas = ACCION_ORDER.filter(accion =>
    modulosFiltrados.some(([m]) => (MODULE_ACTIONS[m] ?? ACCION_ORDER).includes(accion))
  )

  return (
    <div className="mt-2">
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100/50 dark:border-white/[0.06]">
                <th className="py-3 px-6 text-left text-[11px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-36">
                  Sección
                </th>
                <th className="py-3 px-4 text-left text-[11px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Descripción
                </th>
                {columnasActivas.map(accion => (
                  <th key={accion} className="py-3 px-4 text-center text-[11px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {ACCION_LABELS[accion] ?? accion}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulosFiltrados.map(([modulo, acciones], idx, arr) => {
                const relevantes = MODULE_ACTIONS[modulo] ?? ACCION_ORDER
                const subacciones = MODULE_SUBACTIONS[modulo] ?? []
                const isLast = idx === arr.length - 1 && subacciones.length === 0
                return (
                  <>
                    {/* Fila principal del módulo */}
                    <tr key={modulo} className="border-b border-gray-100/50 dark:border-white/[0.04]">
                      <td className="py-4 px-6 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap align-top">
                        {MODULO_LABELS[modulo] ?? modulo}
                      </td>
                      <td className="py-4 px-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs align-top">
                        {MODULE_DESCRIPTIONS[modulo] ?? ''}
                      </td>
                      {columnasActivas.map(accion => {
                        const aplica = relevantes.includes(accion)
                        const permitido = acciones[accion]
                        return (
                          <td key={accion} className="py-4 px-4 text-center align-middle">
                            {!aplica ? (
                              <span className="text-gray-300 dark:text-white/20">—</span>
                            ) : permitido ? (
                              <CheckCircle2 size={16} className="mx-auto text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <Lock size={14} className="mx-auto text-gray-400 dark:text-gray-500" />
                            )}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Sub-filas debajo del módulo padre */}
                    {subacciones.map((sub, si) => {
                      const isLastSub = idx === arr.length - 1 && si === subacciones.length - 1
                      const permitido = sub.fromModule
                        ? (permisos[sub.fromModule]?.[sub.key] ?? false)
                        : acciones[sub.key]
                      return (
                        <tr
                          key={`${modulo}-${sub.key}`}
                          className={`bg-gray-50/50 dark:bg-white/[0.02] ${!isLastSub ? 'border-b border-gray-100/30 dark:border-white/[0.025]' : ''}`}
                        >
                          <td className="py-2.5 pl-10 pr-4 whitespace-nowrap" colSpan={2}>
                            <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="text-gray-300 dark:text-gray-600 select-none">└</span>
                              {sub.label}
                            </span>
                          </td>
                          {columnasActivas.map((accion, ci) => (
                            <td key={accion} className="py-2.5 px-4 text-center">
                              {ci === 0 ? (
                                permitido ? (
                                  <CheckCircle2 size={14} className="mx-auto text-emerald-500 dark:text-emerald-400" />
                                ) : (
                                  <Lock size={13} className="mx-auto text-gray-400 dark:text-gray-500" />
                                )
                              ) : (
                                <span className="text-gray-300 dark:text-white/20">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId = 'appearance' | 'notifications' | 'account' | 'manual' | 'permissions'

const CATEGORIES: {
  id: CategoryId
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  nonAdminOnly?: boolean
  keywords: string[]
}[] = [
  {
    id: 'account',
    label: 'Perfil y Cuenta',
    icon: User,
    keywords: ['perfil', 'cuenta', 'nombre', 'email', 'contraseña'],
  },
  {
    id: 'appearance',
    label: 'Interfaz',
    icon: Palette,
    keywords: ['tema', 'modo', 'claro', 'oscuro', 'color', 'acento', 'densidad', 'espaciado'],
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: Bell,
    keywords: ['alertas', 'notificaciones', 'email', 'app', 'frecuencia'],
  },
  {
    id: 'manual',
    label: 'Manual de uso',
    icon: BookOpen,
    keywords: ['manual', 'ayuda', 'guía', 'uso', 'documentación', 'cómo'],
  },
  {
    id: 'permissions',
    label: 'Mis permisos',
    icon: Lock,
    nonAdminOnly: true,
    keywords: ['permisos', 'acceso', 'rol', 'qué puedo', 'secciones'],
  },
]

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { hasUnsavedChanges, saveSettings, resetToDefaults } = useSettingsStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<CategoryId>('account')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredCategories = CATEGORIES.filter((cat) => {
    if (cat.adminOnly && !isAdmin) return false
    if (cat.nonAdminOnly && isAdmin) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return cat.label.toLowerCase().includes(q) || cat.keywords.some((k) => k.includes(q))
  })

  async function handleSave() {
    saveSettings()
    const { appearance, notifications } = useSettingsStore.getState()
    try {
      await configuracionApi.update({
        tema: appearance.theme,
        accentColor: appearance.accentColor,
        notifEmail: notifications.emailDestino,
        notifCanal: notifications.canal,
        notifVencimientos: notifications.notifVencimientos,
        notifDiasAnticipacion: notifications.diasAnticipacion,
        notifDeudas: notifications.notifDeudas,
        notifNuevosClientes: notifications.notifNuevosClientes,
        notifNuevosUsuarios: notifications.notifNuevosUsuarios,
        emailAlAprobarSolicitudes: notifications.emailAlAprobarSolicitudes,
      })
    } catch {
      // La config local ya se guardó; si falla el server no se bloquea el UX
    }
    useUiStore.getState().addToast('Configuración guardada', 'success')
  }

  function handleReset() {
    resetToDefaults()
    useUiStore.getState().addToast('Configuración restablecida', 'info')
  }

  const sectionContent: Partial<Record<CategoryId, React.ReactNode>> = {
    account: <AccountSection />,
    appearance: <AppearanceSection />,
    notifications: <NotificationsSection />,
    manual: <ManualContent />,
    permissions: <PermissionsSection />,
  }

  const currentCategory =
    filteredCategories.find((c) => c.id === activeCategory) ?? filteredCategories[0]

  return (
    <div className="w-full flex flex-col gap-8 pb-20 relative">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">Configuración</h2>
          <p className="text-sm font-medium text-gray-500 mt-1.5">Personalizá y controlá tu plataforma</p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar ajustes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl bg-white/40 dark:bg-black/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 pl-11 pr-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
          />
        </div>
      </div>

      {/* Settings Sub-Nav */}
      <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {filteredCategories.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2.5 whitespace-nowrap">Sin resultados para "{search}"</p>
          ) : (
            filteredCategories.map((cat) => {
              const Icon = cat.icon
              const isActive = currentCategory?.id === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl whitespace-nowrap outline-none shrink-0 transition-colors duration-150 ${
                    isActive
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="settings-tab-active"
                      className="absolute inset-0 rounded-xl bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                    />
                  )}
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`relative z-10 shrink-0 transition-colors ${isActive ? 'text-primary' : ''}`}
                  />
                  <span className="relative z-10 text-[13px] font-semibold leading-none tracking-wide">
                    {cat.label}
                  </span>
                </button>
              )
            })
          )}

        </div>
      </div>

      {/* Content Area */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCategory?.id ?? 'empty'}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {currentCategory ? (
              <div className="w-full pb-10">                
                {sectionContent[currentCategory.id]}

                <AnimatePresence>
                  {hasUnsavedChanges && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="mt-10 flex items-center justify-between p-6 bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                        <AlertCircle size={18} strokeWidth={2.5} />
                        <span className="text-sm font-extrabold uppercase tracking-widest hidden sm:inline">Cambios pendientes</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleReset}
                          className="flex items-center gap-2 rounded-xl bg-white/50 dark:bg-gray-800 px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-gray-200/50 dark:border-transparent transition-colors"
                        >
                          <RotateCcw size={16} />
                          Descartar
                        </button>

                        <button
                          type="button"
                          onClick={handleSave}
                          className="flex items-center gap-2 rounded-xl btn-action px-6 py-2.5 text-sm font-extrabold"
                        >
                          <Save size={16} />
                          Guardar cambios
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white/40 dark:bg-[#1e1e1e]/40 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 max-w-4xl">
                <Search size={32} className="text-gray-300 dark:text-gray-600" />
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                  No se encontraron configuraciones para "{search}"
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
