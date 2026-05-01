import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Palette,
  LayoutDashboard,
  Bell,
  User,
  Shield,
  Globe,
  Sun,
  Moon,
  Check,
  RotateCcw,
  Save,
  Search,
  AlertCircle,
  Laptop,
  Smartphone,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'

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
        checked ? 'bg-primary' : 'bg-gray-200'
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

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
      className={`flex items-center justify-between gap-4 px-5 py-4 ${
        !last ? 'border-b border-gray-50' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-tight">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-2 mt-5 first:mt-0">
      {title}
    </p>
  )
}

// ─── Accent color picker ──────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { value: '#F5A623', label: 'Naranja' },
  { value: '#3B82F6', label: 'Azul' },
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

      <SectionHeader title="Densidad" />
      <SectionCard>
        <SectionRow
          label="Espaciado de la interfaz"
          description="Controla el padding y tamaño de los elementos"
          last
        >
          <SegmentedControl
            options={[
              { value: 'compact', label: 'Compacta' },
              { value: 'comfortable', label: 'Cómoda' },
            ]}
            value={appearance.density}
            onChange={(v) => updateAppearance({ density: v })}
          />
        </SectionRow>
      </SectionCard>
    </div>
  )
}

function DashboardSection() {
  const { dashboard, updateDashboard } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Widgets visibles" />
      <SectionCard>
        <SectionRow label="Ingresos del mes" description="Tarjeta de resumen de pagos">
          <Toggle
            checked={dashboard.showRevenue}
            onChange={(v) => updateDashboard({ showRevenue: v })}
          />
        </SectionRow>
        <SectionRow label="Clientes activos" description="Contador de clientes al día">
          <Toggle
            checked={dashboard.showClients}
            onChange={(v) => updateDashboard({ showClients: v })}
          />
        </SectionRow>
        <SectionRow label="Gastos del mes" description="Tarjeta de egresos registrados">
          <Toggle
            checked={dashboard.showExpenses}
            onChange={(v) => updateDashboard({ showExpenses: v })}
          />
        </SectionRow>
        <SectionRow label="Ganancia neta" description="Ingresos menos gastos" last>
          <Toggle
            checked={dashboard.showProfit}
            onChange={(v) => updateDashboard({ showProfit: v })}
          />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Presentación" />
      <SectionCard>
        <SectionRow label="Layout de widgets" last>
          <SegmentedControl
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'compact', label: 'Compacto' },
            ]}
            value={dashboard.layout}
            onChange={(v) => updateDashboard({ layout: v })}
          />
        </SectionRow>
      </SectionCard>
    </div>
  )
}

function NotificationsSection() {
  const { notifications, updateNotifications } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Alertas" />
      <SectionCard>
        <SectionRow label="Actividad" description="Acciones y cambios en el sistema">
          <Toggle
            checked={notifications.activity}
            onChange={(v) => updateNotifications({ activity: v })}
          />
        </SectionRow>
        <SectionRow label="Nuevos clientes" description="Al registrar un cliente nuevo">
          <Toggle
            checked={notifications.newClients}
            onChange={(v) => updateNotifications({ newClients: v })}
          />
        </SectionRow>
        <SectionRow label="Reportes y ganancias" description="Resúmenes automáticos" last>
          <Toggle
            checked={notifications.reports}
            onChange={(v) => updateNotifications({ reports: v })}
          />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Frecuencia" />
      <SectionCard>
        <SectionRow label="Enviar notificaciones" last>
          <SegmentedControl
            options={[
              { value: 'instant', label: 'Al instante' },
              { value: 'daily', label: 'Diario' },
              { value: 'weekly', label: 'Semanal' },
            ]}
            value={notifications.frequency}
            onChange={(v) => updateNotifications({ frequency: v })}
          />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Canal" />
      <SectionCard>
        <SectionRow label="Recibir por" last>
          <SegmentedControl
            options={[
              { value: 'app', label: 'App' },
              { value: 'email', label: 'Email' },
              { value: 'both', label: 'Ambos' },
            ]}
            value={notifications.channel}
            onChange={(v) => updateNotifications({ channel: v })}
          />
        </SectionRow>
      </SectionCard>
    </div>
  )
}

function AccountSection() {
  const { user } = useAuthStore()
  const initials = user
    ? `${user.name.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?'

  return (
    <div>
      <SectionHeader title="Perfil" />
      <SectionCard>
        <div className="px-5 py-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gray-900 flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-md">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {user?.name} {user?.lastName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {user?.role === 'admin' ? 'Administrador' : 'Staff'}
            </span>
          </div>
        </div>
        <div className="border-t border-gray-50 px-5 py-4 flex items-center gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Editar perfil
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cambiar contraseña
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

function SecuritySection() {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [showSessions, setShowSessions] = useState(false)

  const mockDevices = [
    { name: 'Chrome — Windows', icon: Laptop, lastSeen: 'Ahora mismo', current: true },
    { name: 'Safari — iPhone', icon: Smartphone, lastSeen: 'Hace 2 días', current: false },
  ]

  return (
    <div>
      <SectionHeader title="Autenticación" />
      <SectionCard>
        <SectionRow
          label="Autenticación en 2 pasos"
          description="Agrega una capa extra de seguridad al iniciar sesión"
          last
        >
          <Toggle checked={twoFAEnabled} onChange={setTwoFAEnabled} />
        </SectionRow>
      </SectionCard>

      <SectionHeader title="Dispositivos activos" />
      <SectionCard>
        {mockDevices.map((device, i) => {
          const Icon = device.icon
          return (
            <div
              key={device.name}
              className={`flex items-center gap-3 px-5 py-4 ${
                i < mockDevices.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 leading-tight">{device.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{device.lastSeen}</p>
              </div>
              {device.current && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                  Activo
                </span>
              )}
            </div>
          )
        })}
      </SectionCard>

      <SectionHeader title="Acceso" />
      <SectionCard>
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => setShowSessions(!showSessions)}
            className="w-full flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
          >
            <LogOut size={15} />
            Cerrar todas las sesiones
          </button>
          <AnimatePresence>
            {showSessions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                  Esto cerrará todas las sesiones activas en todos los dispositivos. Tendrás que
                  iniciar sesión nuevamente.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>
    </div>
  )
}

function SystemSection() {
  const { system, updateSystem } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Regional" />
      <SectionCard>
        <SectionRow label="Idioma" description="Idioma de la interfaz">
          <SegmentedControl
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
            ]}
            value={system.language}
            onChange={(v) => updateSystem({ language: v })}
          />
        </SectionRow>
        <SectionRow label="Zona horaria">
          <select
            value={system.timezone}
            onChange={(e) => updateSystem({ timezone: e.target.value })}
            className="text-xs rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          >
            <option value="America/Argentina/Buenos_Aires">Buenos Aires (ART)</option>
            <option value="America/New_York">Nueva York (EST)</option>
            <option value="Europe/Madrid">Madrid (CET)</option>
            <option value="UTC">UTC</option>
          </select>
        </SectionRow>
        <SectionRow label="Formato de fecha">
          <SegmentedControl
            options={[
              { value: 'dd/MM/yyyy', label: 'DD/MM/AAAA' },
              { value: 'MM/dd/yyyy', label: 'MM/DD/AAAA' },
              { value: 'yyyy-MM-dd', label: 'ISO' },
            ]}
            value={system.dateFormat}
            onChange={(v) => updateSystem({ dateFormat: v })}
          />
        </SectionRow>
        <SectionRow label="Moneda" last>
          <SegmentedControl
            options={[
              { value: 'ARS', label: 'ARS $' },
              { value: 'USD', label: 'USD $' },
            ]}
            value={system.currency}
            onChange={(v) => updateSystem({ currency: v })}
          />
        </SectionRow>
      </SectionCard>
    </div>
  )
}

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId = 'appearance' | 'dashboard' | 'notifications' | 'account' | 'security' | 'system'

const CATEGORIES: {
  id: CategoryId
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  keywords: string[]
}[] = [
  {
    id: 'appearance',
    label: 'Apariencia',
    icon: Palette,
    keywords: ['tema', 'modo', 'claro', 'oscuro', 'color', 'acento', 'densidad', 'espaciado'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    adminOnly: true,
    keywords: ['dashboard', 'widgets', 'ingresos', 'clientes', 'gastos', 'ganancia', 'layout'],
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: Bell,
    keywords: ['notificaciones', 'alertas', 'email', 'frecuencia', 'canal', 'avisos'],
  },
  {
    id: 'account',
    label: 'Cuenta',
    icon: User,
    keywords: ['cuenta', 'perfil', 'nombre', 'email', 'contraseña', 'usuario'],
  },
  {
    id: 'security',
    label: 'Seguridad',
    icon: Shield,
    keywords: ['seguridad', '2fa', 'autenticación', 'dispositivos', 'sesiones', 'contraseña'],
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: Globe,
    keywords: ['idioma', 'zona horaria', 'fecha', 'moneda', 'regional', 'español', 'ingles'],
  },
]

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function SettingsDrawer() {
  const { settingsOpen, closeSettings } = useUiStore()
  const { hasUnsavedChanges, saveSettings, resetToDefaults } = useSettingsStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [activeCategory, setActiveCategory] = useState<CategoryId>('appearance')
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

  function handleSave() {
    saveSettings()
    useUiStore.getState().addToast('Configuración guardada', 'success')
  }

  function handleReset() {
    resetToDefaults()
    useUiStore.getState().addToast('Configuración restablecida', 'info')
  }

  const sectionContent: Record<CategoryId, React.ReactNode> = {
    appearance: <AppearanceSection />,
    dashboard: <DashboardSection />,
    notifications: <NotificationsSection />,
    account: <AccountSection />,
    security: <SecuritySection />,
    system: <SystemSection />,
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
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[560px] flex flex-col bg-[#F7F7F8] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-gray-100 shrink-0">
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900 leading-tight">Configuración</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Personalizá la app a tu gusto
                </p>
              </div>

              {/* Search */}
              <div className="relative w-48">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl bg-gray-100 border border-transparent pl-8 pr-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={closeSettings}
                className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none shrink-0"
                title="Cerrar"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0">
              {/* Left nav */}
              <nav className="w-44 shrink-0 border-r border-gray-100 bg-white py-3 flex flex-col gap-0.5 overflow-y-auto">
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
                        className={`flex items-center gap-2.5 mx-2 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                          isActive
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Icon size={15} strokeWidth={2} className="shrink-0" />
                        <span className="text-xs font-semibold leading-tight">{cat.label}</span>
                      </button>
                    )
                  })
                )}
              </nav>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
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
            <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-white border-t border-gray-100">
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
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
              >
                <RotateCcw size={12} />
                Restablecer
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 transition-colors shadow-sm"
              >
                <Save size={12} />
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
