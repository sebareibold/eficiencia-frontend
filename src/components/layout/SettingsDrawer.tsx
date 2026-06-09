import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
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
  Lock,
  Send,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { configuracionApi } from '../../api/configuracion.api'
import { notificacionesApi } from '../../api/notificaciones.api'
import { authApi } from '../../api/auth.api'

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
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-200'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
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
    <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
            value === opt.value
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
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
      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {loading
        ? <span className="h-3 w-3 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
        : <Send size={10} />
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
  'prueba': 'Pruebas',
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

  const load = useCallback(() => {
    notificacionesApi.conteoEmails()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

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
      <div className="px-5 py-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Uso de emails (Resend)</p>
          {!loading && data && <span className="text-xs text-gray-400">Plan gratuito</span>}
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-32 rounded bg-gray-100 dark:bg-white/10 animate-pulse" />
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
            <div className="h-3 w-32 rounded bg-gray-100 dark:bg-white/10 animate-pulse" />
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-500">Hoy</span>
                <span className="font-black tabular-nums text-gray-800 dark:text-gray-200">
                  {data.hoy}<span className="font-medium text-gray-400"> / {data.limites.diario}</span>
                </span>
              </div>
              <ProgressBar value={data.hoy} max={data.limites.diario} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-500">Este mes</span>
                <span className="font-black tabular-nums text-gray-800 dark:text-gray-200">
                  {data.esteMes}<span className="font-medium text-gray-400"> / {data.limites.mensual}</span>
                </span>
              </div>
              <ProgressBar value={data.esteMes} max={data.limites.mensual} />
            </div>

            {data.desglose.length > 0 && (
              <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                <p className="text-[10px] text-gray-400 mb-1.5">Desglose (desde que se activó el tracking)</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.desglose.map(d => (
                    <span
                      key={d.tipo}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.06] text-xs font-semibold text-gray-500 dark:text-gray-400"
                    >
                      {TIPO_LABEL[d.tipo] ?? d.tipo}
                      <span className="font-black text-gray-800 dark:text-gray-200">{d.count}</span>
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
      <div className="px-5 py-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">Enviar resumen ahora</p>
          <p className="text-xs text-gray-400 mt-1 leading-tight">
            Membresías por vencer + clientes con deuda en tiempo real, sin esperar las 9 AM.
          </p>
        </div>
        <button
          type="button"
          onClick={handle}
          disabled={loading}
          className="self-start flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 dark:hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : <Send size={12} />
          }
          {loading ? 'Enviando...' : 'Enviar ahora'}
        </button>
      </div>
    </SectionCard>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm overflow-hidden">
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
      className={`flex items-center justify-between gap-4 px-5 py-5 ${
        !last ? 'border-b border-gray-50' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-gray-800 leading-tight">{label}</p>
        {description && (
          <p className="text-sm text-gray-400 mt-1 leading-tight">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1 mb-3 mt-6 first:mt-0">
      {title}
    </p>
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
        <div className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-3">
            Color principal usado en botones y elementos destacados
          </p>
          <div className="flex items-center gap-2.5">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => updateAppearance({ accentColor: color.value })}
                className="relative h-8 w-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: color.value }}
              >
                {appearance.accentColor === color.value && (
                  <Check size={14} className="text-white" strokeWidth={3} />
                )}
              </button>
            ))}
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
        <SectionRow label="Email de notificaciones" description="Si lo dejás vacío, se usa el email del administrador del sistema." last>
          <input
            type="email"
            value={notifications.emailDestino}
            onChange={(e) => updateNotifications({ emailDestino: e.target.value })}
            placeholder="admin@eficiencia.com"
            className="w-full rounded-xl border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Qué notificar" />
      <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        Membresías y deudas → resumen diario a las <strong className="text-gray-700 dark:text-gray-300">9 AM</strong>. Nuevos clientes/usuarios → <strong className="text-gray-700 dark:text-gray-300">al instante</strong>.
      </div>
      <SectionCard>
        <SectionRow label="Membresías por vencer" description="Lista de membresías activas que vencen pronto, con cliente, plan y días restantes.">
          <div className="flex items-center gap-2">
            <ProbarBtn tipo="vencimientos" />
            <Toggle checked={notifications.notifVencimientos} onChange={(v) => updateNotifications({ notifVencimientos: v })} />
          </div>
        </SectionRow>
        {notifications.notifVencimientos && (
          <SectionRow label="Días de anticipación" description="Rango de búsqueda desde hoy.">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => updateNotifications({ diasAnticipacion: Math.max(1, notifications.diasAnticipacion - 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm">−</button>
              <span className="w-6 text-center text-sm font-black text-gray-900 dark:text-white tabular-nums">{notifications.diasAnticipacion}</span>
              <button type="button" onClick={() => updateNotifications({ diasAnticipacion: Math.min(30, notifications.diasAnticipacion + 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-bold text-sm">+</button>
            </div>
          </SectionRow>
        )}
        <SectionRow label="Clientes con deuda" description="Todos los clientes en estado DEUDA con nombre, email y teléfono.">
          <div className="flex items-center gap-2">
            <ProbarBtn tipo="deudas" />
            <Toggle checked={notifications.notifDeudas} onChange={(v) => updateNotifications({ notifDeudas: v })} />
          </div>
        </SectionRow>
        <SectionRow label="Nuevos clientes" description="Al registrar un cliente: nombre, CUIL y email.">
          <div className="flex items-center gap-2">
            <ProbarBtn tipo="nuevos-clientes" />
            <Toggle checked={notifications.notifNuevosClientes} onChange={(v) => updateNotifications({ notifNuevosClientes: v })} />
          </div>
        </SectionRow>
        <SectionRow label="Nuevos usuarios del sistema" description="Al crear un usuario o aprobar una solicitud de acceso: nombre, email y rol.">
          <div className="flex items-center gap-2">
            <ProbarBtn tipo="nuevos-usuarios" />
            <Toggle checked={notifications.notifNuevosUsuarios} onChange={(v) => updateNotifications({ notifNuevosUsuarios: v })} />
          </div>
        </SectionRow>
        <SectionRow label="Email al aprobar solicitudes" description="Todos los admins con este toggle activo reciben email al aprobarse una solicitud, con quién aprobó, el nuevo usuario y la fecha exacta." last>
          <div className="flex items-center gap-2">
            <ProbarBtn tipo="solicitud-aprobada" />
            <Toggle checked={notifications.emailAlAprobarSolicitudes} onChange={(v) => updateNotifications({ emailAlAprobarSolicitudes: v })} />
          </div>
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Uso de emails" />
      <ConteoEmailsCard />

      <SectionHeader title="Enviar ahora" />
      <EnviarResumenCard />

      <SectionHeader title="Canal" />
      <SectionCard>
        <SectionRow label="Cómo recibir los avisos" description="Dashboard: alertas en el inicio. Email: en tu correo. Ambos: las dos opciones activas." last>
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

  const inputClass = "w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"

  return (
    <div>
      <SectionHeader title="Perfil" />
      <SectionCard>
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              {user?.name} {user?.lastName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold uppercase tracking-wide text-primary">
              {user?.role === 'admin' ? 'Administrador' : user?.role === 'profesor' ? 'Profesor' : 'Staff'}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionHeader title="Contraseña" />
      <SectionCard>
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">Cambiar contraseña</p>
            <p className="text-xs text-gray-400 mt-0.5">Actualizá tu contraseña de acceso.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowPwForm(!showPwForm); setPwError('') }}
            className="shrink-0 px-4 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all"
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
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <form onSubmit={handleChangePassword} className="px-5 pb-5 space-y-3 border-t border-gray-50 dark:border-white/5 pt-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Contraseña actual</label>
                  <input
                    type={showActual ? 'text' : 'password'}
                    value={pwForm.actual}
                    onChange={(e) => setPwForm({ ...pwForm, actual: e.target.value })}
                    autoComplete="current-password"
                    className={inputClass}
                    required
                  />
                  <button type="button" onClick={() => setShowActual(!showActual)} className="absolute right-3 bottom-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                    {showActual ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nueva contraseña</label>
                  <input
                    type={showNueva ? 'text' : 'password'}
                    value={pwForm.nueva}
                    onChange={(e) => setPwForm({ ...pwForm, nueva: e.target.value })}
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                  <button type="button" onClick={() => setShowNueva(!showNueva)} className="absolute right-3 bottom-2.5 text-gray-400 hover:text-gray-600 transition-colors">
                    {showNueva ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Confirmar nueva contraseña</label>
                  <input
                    type={showNueva ? 'text' : 'password'}
                    value={pwForm.confirmar}
                    onChange={(e) => setPwForm({ ...pwForm, confirmar: e.target.value })}
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                </div>

                {pwError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle size={13} className="shrink-0" />
                    {pwError}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={pwLoading || !pwForm.actual || !pwForm.nueva || !pwForm.confirmar}
                    className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pwLoading ? (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <Lock size={13} />
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

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId = 'appearance' | 'notifications' | 'account'

const CATEGORIES: {
  id: CategoryId
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  keywords: string[]
}[] = [
  {
    id: 'account',
    label: 'Cuenta',
    icon: User,
    keywords: ['perfil', 'cuenta', 'contraseña', 'email'],
  },
  {
    id: 'appearance',
    label: 'Apariencia',
    icon: Palette,
    keywords: ['tema', 'modo', 'claro', 'oscuro', 'color', 'acento'],
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: Bell,
    adminOnly: true,
    keywords: ['alertas', 'notificaciones', 'email', 'app', 'frecuencia'],
  },
]

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function SettingsDrawer() {
  const { settingsOpen, closeSettings } = useUiStore()
  const { hasUnsavedChanges, saveSettings, resetToDefaults } = useSettingsStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [activeCategory, setActiveCategory] = useState<CategoryId>('account')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredCategories = CATEGORIES.filter((cat) => {
    if (cat.adminOnly && !isAdmin) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return cat.label.toLowerCase().includes(q) || cat.keywords.some((k) => k.includes(q))
  })

  useEffect(() => {
    if (settingsOpen) {
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 300)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!settingsOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settingsOpen, closeSettings])

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
  }

  const currentCategory =
    filteredCategories.find((c) => c.id === activeCategory) ?? filteredCategories[0]

  return createPortal(
    <AnimatePresence>
      {settingsOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={closeSettings}
          />

          {/* Drawer */}
          <motion.div
            key="settings-drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[92vw] max-w-[490px] flex flex-col bg-[#F7F7F8] dark:bg-[#111111] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#252525] shrink-0">
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900 leading-tight">Configuración</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Personalizá la app a tu gusto
                </p>
              </div>

              {/* Search — hidden on mobile to save space */}
                <div className="relative hidden sm:block w-52">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl bg-gray-100 border border-transparent pl-10 pr-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>

              <button
                type="button"
                onClick={closeSettings}
                className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none shrink-0"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0 flex-col sm:flex-row">

              {/* Mobile: horizontal scrollable category tabs */}
              <div className="sm:hidden overflow-x-auto flex gap-1.5 px-3 py-2.5 border-b border-gray-100 dark:border-[#252525] bg-white dark:bg-[#161616] shrink-0 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                {filteredCategories.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-1 whitespace-nowrap">Sin resultados</p>
                ) : filteredCategories.map((cat) => {
                  const Icon = cat.icon
                  const isActive = currentCategory?.id === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-150 ${
                        isActive
                          ? 'bg-gray-900 text-white shadow-sm'
                          : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <Icon size={13} strokeWidth={2} className="shrink-0" />
                      <span>{cat.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Desktop: sidebar nav */}
              <nav className="hidden sm:flex flex-col w-56 shrink-0 border-r border-gray-100 dark:border-[#252525] bg-white dark:bg-[#161616] py-3 gap-0.5 overflow-y-auto">
                {filteredCategories.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-3">Sin resultados</p>
                ) : (
                  filteredCategories.map((cat) => {
                    const Icon = cat.icon
                    const isActive = currentCategory?.id === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`flex items-center gap-3 mx-2 px-4 py-3.5 rounded-xl text-left transition-all duration-150 ${
                          isActive
                            ? 'bg-gray-900 dark:bg-white/10 text-white dark:text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Icon size={18} strokeWidth={2} className="shrink-0" />
                        <span className="text-sm font-semibold leading-tight">{cat.label}</span>
                      </button>
                    )
                  })
                )}
              </nav>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentCategory?.id ?? 'empty'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {currentCategory ? (
                      sectionContent[currentCategory.id]
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <Search size={24} className="text-gray-300" />
                        <p className="text-sm text-gray-400">
                          No se encontraron configuraciones para "{search}"
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-[#252525]">
              <AnimatePresence>
                {hasUnsavedChanges && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="flex items-center gap-1.5 text-amber-600 mr-auto"
                  >
                    <AlertCircle size={13} />
                    <span className="text-xs font-medium">Cambios sin guardar</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!hasUnsavedChanges && <div className="mr-auto" />}

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525] hover:text-gray-800 transition-colors"
              >
                <RotateCcw size={12} />
                Restablecer
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors shadow-sm"
              >
                <Save size={14} />
                Guardar cambios
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
