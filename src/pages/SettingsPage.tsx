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
  Settings2,
  Clock,
  CalendarOff,
  Play,
  RefreshCw,
  Cog,
} from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { configuracionApi } from '../api/configuracion.api'
import { configuracionSistemaApi, type ConfiguracionSistema } from '../api/configuracion-sistema.api'
import { mantenimientoApi, type ConsistenciaReport } from '../api/mantenimiento.api'
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


function NotifRow({
  label,
  description,
  tipo,
  checked,
  onChange,
  last,
}: {
  label: string
  description: string
  tipo: string
  checked: boolean
  onChange: (v: boolean) => void
  last?: boolean
}) {
  const navigate = useNavigate()
  return (
    <SectionRow label={label} description={description} last={last}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate(`/settings/notificaciones/${tipo}`)}
          title="Configurar template"
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition-all"
        >
          <Cog size={14} />
        </button>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </SectionRow>
  )
}

function ResumenPeriodicidadCard() {
  const [config, setConfig] = useState<ConfiguracionSistema | null>(null)
  const [loading, setLoading] = useState(true)
  const addToast = useUiStore(s => s.addToast)
  const { notifications, updateNotifications } = useSettingsStore()
  const navigate = useNavigate()

  useEffect(() => {
    configuracionSistemaApi.get()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function updateField(field: Partial<ConfiguracionSistema>) {
    if (!config) return
    const optimistic = { ...config, ...field }
    setConfig(optimistic)
    try {
      const updated = await configuracionSistemaApi.update(field)
      setConfig(updated)
    } catch {
      setConfig(config)
      addToast('Error al guardar configuración', 'error')
    }
  }

  if (loading || !config) return null

  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const FRECUENCIAS = [
    { value: 'DAILY', label: 'Diario' },
    { value: 'WEEKLY', label: 'Semanal' },
    { value: 'MONTHLY', label: 'Mensual' },
  ]

  return (
    <>
      <SectionHeader title="Resumen automático" />
      <SectionCard>
        <SectionRow
          label="Envío automático"
          description="Si está activado, el resumen de membresías y deudas se envía automáticamente según la periodicidad configurada."
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/settings/notificaciones/vencimientos')}
              title="Configurar template"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition-all"
            >
              <Cog size={14} />
            </button>
            <Toggle
              checked={config.resumenAutomatico}
              onChange={(v) => updateField({ resumenAutomatico: v })}
            />
          </div>
        </SectionRow>

        {config.resumenAutomatico && (
          <>
            <SectionRow label="Frecuencia" description="Con qué frecuencia se envía el resumen.">
              <div className="flex gap-1.5">
                {FRECUENCIAS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => updateField({ resumenFrecuencia: f.value as ConfiguracionSistema['resumenFrecuencia'] })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      config.resumenFrecuencia === f.value
                        ? 'bg-primary text-black'
                        : 'bg-gray-100/60 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </SectionRow>

            {config.resumenFrecuencia === 'WEEKLY' && (
              <SectionRow label="Día de la semana" description="En qué día se envía el resumen semanal.">
                <select
                  value={config.resumenDiaSemana ?? 1}
                  onChange={e => updateField({ resumenDiaSemana: Number(e.target.value) })}
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {DIAS_SEMANA.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </SectionRow>
            )}

            {config.resumenFrecuencia === 'MONTHLY' && (
              <SectionRow label="Día del mes" description="En qué día del mes se envía el resumen.">
                <select
                  value={config.resumenDiaMes ?? 1}
                  onChange={e => updateField({ resumenDiaMes: Number(e.target.value) })}
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </SectionRow>
            )}

            <SectionRow label="Hora de envío" description="A qué hora se envía el resumen.">
              <select
                value={config.resumenHora}
                onChange={e => updateField({ resumenHora: Number(e.target.value) })}
                className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </SectionRow>
          </>
        )}

        <SectionRow label="Email de destino" description="Dirección donde llega el resumen. Si está vacío se usa el email del administrador." last>
          <input
            type="email"
            value={notifications.emailDestino}
            onChange={e => updateNotifications({ emailDestino: e.target.value })}
            placeholder="admin@eficiencia.com"
            className="w-56 rounded-xl border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </SectionRow>
      </SectionCard>
    </>
  )
}

function NotificationsSection() {
  const { notifications, updateNotifications } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Qué notificar" />

      {/* Info banner */}

      <SectionCard>
        <NotifRow tipo="vencimientos" label="Membresías por vencer"
          description="Recibís un email con la lista de membresías activas que vencen pronto."
          checked={notifications.notifVencimientos} onChange={(v) => updateNotifications({ notifVencimientos: v })} />
        <NotifRow tipo="deudas" label="Clientes con deuda"
          description="Email con todos los clientes en estado DEUDA."
          checked={notifications.notifDeudas} onChange={(v) => updateNotifications({ notifDeudas: v })} />
        <NotifRow tipo="nuevos-clientes" label="Nuevos clientes"
          description="Email inmediato al registrar un cliente."
          checked={notifications.notifNuevosClientes} onChange={(v) => updateNotifications({ notifNuevosClientes: v })} />
        <NotifRow tipo="nuevos-usuarios" label="Nuevos usuarios del sistema"
          description="Email inmediato al crear un usuario o al aprobar una solicitud."
          checked={notifications.notifNuevosUsuarios} onChange={(v) => updateNotifications({ notifNuevosUsuarios: v })} />
        <NotifRow tipo="solicitud-aprobada" label="Email al aprobar solicitudes"
          description="Notificación a admins cuando se aprueba una solicitud de acceso."
          checked={notifications.emailAlAprobarSolicitudes} onChange={(v) => updateNotifications({ emailAlAprobarSolicitudes: v })} />
        <NotifRow tipo="baja-automatica" label="Bajas automáticas de turnos"
          description="Email cuando un cliente es dado de baja automáticamente de sus turnos."
          checked={notifications.notifBajaAutomatica} onChange={(v) => updateNotifications({ notifBajaAutomatica: v })} last />
      </SectionCard>

      <SectionHeader title="Solicitudes y accesos" />
      <SectionCard>
        <NotifRow tipo="solicitud-acceso" label="Solicitudes de acceso"
          description="Email inmediato cuando alguien solicita acceso al sistema."
          checked={notifications.notifSolicitudAcceso} onChange={(v) => updateNotifications({ notifSolicitudAcceso: v })} />
        <NotifRow tipo="reset-password" label="Solicitudes de cambio de contraseña"
          description="Email cuando un usuario pide recuperar su contraseña."
          checked={notifications.notifResetPassword} onChange={(v) => updateNotifications({ notifResetPassword: v })} />
        <NotifRow tipo="solicitud-turno" label="Solicitudes de turno (lista de espera)"
          description="Email cuando se libera un cupo y un cliente pasa a pendiente de aprobación."
          checked={notifications.notifSolicitudTurno} onChange={(v) => updateNotifications({ notifSolicitudTurno: v })} />
        <NotifRow tipo="pago-registrado" label="Pagos registrados"
          description="Email cada vez que se registra un pago en el sistema."
          checked={notifications.notifPagoRegistrado} onChange={(v) => updateNotifications({ notifPagoRegistrado: v })} last />
      </SectionCard>

      <ResumenPeriodicidadCard />

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
  'solicitudes-turno': 'Solicitudes',
}

const ACCION_LABELS: Record<string, string> = {
  read:   'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  mark:   'Marcar asistencia',
}

// Módulos excluidos de la vista principal (aparecen como sub-filas de otro módulo o no aplican)
const EXCLUDE_MODULES = ['dashboard', 'attendance', 'reposiciones', 'solicitudes-turno']

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
  'solicitudes-turno': ['read', 'update'],
}

// Sub-acciones anidadas debajo de su módulo padre.
// fromModule: si se define, el permiso se lee de permisos[fromModule][key] en vez del módulo padre.
const MODULE_SUBACTIONS: Record<string, { key: string; label: string; fromModule?: string }[]> = {
  clients: [
    { key: 'view_pagos',      label: 'Ver pagos del cliente' },
    { key: 'view_membresias', label: 'Ver membresías del cliente' },
    { key: 'view_rutinas',    label: 'Ver rutinas del cliente' },
    { key: 'view_turnos',     label: 'Ver clases del cliente' },
    { key: 'view_asistencia', label: 'Ver asistencia del cliente' },
    { key: 'manage_turnos',   label: 'Inscribir/desinscribir de turnos' },
    { key: 'read',   label: 'Ver reposiciones y ausencias del cliente',  fromModule: 'reposiciones' },
    { key: 'create', label: 'Registrar ausencias y agendar recuperaciones', fromModule: 'reposiciones' },
  ],
  shifts: [
    { key: 'mark',   label: 'Marcar asistencia a clases',          fromModule: 'attendance' },
    { key: 'read',   label: 'Ver historial de asistencia',          fromModule: 'attendance' },
    { key: 'delete', label: 'Eliminar registros de asistencia',     fromModule: 'attendance' },
    { key: 'read',   label: 'Ver solicitudes de turno',             fromModule: 'solicitudes-turno' },
    { key: 'update', label: 'Aprobar o rechazar solicitudes',       fromModule: 'solicitudes-turno' },
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
  'solicitudes-turno': 'Ver y gestionar solicitudes de turno pendientes de aprobación.',
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

// ─── Sistema Section ──────────────────────────────────────────────────────────

function SistemaSection() {
  const navigate  = useNavigate()
  const addToast  = useUiStore(s => s.addToast)
  const { notifications, updateNotifications } = useSettingsStore()
  const [config, setConfig] = useState<ConfiguracionSistema | null>(null)
  const [saving,  setSaving]  = useState(false)

  // Mantenimiento
  const [running,  setRunning]  = useState(false)
  const [report,   setReport]   = useState<ConsistenciaReport | null>(null)

  useEffect(() => {
    configuracionSistemaApi.get().then(setConfig).catch(() => {})
  }, [])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      const updated = await configuracionSistemaApi.update({
        diasGraciaInactivacion: config.diasGraciaInactivacion,
        horaEjecucionCron: config.horaEjecucionCron,
      })
      setConfig(updated)
      addToast('Configuración del sistema guardada', 'success')
    } catch {
      addToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleConsistencia() {
    setRunning(true)
    setReport(null)
    try {
      const r = await mantenimientoApi.consistencia()
      setReport(r)
      const total = r.membresias.marcadasVencidas + r.membresias.activadasDesdePendiente + r.clientes.reactivados
      addToast(total > 0 ? `Consistencia aplicada — ${total} correcciones` : 'Sistema consistente, sin cambios', 'success')
    } catch {
      addToast('Error al ejecutar verificación', 'error')
    } finally {
      setRunning(false)
    }
  }

  if (!config) return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white/10 dark:bg-white/[0.05]" />)}
    </div>
  )

  const horaLabel = `${String(config.horaEjecucionCron).padStart(2, '0')}:00`

  return (
    <div className="space-y-6">

      {/* ── Parámetros del sistema ───────────────────────────────────────────── */}
      <SectionHeader title="Parámetros del sistema" />
      <SectionCard>
        <SectionRow
          label="Días de gracia por vencimiento"
          description={
            <>
              Días que se esperan desde el <strong>inicio del mes siguiente</strong> al vencimiento antes de pasar al cliente a inactivo.
              <br />
              <span className="text-primary font-semibold">Ej: vence en marzo → espera desde el 1° de abril + {config.diasGraciaInactivacion} días.</span>
            </>
          }
        >
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => setConfig(c => c ? { ...c, diasGraciaInactivacion: Math.max(1, c.diasGraciaInactivacion - 1) } : c)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm"
            >−</button>
            <span className="w-8 text-center text-sm font-black text-gray-900 dark:text-white tabular-nums">{config.diasGraciaInactivacion}</span>
            <button type="button"
              onClick={() => setConfig(c => c ? { ...c, diasGraciaInactivacion: Math.min(60, c.diasGraciaInactivacion + 1) } : c)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm"
            >+</button>
          </div>
        </SectionRow>

        <SectionRow
          label="Hora de ejecución"
          description={
            <>
              Hora a la que el sistema revisa y aplica inactivaciones automáticamente.
              <br />
              <span className="text-gray-500 dark:text-[#8A8A9A]">Configurado para las <strong className="text-gray-900 dark:text-white">{horaLabel} hs</strong>.</span>
            </>
          }
        >
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400 shrink-0" />
            <select
              value={config.horaEjecucionCron}
              onChange={e => setConfig(c => c ? { ...c, horaEjecucionCron: Number(e.target.value) } : c)}
              className="rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-sm font-bold text-gray-900 dark:text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </SectionRow>

        <SectionRow
          label="Email de notificaciones"
          description="Dirección donde llegan los avisos del sistema. Si lo dejás vacío, se usa el email del administrador."
        >
          <input
            type="email"
            value={notifications.emailDestino}
            onChange={(e) => updateNotifications({ emailDestino: e.target.value })}
            placeholder="admin@eficiencia.com"
            className="w-52 rounded-xl border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </SectionRow>

        <SectionRow
          label="Días de anticipación"
          description="Cuántos días antes del vencimiento de una membresía se envía el aviso. Ej: 7 días = avisás una semana antes."
        >
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => updateNotifications({ diasAnticipacion: Math.max(1, notifications.diasAnticipacion - 1) })}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm"
            >−</button>
            <span className="w-8 text-center text-sm font-black text-gray-900 dark:text-white tabular-nums">{notifications.diasAnticipacion}</span>
            <button type="button"
              onClick={() => updateNotifications({ diasAnticipacion: Math.min(30, notifications.diasAnticipacion + 1) })}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm"
            >+</button>
          </div>
        </SectionRow>

        <SectionRow
          label="Canal de notificaciones"
          description="Dashboard: alertas en la sección de inicio. Email: avisos por correo. Ambos: las dos opciones activas."
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

      <SectionHeader title="Enviar ahora" />
      <EnviarResumenCard />

      {/* ── Herramientas ─────────────────────────────────────────────────────── */}
      <SectionHeader title="Herramientas" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Consistencia — izquierda */}
        <button type="button" onClick={handleConsistencia} disabled={running}
          className="group text-left rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/[0.03] hover:bg-white/60 dark:hover:bg-white/[0.06] p-5 transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <RefreshCw size={16} className={`text-primary ${running ? 'animate-spin' : ''}`} />
            </div>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30">
              {running ? 'Corriendo' : 'Cron diario'}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">
            {running ? 'Verificando...' : 'Verificar consistencia'}
          </p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed space-y-0.5 list-none">
            <li>· Marca como <strong className="text-gray-700 dark:text-gray-300">VENCIDA</strong> toda membresía cuya fecha ya pasó</li>
            <li>· Activa membresías <strong className="text-gray-700 dark:text-gray-300">PENDIENTES</strong> cuya fecha de inicio llegó</li>
            <li>· Reactiva clientes con membresía vigente marcados como vencidos</li>
            <li>· Detecta clientes con más de una membresía activa simultánea</li>
          </ul>
          <p className="text-[10px] text-gray-400 dark:text-white/30 mt-2">También corre automáticamente a medianoche.</p>
        </button>

        {/* Seguridad — derecha */}
        <button type="button" onClick={() => navigate(ROUTES.SECURITY)}
          className="group text-left rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/[0.03] hover:bg-white/60 dark:hover:bg-white/[0.06] p-5 transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-400/10">
              <Shield size={16} className="text-amber-500 dark:text-amber-400" />
            </div>
            <ArrowRight size={14} className="text-gray-300 dark:text-white/20 group-hover:text-gray-400 dark:group-hover:text-white/40 mt-1 transition-colors" />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">Registro de actividad</p>
          <ul className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed space-y-0.5 list-none">
            <li>· Intentos de acceso al sistema (logins y fallos)</li>
            <li>· Cambios en permisos y roles de usuarios</li>
            <li>· Pagos eliminados y operaciones sensibles</li>
            <li>· Acciones críticas registradas con usuario y fecha</li>
          </ul>
        </button>
      </div>

      {/* ── Resultado del último chequeo ─────────────────────────────────────── */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/[0.03] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Último chequeo
              </p>
              <p className="text-xs text-gray-400 dark:text-white/30 tabular-nums">
                {new Date(report.ejecutadoEn).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: 'Membresías vencidas',    value: report.membresias.marcadasVencidas,        warn: report.membresias.marcadasVencidas > 0 },
                { label: 'Activadas',              value: report.membresias.activadasDesdePendiente,  warn: false },
                { label: 'Doble activa',           value: report.membresias.clientesConDobleActiva,   warn: report.membresias.clientesConDobleActiva > 0 },
                { label: 'Clientes reactivados',   value: report.clientes.reactivados,                warn: false },
                { label: 'Sin membresía',          value: report.clientes.sinMembresia,               warn: report.clientes.sinMembresia > 0 },
              ].map(({ label, value, warn }) => (
                <div key={label} className="rounded-xl bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/[0.06] px-3 py-2.5 text-center">
                  <p className={`text-xl font-black tabular-nums ${warn ? 'text-amber-500 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Alertas accionables */}
            <div className="space-y-2 pt-1">
              {report.clientes.sinMembresia > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/[0.06] dark:bg-amber-400/[0.06] border border-amber-500/20 dark:border-amber-400/15 px-3.5 py-2.5">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>
                      <strong>{report.clientes.sinMembresia}</strong> cliente{report.clientes.sinMembresia !== 1 ? 's' : ''} activo{report.clientes.sinMembresia !== 1 ? 's' : ''} sin membresía vigente.
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`${ROUTES.CLIENTS}?estadoPago=VENCIDO`)}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
                  >
                    Ver clientes
                    <ArrowRight size={11} />
                  </button>
                </div>
              )}
              {report.membresias.clientesConDobleActiva > 0 && (
                <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/[0.06] dark:bg-amber-400/[0.06] border border-amber-500/20 dark:border-amber-400/15 px-3.5 py-2.5">
                  <AlertCircle size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>{report.membresias.clientesConDobleActiva}</strong> cliente{report.membresias.clientesConDobleActiva !== 1 ? 's' : ''} con más de una membresía activa simultánea. Revisá el perfil de cada uno para corregirlo.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 rounded-xl btn-action px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" /> : <Save size={13} />}
          Guardar cambios
        </button>
      </div>
    </div>
  )
}

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId = 'appearance' | 'notifications' | 'account' | 'manual' | 'permissions' | 'sistema'

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
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Settings2,
    adminOnly: true,
    keywords: ['inactivación', 'automática', 'días', 'gracia', 'cron', 'horario', 'vencimiento', 'seguridad', 'actividad', 'mantenimiento', 'consistencia', 'membresías', 'email', 'canal', 'anticipación', 'resend'],
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
        notifBajaAutomatica: notifications.notifBajaAutomatica,
        notifSolicitudAcceso: notifications.notifSolicitudAcceso,
        notifResetPassword: notifications.notifResetPassword,
        notifSolicitudTurno: notifications.notifSolicitudTurno,
        notifPagoRegistrado: notifications.notifPagoRegistrado,
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
    sistema: <SistemaSection />,
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
