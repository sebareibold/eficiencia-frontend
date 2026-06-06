import { useState, useRef } from 'react'
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
} from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { configuracionApi } from '../api/configuracion.api'
import { authApi } from '../api/auth.api'

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
          <Toggle
            checked={notifications.notifVencimientos}
            onChange={(v) => updateNotifications({ notifVencimientos: v })}
          />
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
          <Toggle
            checked={notifications.notifDeudas}
            onChange={(v) => updateNotifications({ notifDeudas: v })}
          />
        </SectionRow>
        <SectionRow
          label="Nuevos clientes"
          description="Email inmediato al registrar un cliente. Incluye nombre, CUIL y email del nuevo socio."
        >
          <Toggle
            checked={notifications.notifNuevosClientes}
            onChange={(v) => updateNotifications({ notifNuevosClientes: v })}
          />
        </SectionRow>
        <SectionRow
          label="Nuevos usuarios del sistema"
          description="Email inmediato al crear un usuario (staff, profesor o admin) o al aprobar una solicitud de acceso. Incluye nombre, email y rol asignado."
          last
        >
          <Toggle
            checked={notifications.notifNuevosUsuarios}
            onChange={(v) => updateNotifications({ notifNuevosUsuarios: v })}
          />
        </SectionRow>
      </SectionCard>

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
]

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
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
