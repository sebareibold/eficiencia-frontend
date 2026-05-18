import { useState, useEffect, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette,
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
  LogOut,
  User,
  Lock,
  Bell,
  ShieldCheck,
} from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { configuracionApi } from '../api/configuracion.api'

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
                ? 'bg-white dark:bg-[#2A2B2A] shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-gray-900 dark:text-white scale-[1.02]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40'
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
  const [formData, setFormData] = useState({
    name: user?.name || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  })
  
  const initials = user
    ? `${formData.name.charAt(0)}${formData.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?'

  return (
    <div className="space-y-6">
      <SectionHeader title="Datos Personales" />
      <SectionCard>
        <div className="p-8 flex flex-col gap-8 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBC608]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center text-3xl font-extrabold text-white shrink-0 shadow-lg border-2 border-white/20 relative z-10">
              {initials}
            </div>
            <div>
              <button type="button" className="px-4 py-2 bg-white/80 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-xl border border-gray-200/50 dark:border-white/10 transition-all shadow-sm">
                Cambiar foto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nombre</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FBC608]/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Apellido</label>
              <input 
                type="text" 
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="w-full bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FBC608]/50 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Correo Electrónico</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
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
            <p className="text-xs text-gray-500 mt-1">Te enviaremos un correo para restablecer tu contraseña actual.</p>
          </div>
          <button type="button" className="shrink-0 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl transition-all">
            Solicitar cambio
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
              className={`flex items-center gap-5 px-8 py-6 ${
                i < mockDevices.length - 1 ? 'border-b border-gray-100 dark:border-white/10' : ''
              }`}
            >
              <div className="h-12 w-12 rounded-2xl bg-gray-100/80 dark:bg-white/10 flex items-center justify-center shrink-0 border border-gray-200/50 dark:border-white/5">
                <Icon size={20} className="text-gray-600 dark:text-gray-300" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{device.name}</p>
                <p className="text-xs text-gray-500 mt-1">{device.lastSeen}</p>
              </div>
              {device.current && (
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                  Activo
                </span>
              )}
            </div>
          )
        })}
      </SectionCard>

      <SectionHeader title="Acceso" />
      <SectionCard>
        <div className="px-8 py-6">
          <button
            type="button"
            onClick={() => setShowSessions(!showSessions)}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-4 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-sm"
          >
            <LogOut size={18} strokeWidth={2.5} />
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 leading-relaxed text-center px-4">
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
            className="appearance-none text-sm font-semibold rounded-2xl border border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-black/20 px-4 py-2.5 pr-8 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FBC608]/50 shadow-sm cursor-pointer"
            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
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

function RolesSection() {
  const [roles, setRoles] = useState([
    { id: 'admin', name: 'Administrador' },
    { id: 'profesor', name: 'Profesor' },
    { id: 'staff', name: 'Staff / Recepción' }
  ])

  const modules = [
    { 
      id: 'clients', 
      name: 'Gestión de Clientes', 
      actions: [
        { id: 'read', name: 'Ver listado de clientes' },
        { id: 'create', name: 'Crear nuevos clientes' },
        { id: 'update', name: 'Editar datos personales' },
        { id: 'delete', name: 'Eliminar clientes' },
      ]
    },
    { 
      id: 'payments', 
      name: 'Gestión de Pagos', 
      actions: [
        { id: 'read', name: 'Ver historial y reportes' },
        { id: 'create', name: 'Registrar nuevos cobros' },
        { id: 'update', name: 'Editar o anular pagos' },
      ]
    },
    { 
      id: 'classes', 
      name: 'Clases y Horarios', 
      actions: [
        { id: 'read', name: 'Ver calendario general' },
        { id: 'create', name: 'Crear nuevas clases' },
        { id: 'update', name: 'Tomar asistencia' },
        { id: 'delete', name: 'Cancelar clases' },
      ]
    },
    {
      id: 'dashboard',
      name: 'Dashboard y Métricas',
      actions: [
        { id: 'view_main', name: 'Ver Métricas Generales (Ingresos, Clientes)' },
        { id: 'view_financial_charts', name: 'Ver Gráficos Financieros' },
        { id: 'view_activity', name: 'Ver Actividad Reciente' },
      ]
    }
  ]

  const [permissions, setPermissions] = useState<Record<string, Record<string, Record<string, boolean>>>>({
    admin: {
      clients: { read: true, create: true, update: true, delete: true },
      payments: { read: true, create: true, update: true, delete: true },
      classes: { read: true, create: true, update: true, delete: true },
      dashboard: { view_main: true, view_financial_charts: true, view_activity: true },
    },
    profesor: {
      clients: { read: true, create: false, update: false, delete: false },
      payments: { read: false, create: false, update: false, delete: false },
      classes: { read: true, create: false, update: true, delete: false },
      dashboard: { view_main: false, view_financial_charts: false, view_activity: true },
    },
    staff: {
      clients: { read: true, create: true, update: true, delete: false },
      payments: { read: true, create: true, update: false, delete: false },
      classes: { read: true, create: false, update: true, delete: false },
      dashboard: { view_main: true, view_financial_charts: false, view_activity: true },
    }
  })

  const handleToggle = (roleId: string, modId: string, actionId: string, val: boolean) => {
    if (roleId === 'admin') return // Admin can't be modified visually here
    setPermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [modId]: {
          ...prev[roleId][modId],
          [actionId]: val
        }
      }
    }))
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Matriz de Permisos Detallada" />
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20">
                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-gray-500 w-1/3">Módulo y Permiso</th>
                {roles.map(r => (
                  <th key={r.id} className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-gray-500 text-center">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {modules.map((mod) => (
                <Fragment key={mod.id}>
                  {/* Module Header Row */}
                  <tr className="bg-gray-50/30 dark:bg-black/10">
                    <td colSpan={roles.length + 1} className="px-6 py-3 text-sm font-extrabold text-gray-900 dark:text-white bg-[#FBC608]/5 dark:bg-[#FBC608]/10 border-y border-[#FBC608]/10">
                      {mod.name}
                    </td>
                  </tr>
                  {/* Actions Rows */}
                  {mod.actions.map((action) => (
                    <tr key={`${mod.id}-${action.id}`} className="hover:bg-gray-50/50 dark:hover:bg-black/20 transition-colors">
                      <td className="px-6 py-4 pl-10 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        {action.name}
                      </td>
                      {roles.map(role => (
                        <td key={`${mod.id}-${action.id}-${role.id}`} className="px-6 py-4 text-center">
                          <Toggle 
                            checked={permissions[role.id]?.[mod.id]?.[action.id] ?? false} 
                            disabled={role.id === 'admin'} 
                            onChange={(val) => handleToggle(role.id, mod.id, action.id, val)} 
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId = 'appearance' | 'notifications' | 'account' | 'system'

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
  {
    id: 'system',
    label: 'Localización',
    icon: Globe,
    keywords: ['idioma', 'zona horaria', 'fecha', 'moneda', 'regional', 'español', 'ingles'],
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
    const { appearance } = useSettingsStore.getState()
    try {
      await configuracionApi.update({
        tema: appearance.theme,
        accentColor: appearance.accentColor,
        density: appearance.density,
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
    system: <SystemSection />,
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
      <div className="rounded-2xl border border-white/60 dark:border-white/[0.07] bg-white/50 dark:bg-black/20 backdrop-blur-xl p-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none">
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
                      ? 'text-white'
                      : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="settings-tab-active"
                      className="absolute inset-0 rounded-xl bg-gray-900 dark:bg-white/[0.14]"
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
