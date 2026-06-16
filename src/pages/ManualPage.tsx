import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft,
  BookOpen,
  Users,
  CreditCard,
  TrendingDown,
  Dumbbell,
  Shield,
  Calendar,
  Info,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { ROUTES } from '../constants/routes'
import { permisosApi, type PermisoEntry } from '../api/permisos.api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SectionDef {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

type BadgeColor = 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'primary'
type InfoBoxType = 'info' | 'warning' | 'tip'
type PermValue = boolean | 'read'

// ── Constants ──────────────────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  { id: 'turnos',     label: 'Turnos',              icon: Calendar     },
  { id: 'clientes',   label: 'Clientes',             icon: Users        },
  { id: 'pagos',      label: 'Pagos y Membresías',   icon: CreditCard   },
  { id: 'gastos',     label: 'Gastos',               icon: TrendingDown },
  { id: 'biblioteca', label: 'Biblioteca y Rutinas', icon: Dumbbell     },
  { id: 'usuarios',   label: 'Usuarios y Roles',     icon: Shield       },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function ManualCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
      {children}
    </div>
  )
}

function SectionHeader({
  id,
  icon: Icon,
  label,
}: {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}) {
  return (
    <div className="flex items-center gap-3 px-8 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/15 border border-primary/20">
        <Icon size={20} className="text-primary" />
      </div>
      <h2 id={id} className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
        {label}
      </h2>
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
      {children}
    </h3>
  )
}

function Term({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-primary">{children}</span>
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      {children}
    </p>
  )
}

function ManualBadge({ children, color = 'gray' }: { children: React.ReactNode; color?: BadgeColor }) {
  const colors: Record<BadgeColor, string> = {
    green:   'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    amber:   'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    red:     'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    gray:    'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/50',
    blue:    'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    primary: 'bg-primary/10 dark:bg-primary/15 text-primary border-primary/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${colors[color]}`}>
      {children}
    </span>
  )
}

function InfoBox({ children, type = 'info' }: { children: React.ReactNode; type?: InfoBoxType }) {
  const config: Record<InfoBoxType, { icon: React.ComponentType<{ size?: number; className?: string }>; cls: string; iconCls: string }> = {
    info:    { icon: Info,         cls: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',       iconCls: 'text-blue-500 dark:text-blue-400'    },
    warning: { icon: AlertCircle,  cls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',   iconCls: 'text-amber-500 dark:text-amber-400'  },
    tip:     { icon: CheckCircle2, cls: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', iconCls: 'text-emerald-500 dark:text-emerald-400' },
  }
  const { icon: Icon, cls, iconCls } = config[type]
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${cls}`}>
      <Icon size={15} className={`shrink-0 mt-0.5 ${iconCls}`} />
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>
    </div>
  )
}

function PermCell({ v }: { v: PermValue }) {
  if (v === 'read') {
    return (
      <span title="Solo lectura" className="text-sm">
        <span className="inline-flex items-center justify-center">
          <CheckCircle2 size={15} className="text-blue-400" />
        </span>
      </span>
    )
  }
  if (v === true) {
    return <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
  }
  return <span className="text-gray-300 dark:text-gray-600 select-none">—</span>
}

// ── PermissionsMatrix ─────────────────────────────────────────────────────────

const MODULES_MATRIX = [
  {
    id: 'clients', name: 'Gestión de Clientes',
    actions: [
      { id: 'read',   name: 'Ver listado y perfiles' },
      { id: 'create', name: 'Crear nuevos clientes' },
      { id: 'update', name: 'Editar datos personales' },
      { id: 'delete', name: 'Eliminar clientes' },
    ],
  },
  {
    id: 'payments', name: 'Gestión de Pagos',
    actions: [
      { id: 'read',   name: 'Ver historial de cobros' },
      { id: 'create', name: 'Registrar nuevos cobros' },
      { id: 'update', name: 'Editar o anular pagos' },
    ],
  },
  {
    id: 'shifts', name: 'Turnos y Calendario',
    actions: [
      { id: 'read',   name: 'Ver calendario y grilla' },
      { id: 'create', name: 'Crear nuevos turnos' },
      { id: 'update', name: 'Editar turnos existentes' },
      { id: 'delete', name: 'Eliminar turnos' },
    ],
  },
  {
    id: 'attendance', name: 'Asistencia',
    actions: [
      { id: 'read', name: 'Ver registros de asistencia' },
      { id: 'mark', name: 'Tomar asistencia' },
    ],
  },
  {
    id: 'memberships', name: 'Membresías y Planes',
    actions: [
      { id: 'read',   name: 'Ver membresías y planes' },
      { id: 'create', name: 'Crear membresías' },
      { id: 'update', name: 'Editar membresías' },
      { id: 'delete', name: 'Eliminar membresías' },
    ],
  },
  {
    id: 'expenses', name: 'Gastos',
    actions: [
      { id: 'read',   name: 'Ver historial de gastos' },
      { id: 'create', name: 'Registrar nuevos gastos' },
      { id: 'update', name: 'Editar gastos' },
      { id: 'delete', name: 'Eliminar gastos' },
    ],
  },
  {
    id: 'dashboard', name: 'Dashboard y Métricas',
    actions: [
      { id: 'read', name: 'Ver métricas, KPIs y gráficos' },
    ],
  },
  {
    id: 'users', name: 'Usuarios y Profesores',
    actions: [
      { id: 'read',   name: 'Ver usuarios y profesores' },
      { id: 'create', name: 'Crear usuarios' },
      { id: 'update', name: 'Editar usuarios' },
      { id: 'delete', name: 'Eliminar usuarios' },
    ],
  },
  {
    id: 'rutinas', name: 'Rutinas',
    actions: [
      { id: 'read',   name: 'Ver rutinas' },
      { id: 'create', name: 'Crear rutinas' },
      { id: 'update', name: 'Editar rutinas' },
      { id: 'delete', name: 'Eliminar rutinas' },
    ],
  },
  {
    id: 'exercises', name: 'Biblioteca de Ejercicios',
    actions: [
      { id: 'read',   name: 'Ver catálogo y plantillas' },
      { id: 'create', name: 'Agregar ejercicios' },
      { id: 'update', name: 'Editar ejercicios' },
      { id: 'delete', name: 'Eliminar ejercicios' },
    ],
  },
  {
    id: 'plantillas', name: 'Plantillas de Rutinas',
    actions: [
      { id: 'read',   name: 'Ver plantillas' },
      { id: 'create', name: 'Crear plantillas' },
      { id: 'update', name: 'Editar plantillas' },
      { id: 'delete', name: 'Eliminar plantillas' },
    ],
  },
]

const MATRIX_ROLES = [
  { id: 'ADMINISTRADOR', name: 'Admin' },
  { id: 'STAFF',         name: 'Staff' },
  { id: 'PROFESOR',      name: 'Profesor' },
]

function PermissionsMatrix() {
  const [permisos, setPermisos] = useState<PermisoEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    permisosApi.getAll()
      .then(setPermisos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const map: Record<string, boolean> = {}
  for (const p of permisos) {
    map[`${p.rol}__${p.modulo}__${p.accion}`] = p.permitido
  }

  function cell(rol: string, modulo: string, accion: string): boolean {
    if (rol === 'ADMINISTRADOR') return true
    return map[`${rol}__${modulo}__${accion}`] ?? false
  }

  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-white/[0.05] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-100/60 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
            <th className="px-5 py-3.5 text-left text-xs font-black uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A] w-2/5">
              Módulo / Acción
            </th>
            {MATRIX_ROLES.map(r => (
              <th key={r.id} className="px-5 py-3.5 text-center text-xs font-black uppercase tracking-wider text-gray-400 dark:text-[#8A8A9A]">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100/40 dark:divide-white/[0.04]">
          {MODULES_MATRIX.map(mod => (
            <>
              {/* Header de módulo */}
              <tr key={`header-${mod.id}`}>
                <td
                  colSpan={MATRIX_ROLES.length + 1}
                  className="px-5 py-2.5 text-xs font-extrabold text-gray-900 dark:text-white bg-primary/[0.04] dark:bg-primary/[0.06] border-y border-primary/10"
                >
                  {mod.name}
                </td>
              </tr>
              {/* Filas de acciones */}
              {mod.actions.map(action => (
                <tr key={`${mod.id}-${action.id}`} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 pl-9 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {action.name}
                  </td>
                  {MATRIX_ROLES.map(role => (
                    <td key={role.id} className="px-5 py-3 text-center">
                      <PermCell v={cell(role.id, mod.id, action.id)} />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <CheckCircle2 size={13} className="text-emerald-500" />
          Permitido
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="text-gray-400 dark:text-gray-600">—</span>
          Sin permiso
        </div>
      </div>
    </div>
  )
}

// ── ManualContent — exportable, se usa en SettingsPage y en ManualPage ────────

export function ManualContent() {
  const [activeSection, setActiveSection] = useState('turnos')
  const [navOpen, setNavOpen] = useState(false)
  const observersRef = useRef<IntersectionObserver[]>([])

  useEffect(() => {
    observersRef.current.forEach(o => o.disconnect())
    observersRef.current = []
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(`section-${id}`)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { rootMargin: '-10% 0px -65% 0px', threshold: 0 },
      )
      obs.observe(el)
      observersRef.current.push(obs)
    })
    return () => observersRef.current.forEach(o => o.disconnect())
  }, [])

  function scrollTo(id: string) {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sidebar = (
    <motion.div
      className="hidden lg:block fixed left-4 xl:left-6 top-[32vh] z-30"
      initial={{ opacity: 0, x: 'calc(-100% + 12px)' }}
      animate={{ opacity: 1, x: navOpen ? 0 : 'calc(-100% + 12px)' }}
      exit={{ opacity: 0, x: 'calc(-100% + 12px)' }}
      transition={{
        opacity: { duration: 0.25, ease: 'easeOut' },
        x: { type: 'spring', stiffness: 340, damping: 32, mass: 0.8 },
      }}
    >
      <div className="relative w-32 xl:w-40 rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-black/50 backdrop-blur-2xl shadow-lg">
        <button
          type="button"
          onClick={() => setNavOpen(v => !v)}
          className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center rounded-r-2xl hover:bg-primary/10 transition-colors"
          title={navOpen ? 'Ocultar' : 'Mostrar navegación'}
        >
          <motion.div
            animate={{ rotate: navOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.8 }}
          >
            <ChevronRight size={11} className="text-gray-400 dark:text-[#6A6A7A]" />
          </motion.div>
        </button>
        <div className="p-4 pr-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#6A6A7A] mb-3 px-1">
            Secciones
          </p>
          <div className="space-y-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'text-primary bg-primary/10 dark:bg-primary/15'
                      : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon size={13} className="shrink-0 opacity-60" />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <>
      {createPortal(
        <AnimatePresence>{sidebar}</AnimatePresence>,
        document.body,
      )}

      <div className="space-y-6">

      {/* ── TURNOS ──────────────────────────────────────────────────────────── */}
      <section id="section-turnos">
        <ManualCard>
          <SectionHeader id="turnos" icon={Calendar} label="Turnos" />
          <div className="px-8 py-6 space-y-6">
            <Prose>
              Los turnos representan las clases del gimnasio. Cada turno tiene un horario fijo
              y se puede configurar para repetirse semanalmente.
            </Prose>

            <div className="space-y-2">
              <SubTitle>Sala A y Sala B</SubTitle>
              <Prose>
                Cada turno puede ocupar <Term>Sala A</Term>, <Term>Sala B</Term> o ambas, con cupos
                independientes. Si la Sala B no se usa en un turno, se configura con cupo{' '}
                <Term>0</Term> — esto indica que esa sala no aplica para ese horario.
              </Prose>
            </div>

            <div className="space-y-2">
              <SubTitle>Cupo y Lista de Espera</SubTitle>
              <Prose>
                Cuando un turno llega a su cupo máximo, los nuevos inscriptos entran
                automáticamente a la <Term>lista de espera</Term>. Si alguien se da de baja,
                el primero en la lista pasa a estar inscripto.
              </Prose>
            </div>

            <div className="space-y-3">
              <SubTitle>Días Especiales</SubTitle>
              <Prose>
                Desde el módulo de Turnos se pueden marcar días del calendario con
                comportamiento especial que afecta la asistencia de todos los turnos.
              </Prose>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 px-5 py-4 space-y-2">
                  <ManualBadge color="red">CIERRE TOTAL</ManualBadge>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    El gimnasio no abre ese día. La asistencia queda bloqueada para todos
                    los turnos y no se puede registrar presencia.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 px-5 py-4 space-y-2">
                  <ManualBadge color="amber">HORARIO REDUCIDO</ManualBadge>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    El gimnasio abre con horario diferente. Es obligatorio ingresar la hora
                    de apertura y cierre para poder guardar el registro.
                  </p>
                </div>
              </div>
            </div>

            <InfoBox type="info">
              Los turnos <strong>recurrentes</strong> se repiten cada semana automáticamente.
              Si un turno es puntual (ej: evento especial), desactivá la opción "Recurrente"
              al crearlo.
            </InfoBox>
          </div>
        </ManualCard>
      </section>

      {/* ── CLIENTES ────────────────────────────────────────────────────────── */}
      <section id="section-clientes">
        <ManualCard>
          <SectionHeader id="clientes" icon={Users} label="Clientes" />
          <div className="px-8 py-6 space-y-6">
            <Prose>
              Los clientes son los socios del gimnasio. Cada cliente tiene un perfil completo
              con historial de pagos, asistencia, membresías y rutinas asignadas.
            </Prose>

            <div className="space-y-3">
              <SubTitle>Estado de Actividad</SubTitle>
              <Prose>
                Indica si el cliente concurre actualmente al gimnasio. Solo el{' '}
                <Term>Administrador</Term> puede cambiar este estado desde el perfil del cliente.
              </Prose>
              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center gap-2.5">
                  <ManualBadge color="green">ACTIVO</ManualBadge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Asiste regularmente</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ManualBadge color="gray">INACTIVO</ManualBadge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Dejó de concurrir</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <SubTitle>Estado de Membresía</SubTitle>
              <Prose>
                Indica la situación de la membresía del cliente. Se calcula automáticamente
                a partir de las membresías registradas — no requiere actualización manual.
              </Prose>
              <div className="space-y-2 pt-1">
                {[
                  { badge: 'AL DÍA',       color: 'green' as BadgeColor, desc: 'Tiene una membresía activa y vigente.' },
                  { badge: 'POR VENCER',    color: 'amber' as BadgeColor, desc: 'La membresía vence en menos de 7 días.' },
                  { badge: 'EN DEUDA',      color: 'red'   as BadgeColor, desc: 'La membresía venció y no fue renovada.' },
                  { badge: 'SIN MEMBRESÍA', color: 'gray'  as BadgeColor, desc: 'No tiene ninguna membresía registrada.' },
                ].map(({ badge, color, desc }) => (
                  <div key={badge} className="flex items-center gap-3">
                    <ManualBadge color={color}>{badge}</ManualBadge>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SubTitle>Datos Personales</SubTitle>
              <Prose>
                Los campos obligatorios son nombre, apellido, email y teléfono.
                El <Term>CUIL</Term> es opcional y solo se muestra en la tabla si fue ingresado.
                La <Term>sede</Term> permite preparar el sistema para múltiples sucursales.
              </Prose>
            </div>

            <InfoBox type="tip">
              Un cliente puede ser <strong>INACTIVO + EN DEUDA</strong> al mismo tiempo. El estado
              de actividad (si viene al gimnasio) y el estado de membresía (si debe plata) son
              completamente independientes.
            </InfoBox>
          </div>
        </ManualCard>
      </section>

      {/* ── PAGOS Y MEMBRESÍAS ──────────────────────────────────────────────── */}
      <section id="section-pagos">
        <ManualCard>
          <SectionHeader id="pagos" icon={CreditCard} label="Pagos y Membresías" />
          <div className="px-8 py-6 space-y-6">
            <Prose>
              La plataforma <Term>registra</Term> los pagos recibidos. No procesa cobros
              online ni se conecta a pasarelas de pago (sin MercadoPago ni Stripe).
            </Prose>

            <div className="space-y-3">
              <SubTitle>Planes y Modalidades</SubTitle>
              <Prose>
                El <Term>Administrador</Term> define los planes disponibles (ej: Musculación,
                Natación). Cada plan tiene 4 modalidades con precios independientes:
              </Prose>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  'Efectivo mensual',
                  'Transferencia mensual',
                  '3 meses',
                  '6 meses',
                ].map(m => (
                  <div
                    key={m}
                    className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.04] px-3 py-3 text-center"
                  >
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{m}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SubTitle>Registrar un Pago</SubTitle>
              <Prose>
                Al registrar un pago se indica el cliente, monto, método de cobro (efectivo,
                transferencia, débito o empresa) y la fecha. Opcionalmente se puede marcar el
                toggle <Term>Facturado</Term> si el pago tiene comprobante fiscal.
                Cada pago tiene un <Term>ID único</Term> visible en su página de detalle.
              </Prose>
            </div>

            <div className="space-y-2">
              <SubTitle>Membresías</SubTitle>
              <Prose>
                Cada membresía vincula un cliente con un plan y una modalidad, registrando
                la fecha de inicio y vencimiento. Al renovar, se crea una nueva membresía
                manteniendo el historial de la anterior.
              </Prose>
            </div>

            <InfoBox type="warning">
              Los KPIs financieros (totales de ingresos, resumen del período) son visibles
              <strong> solo para el Administrador</strong>. El STAFF puede registrar pagos
              pero no ve los totales ni el dashboard financiero.
            </InfoBox>
          </div>
        </ManualCard>
      </section>

      {/* ── GASTOS ──────────────────────────────────────────────────────────── */}
      <section id="section-gastos">
        <ManualCard>
          <SectionHeader id="gastos" icon={TrendingDown} label="Gastos" />
          <div className="px-8 py-6 space-y-6">
            <Prose>
              El módulo de gastos es <Term>exclusivo del Administrador</Term>. Permite registrar
              y categorizar todos los egresos del gimnasio para tener visibilidad financiera real.
            </Prose>

            <div className="space-y-3">
              <SubTitle>Categorías</SubTitle>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { type: 'FIJO',     color: 'blue'  as BadgeColor, desc: 'Se repite todos los meses: alquiler, luz, internet, expensas.' },
                  { type: 'VARIABLE', color: 'amber' as BadgeColor, desc: 'Gastos puntuales: reparaciones, insumos, equipamiento nuevo.' },
                  { type: 'SUELDO',   color: 'green' as BadgeColor, desc: 'Pagos a empleados, profesores y personal de limpieza.' },
                ].map(({ type, color, desc }) => (
                  <div
                    key={type}
                    className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-5 py-4 space-y-2"
                  >
                    <ManualBadge color={color}>{type}</ManualBadge>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox type="info">
              El total de gastos en el Dashboard se calcula sumando las tres categorías:{' '}
              <strong>FIJO + VARIABLE + SUELDO</strong>. La ganancia neta es el ingreso total
              menos este total de gastos.
            </InfoBox>
          </div>
        </ManualCard>
      </section>

      {/* ── BIBLIOTECA Y RUTINAS ────────────────────────────────────────────── */}
      <section id="section-biblioteca">
        <ManualCard>
          <SectionHeader id="biblioteca" icon={Dumbbell} label="Biblioteca y Rutinas" />
          <div className="px-8 py-6 space-y-6">
            <Prose>
              La Biblioteca tiene dos secciones: el <Term>catálogo de ejercicios</Term> y las{' '}
              <Term>plantillas de rutinas</Term>. Los Profesores tienen acceso completo a este módulo.
            </Prose>

            <div className="space-y-3">
              <SubTitle>Catálogo de Ejercicios</SubTitle>
              <Prose>
                Base de datos de ejercicios con nombre, descripción, dificultad, grupo muscular
                y enlace a video. Al armar una rutina, se seleccionan ejercicios del catálogo.
                Los ejercicios se organizan por <Term>patrón de movimiento</Term>:
              </Prose>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Empuje horiz.', 'Empuje vert.', 'Tirón horiz.', 'Tirón vert.', 'Rodilla dom.', 'Cadera dom.', 'Core', 'Movilidad'].map(p => (
                  <ManualBadge key={p} color="gray">{p}</ManualBadge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SubTitle>Tipos de Plantillas</SubTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] px-5 py-5 space-y-2">
                  <p className="text-sm font-black text-gray-900 dark:text-white">Básica</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Define la <strong>estructura</strong>: distribución de días, bloques y cantidad
                    de ejercicios por bloque — sin especificar cuáles. El Profesor los completa
                    al asignar la rutina al cliente.
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/25 dark:border-primary/20 bg-primary/5 dark:bg-primary/[0.07] px-5 py-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-gray-900 dark:text-white">Especializada</p>
                    <ManualBadge color="primary">Esp.</ManualBadge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Incluye <strong>ejercicios reales</strong> del catálogo con series, repeticiones,
                    peso y RIR. Se puede asignar directamente o usar como punto de partida.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <SubTitle>Estructura de una Rutina</SubTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {['Semana', 'Día', 'Bloque', 'Ejercicio'].map((item, i, arr) => (
                  <span key={item} className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-white/60 dark:bg-white/[0.07] border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-800 dark:text-gray-200">
                      {item}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-gray-400 dark:text-gray-600 text-sm">→</span>
                    )}
                  </span>
                ))}
              </div>
              <Prose>
                Los días se pueden renombrar libremente (ej: "Lunes", "Empuje", "Pierna"). Se pueden
                agregar nuevas semanas a una rutina existente sin perder el historial —
                esto se llama <Term>mesociclo</Term>.
              </Prose>
            </div>

            <InfoBox type="tip">
              Al crear una rutina con el asistente (7 pasos), en el <strong>Paso 3</strong> podés
              elegir una plantilla base para pre-cargar toda la estructura automáticamente,
              ahorrando tiempo de configuración.
            </InfoBox>
          </div>
        </ManualCard>
      </section>

      {/* ── USUARIOS Y ROLES ────────────────────────────────────────────────── */}
      <section id="section-usuarios">
        <ManualCard>
          <SectionHeader id="usuarios" icon={Shield} label="Usuarios y Roles" />
          <div className="px-8 py-6 space-y-6">
            <Prose>
              El sistema tiene tres roles con diferentes niveles de acceso. Los permisos exactos
              son configurables por el Administrador desde <Term>Usuarios → Roles y Permisos</Term>.
            </Prose>

            <div className="space-y-3">
              <SubTitle>Descripción de Roles</SubTitle>
              <div className="space-y-2">
                {[
                  { role: 'ADMINISTRADOR',  color: 'primary' as BadgeColor, desc: 'Acceso total a todas las secciones: clientes, pagos, turnos, gastos, dashboard, usuarios y configuración.' },
                  { role: 'STAFF',          color: 'blue'    as BadgeColor, desc: 'Puede gestionar clientes, registrar pagos y administrar turnos. No tiene acceso a gastos, dashboard financiero ni creación de usuarios.' },
                  { role: 'PROFESOR',       color: 'green'   as BadgeColor, desc: 'Acceso exclusivo a la Biblioteca de ejercicios, creación de rutinas y vista del calendario de turnos.' },
                  { role: 'CLIENTE COMÚN',  color: 'amber'   as BadgeColor, desc: 'Cuenta kiosk compartida para que los socios consulten y registren su rutina de entrenamiento directamente desde una tablet o PC del gimnasio. No accede a ningún módulo de gestión.' },
                ].map(({ role, color, desc }) => (
                  <div key={role} className="flex items-start gap-3 py-3 border-b border-gray-100/50 dark:border-white/5 last:border-0">
                    <ManualBadge color={color}>{role}</ManualBadge>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SubTitle>Matriz de Accesos</SubTitle>
              <PermissionsMatrix />
            </div>

            <div className="space-y-3">
              <SubTitle>Modo Kiosk — Acceso a Rutinas</SubTitle>
              <Prose>
                La cuenta <Term>CLIENTE COMÚN</Term> es una cuenta única compartida que el
                Administrador configura para usarse en una tablet o computadora fija dentro del
                gimnasio. Cuando un socio quiere ver o registrar su entrenamiento, simplemente se
                acerca a esa pantalla — ya está logueada — y busca su nombre.
              </Prose>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/[0.05] px-5 py-5 space-y-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  Flujo de uso
                </p>
                <div className="space-y-3">
                  {[
                    { n: '1', label: 'Ingresar al kiosk', desc: 'La pantalla del gimnasio ya tiene la sesión de CLIENTE COMÚN iniciada. No hace falta que el socio ingrese ninguna contraseña.' },
                    { n: '2', label: 'Buscar el nombre', desc: 'El socio escribe su nombre o apellido en el buscador. La pantalla también sugiere automáticamente los clientes con turno activo en ese momento.' },
                    { n: '3', label: 'Ver la rutina', desc: 'Al seleccionar su nombre, aparece la rutina asignada por su Profesor: sesiones, bloques, ejercicios con series, repeticiones y peso.' },
                    { n: '4', label: 'Registrar la ejecución', desc: 'El socio puede marcar los ejercicios completados y cargar los valores reales (peso, repeticiones) para que queden registrados en su historial.' },
                  ].map(({ n, label, desc }) => (
                    <div key={n} className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 dark:bg-amber-500/25 text-[10px] font-black text-amber-700 dark:text-amber-400">
                        {n}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <InfoBox type="warning">
                Esta cuenta es una <strong>solución temporal</strong> mientras se desarrolla el
                Portal del Socio Mobile — una app individual donde cada cliente tendrá su propio
                acceso. Tratá la contraseña de CLIENTE COMÚN como si fuera un PIN de kiosk: no
                la compartás fuera del gimnasio.
              </InfoBox>
            </div>

            <div className="space-y-2">
              <SubTitle>Solicitudes de Acceso</SubTitle>
              <Prose>
                Desde la pantalla de inicio de sesión, cualquier persona puede completar el
                formulario de <Term>Solicitar Acceso</Term> eligiendo un rol. El Administrador
                aprueba o rechaza las solicitudes desde <Term>Usuarios → Solicitudes</Term>.
                Al aprobar, se crea el usuario automáticamente y se puede enviar una notificación
                por email (configurable en Configuración → Notificaciones).
              </Prose>
            </div>

            <InfoBox type="warning">
              Los cambios en los permisos de roles se aplican <strong>de inmediato</strong> para
              todos los usuarios activos, sin necesidad de que cierren sesión ni recarguen
              la página.
            </InfoBox>
          </div>
        </ManualCard>
      </section>

    </div>
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ManualPage() {
  const navigate = useNavigate()

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="w-full pb-24"
    >
      <div className="flex items-center gap-4 mb-8 mt-2">
        <button
          type="button"
          onClick={() => navigate(ROUTES.SETTINGS)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/40 dark:bg-white/[0.06] border border-white/50 dark:border-white/10 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.10] transition-all"
        >
          <ArrowLeft size={16} />
          Configuración
        </button>
      </div>

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <BookOpen size={22} className="text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white">
            Manual de usuario
          </h1>
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-[56px]">
          Guía completa de uso de la plataforma Eficiencia
        </p>
      </div>

      <ManualContent />
    </motion.div>
  )
}
