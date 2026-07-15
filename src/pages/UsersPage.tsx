import { useState, useEffect, Fragment, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Plus, Search, RefreshCw, Edit2, Trash2, UserCheck, UserX,
  ShieldCheck, Users, GraduationCap, Check, X as XIcon, ChevronRight,
  ClipboardList, CheckCircle2, Ban, Save, Lock,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usuariosApi, type AppUser, type UserRole } from '../api/usuarios.api'
import { permisosApi, type PermisoEntry } from '../api/permisos.api'
import { solicitudesApi, type SolicitudEntry } from '../api/solicitudes.api'
import { authApi } from '../api/auth.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { useSolicitudesStore } from '../store/solicitudesStore'
import { ROUTES } from '../constants/routes'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Skeleton from '../components/ui/Skeleton'

// ─── Tipos y constantes ───────────────────────────────────────────────────────

type Tab = 'usuarios' | 'profesores' | 'permisos' | 'solicitudes'

const DEV_EMAIL = 'sebastianreibold2003@gmail.com'

const ROL_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: 'Administrador',
  STAFF:         'Staff',
  PROFESOR:      'Profesor',
  CLIENTE_COMUN: 'Cliente',
}

const ROL_COLORS: Record<UserRole, string> = {
  ADMINISTRADOR: 'bg-primary/15 text-amber-700 dark:text-primary border border-primary/30',
  STAFF:         'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
  PROFESOR:      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  CLIENTE_COMUN: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20',
}

const SOLICITUD_ESTADO_BADGE: Record<string, string> = {
  PENDIENTE:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  APROBADO:   'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20',
  RECHAZADO:  'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
}

const SOLICITUD_ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

const ROL_DESC: Record<string, string> = {
  ADMINISTRADOR: 'Acceso completo al sistema',
  STAFF:         'Clientes, pagos y turnos',
  PROFESOR:      'Turnos, asistencia y rutinas',
  CLIENTE_COMUN: 'Cuenta común para ver rutinas',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const glassCard = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

function RolBadge({ rol, email }: { rol: UserRole; email?: string }) {
  const isDev = email === DEV_EMAIL
  const label = isDev ? 'Desarrollador' : ROL_LABELS[rol]
  const cls   = isDev
    ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20'
    : ROL_COLORS[rol]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  )
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return activo
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><Check size={10} />Activo</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-gray-200/60 dark:bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08]"><XIcon size={10} />Inactivo</span>
}

// ─── Tab: Usuarios ─────────────────────────────────────────────────────────────

function UsuariosTab() {
  const addToast    = useUiStore(s => s.addToast)
  const currentUser = useAuthStore(s => s.user)
  const navigate    = useNavigate()

  const [users, setUsers]               = useState<AppUser[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [rolFilter, setRolFilter]       = useState<UserRole | 'all'>('all')
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    usuariosApi.getAll()
      .then(setUsers)
      .catch(() => addToast('Error al cargar usuarios', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRol = rolFilter === 'all' || u.rol === rolFilter
    return matchSearch && matchRol
  })

  async function onDelete(user: AppUser) {
    setDeletingId(user.id)
    try {
      await usuariosApi.remove(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      addToast('Usuario eliminado', 'success')
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al eliminar', 'error')
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  const DEV_EMAIL = 'sebastianreibold2003@gmail.com'
  const countByRol = (rol: UserRole) =>
    users.filter(u => u.rol === rol && (rol !== 'ADMINISTRADOR' || u.email !== DEV_EMAIL)).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Administradores', count: countByRol('ADMINISTRADOR'), color: 'text-primary bg-primary/10' },
          { label: 'Staff',           count: countByRol('STAFF'),          color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
          { label: 'Profesores',      count: countByRol('PROFESOR'),       color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
          { label: 'Cliente común',   count: countByRol('CLIENTE_COMUN'),  color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
        ] as const).map(s => (
          <div key={s.label} className={`${glassCard} p-4 flex items-center gap-3`}>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${s.color.split(' ').slice(1).join(' ')}`}>
              <Users size={16} className={s.color.split(' ')[0]} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">{s.count}</p>
              <p className="text-xs text-[#8A8A9A] mt-0.5 leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm py-2 pl-9 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-gray-300 dark:focus:border-white/20 focus:outline-none transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          {/* Mobile select */}
          <select
            value={rolFilter}
            onChange={e => setRolFilter(e.target.value as UserRole | 'all')}
            className="sm:hidden rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none h-9 cursor-pointer"
          >
            <option value="all">Todos</option>
            {(['ADMINISTRADOR', 'STAFF', 'PROFESOR'] as const).map(r => (
              <option key={r} value={r}>{ROL_LABELS[r]}</option>
            ))}
          </select>
          {/* Desktop pills */}
          <div className="hidden sm:flex gap-1 rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm p-1">
            {(['all', 'ADMINISTRADOR', 'STAFF', 'PROFESOR'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRolFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${rolFilter === r ? 'bg-gray-900 dark:bg-white/[0.12] text-white' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-white'}`}
              >
                {r === 'all' ? 'Todos' : ROL_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => navigate(ROUTES.USER_NEW)}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2 text-sm"
            >
              <Plus size={14} strokeWidth={2.5} /> Nuevo usuario
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile card grid ── */}
      {!loading && filtered.length > 0 && (
        <div className="sm:hidden grid grid-cols-1 gap-3">
          {filtered.map(u => (
            <div key={u.id} className={`${glassCard} p-4 flex flex-col gap-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center text-sm font-black text-gray-700 dark:text-gray-300 shrink-0">
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{u.nombre}</p>
                    <p className="text-xs text-[#8A8A9A] truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => navigate(ROUTES.USER_DETAIL.replace(':id', u.id))} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white transition-all">
                    <Edit2 size={14} />
                  </button>
                  {u.id !== currentUser?.id && u.rol !== 'ADMINISTRADOR' && (
                    <button onClick={() => setDeleteTarget(u)} disabled={deletingId === u.id} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RolBadge rol={u.rol} email={u.email} />
                <EstadoBadge activo={u.activo} />
                {u.profesor && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <UserCheck size={12} /> Profesor vinculado
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop table ── */}
      <div className={`${glassCard} overflow-hidden hidden sm:block`}>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#8A8A9A]">No se encontraron usuarios</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100/60 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
                <tr>
                  {['Usuario', 'Email', 'Rol', 'Estado', 'Profesor', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center text-xs font-black text-gray-700 dark:text-gray-300 shrink-0">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">{u.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#8A8A9A] text-sm">{u.email}</td>
                    <td className="px-5 py-3.5"><RolBadge rol={u.rol} email={u.email} /></td>
                    <td className="px-5 py-3.5"><EstadoBadge activo={u.activo} /></td>
                    <td className="px-5 py-3.5">
                      {u.profesor
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><UserCheck size={13} /> Vinculado</span>
                        : <span className="text-xs text-[#8A8A9A]">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(ROUTES.USER_DETAIL.replace(':id', u.id))}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.id !== currentUser?.id && u.rol !== 'ADMINISTRADOR' && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            disabled={deletingId === u.id}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Empty state mobile */}
      {!loading && filtered.length === 0 && (
        <div className="sm:hidden py-12 text-center text-sm text-[#8A8A9A]">No se encontraron usuarios</div>
      )}
      {loading && (
        <div className="sm:hidden p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar usuario"
        message={`¿Eliminar a ${deleteTarget?.nombre ?? 'este usuario'}? Esta acción no se puede deshacer.`}
        warning={deleteTarget?.profesor
          ? `Este usuario tiene un perfil de profesor vinculado${deleteTarget.profesor.especialidad ? ` (${deleteTarget.profesor.especialidad})` : ''}. Si tiene turnos o rutinas asignadas, la eliminación será bloqueada hasta que los reasignes.`
          : undefined}
        confirmLabel="Eliminar"
        isLoading={deletingId !== null}
        onConfirm={() => deleteTarget && onDelete(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ─── Tab: Profesores ───────────────────────────────────────────────────────────

const espSchema = z.object({ especialidad: z.string().optional() })
type EspValues  = z.infer<typeof espSchema>

const COL = 'grid-cols-[2fr_2fr_1.5fr_100px_80px_48px]'

function ProfesoresTab() {
  const addToast = useUiStore(s => s.addToast)
  const navigate = useNavigate()
  const [users, setUsers]       = useState<AppUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [turnoCounts, setTurnoCounts] = useState<Record<string, number>>({})
  const [linking, setLinking]   = useState<string | null>(null)
  const [linkTarget, setLinkTarget] = useState<AppUser | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<AppUser | null>(null)

  const { register, handleSubmit, reset } = useForm<EspValues>({ resolver: zodResolver(espSchema) })

  const load = useCallback(() => {
    setLoading(true)
    usuariosApi.getAll()
      .then(async data => {
        const profs = data.filter(u => u.rol === 'PROFESOR')
        setUsers(profs)
        // Turno counts en paralelo para todos los vinculados
        const vinculados = profs.filter(u => u.profesor)
        const results = await Promise.allSettled(
          vinculados.map(u => usuariosApi.getProfesorDetalle(u.id))
        )
        const counts: Record<string, number> = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.profesor) {
            const p = r.value.profesor
            const ids = new Set([...p.turnosSalaA.map((t: any) => t.id), ...p.turnosSalaB.map((t: any) => t.id)])
            counts[vinculados[i].id] = ids.size
          }
        })
        setTurnoCounts(counts)
      })
      .catch(() => addToast('Error al cargar profesores', 'error'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function onLink(data: EspValues) {
    if (!linkTarget) return
    setLinking(linkTarget.id)
    try {
      const updated = await usuariosApi.linkProfesor(linkTarget.id, data.especialidad)
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      addToast('Perfil de profesor vinculado', 'success')
      setLinkTarget(null)
      reset()
      load()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al vincular', 'error')
    } finally {
      setLinking(null)
    }
  }

  async function onUnlink(u: AppUser) {
    setLinking(u.id)
    try {
      await usuariosApi.unlinkProfesor(u.id)
      addToast('Perfil de profesor desvinculado', 'success')
      load()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al desvincular', 'error')
    } finally {
      setLinking(null)
    }
  }

  const vinculados   = users.filter(u => u.profesor)
  const noVinculados = users.filter(u => !u.profesor)

  return (
    <div className="space-y-5">

      {/* ── Tabla principal ── */}
      <div className={`${glassCard} overflow-hidden`}>
        {/* Encabezado tabla */}
        <div className={`hidden md:grid ${COL} gap-4 px-5 py-3 border-b border-white/20 dark:border-white/[0.06]`}>
          {['Profesor', 'Mail', 'Especialidad', 'Estado', 'Turnos', ''].map(h => (
            <span key={h} className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : vinculados.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#8A8A9A]">Sin profesores vinculados</div>
        ) : (
          <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
            {vinculados.map(u => {
              const activo = u.profesor?.activo !== false
              const count  = turnoCounts[u.id]
              return (
                <div
                  key={u.id}
                  className={`grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_100px_80px_48px] gap-3 md:gap-4 items-center px-5 py-4 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors ${!activo ? 'opacity-60' : ''}`}
                  onClick={() => navigate(ROUTES.PROFESOR_DETAIL.replace(':id', u.id))}
                >
                  {/* Profesor */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${activo ? 'bg-emerald-500/10' : 'bg-white/[0.05]'}`}>
                      <GraduationCap size={16} className={activo ? 'text-emerald-500' : 'text-gray-400'} />
                    </div>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{u.nombre}</span>
                  </div>
                  {/* Mail */}
                  <span className="text-sm text-[#8A8A9A] truncate hidden md:block">{u.email}</span>
                  {/* Especialidad */}
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate hidden md:block">
                    {u.profesor?.especialidad || <span className="text-[#8A8A9A] italic">—</span>}
                  </span>
                  {/* Estado */}
                  <div className="hidden md:flex">
                    {activo
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><Check size={9} />Activo</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 border border-red-500/20"><XIcon size={9} />Inactivo</span>}
                  </div>
                  {/* Turnos */}
                  <div className="hidden md:flex">
                    {count !== undefined
                      ? <span className="inline-flex items-center rounded-xl bg-white/40 dark:bg-white/[0.06] border border-white/30 dark:border-white/[0.08] px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-300">{count}</span>
                      : <span className="text-xs text-[#8A8A9A]">—</span>}
                  </div>
                  {/* Arrow */}
                  <div className="hidden md:flex justify-end">
                    <ChevronRight size={15} className="text-gray-400" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Sin perfil vinculado ── */}
      {noVinculados.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#8A8A9A]">
            Sin perfil vinculado ({noVinculados.length})
          </h3>
          <div className={`${glassCard} overflow-hidden`}>
            <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
              {noVinculados.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <GraduationCap size={16} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{u.nombre}</p>
                    <p className="text-xs text-[#8A8A9A] truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => { setLinkTarget(u); reset({ especialidad: '' }) }}
                    disabled={linking === u.id}
                    className="flex items-center gap-1.5 rounded-xl btn-action px-3 py-2 text-xs shrink-0"
                  >
                    <UserCheck size={13} /> Vincular
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={!!linkTarget} onClose={() => { setLinkTarget(null); reset() }} title="Vincular como profesor" size="sm">
        <form onSubmit={handleSubmit(onLink)} className="space-y-4">
          <p className="text-sm text-[#8A8A9A]">
            Vinculando a <strong className="text-gray-900 dark:text-white">{linkTarget?.nombre}</strong> como profesor activo del sistema.
          </p>
          <Input label="Especialidad (opcional)" placeholder="Ej. Crossfit, Yoga, Funcional" {...register('especialidad')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => { setLinkTarget(null); reset() }}>Cancelar</Button>
            <Button type="submit" isLoading={!!linking}>Vincular</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!unlinkTarget}
        title="Desvincular profesor"
        message={`¿Desvincular el perfil de profesor de ${unlinkTarget?.nombre ?? 'este usuario'}? Los turnos asignados quedarán sin profesor.`}
        confirmLabel="Desvincular"
        isLoading={linking === unlinkTarget?.id}
        onConfirm={() => { if (unlinkTarget) { onUnlink(unlinkTarget); setUnlinkTarget(null) } }}
        onClose={() => setUnlinkTarget(null)}
      />
    </div>
  )
}

// ─── Tab: Roles y Permisos (conectado a BD) ────────────────────────────────────

const ROLES_MATRIX = [
  { id: 'ADMINISTRADOR', name: 'Administrador' },
  { id: 'STAFF',         name: 'Staff' },
  { id: 'PROFESOR',      name: 'Profesor' },
]

const MODULES_MATRIX = [
  {
    id: 'clients', name: 'Gestión de Clientes',
    actions: [
      { id: 'read',             name: 'Ver listado y perfiles' },
      { id: 'create',           name: 'Crear nuevos clientes' },
      { id: 'update',           name: 'Editar datos personales' },
      { id: 'delete',           name: 'Eliminar clientes' },
      { id: 'view_pagos',       name: 'Ver pagos en perfil del cliente' },
      { id: 'view_membresias',  name: 'Ver membresías en perfil del cliente' },
      { id: 'view_rutinas',     name: 'Gestionar rutinas del cliente' },
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
    dependsOn: { modulo: 'clients', accion: 'view_rutinas' },
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

function PermisosTab() {
  const addToast = useUiStore(s => s.addToast)
  const [savedPermisos, setSavedPermisos] = useState<PermisoEntry[]>([])
  const [localPermisos, setLocalPermisos] = useState<PermisoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    permisosApi.getAll()
      .then(data => {
        setSavedPermisos(data)
        setLocalPermisos(data)
      })
      .catch(() => addToast('Error al cargar permisos', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Lookup basado en el estado local (para el renderizado de toggles)
  const localMap: Record<string, PermisoEntry> = {}
  for (const p of localPermisos) {
    localMap[`${p.rol}__${p.modulo}__${p.accion}`] = p
  }

  // Entradas que cambiaron respecto al estado guardado en BD
  const pendingChanges = localPermisos.filter(lp => {
    const saved = savedPermisos.find(sp => sp.id === lp.id)
    return saved && saved.permitido !== lp.permitido
  })
  const isDirty = pendingChanges.length > 0

  // Toggle solo actualiza el estado local — NO llama a la API
  function toggle(rol: string, modulo: string, accion: string) {
    if (rol === 'ADMINISTRADOR') return
    const permiso = localMap[`${rol}__${modulo}__${accion}`]
    if (!permiso) return
    setLocalPermisos(prev =>
      prev.map(p => p.id === permiso.id ? { ...p, permitido: !p.permitido } : p)
    )
  }

  function descartar() {
    setLocalPermisos([...savedPermisos])
  }

  async function guardarCambios() {
    if (pendingChanges.length === 0) return
    setIsSaving(true)
    try {
      await Promise.all(pendingChanges.map(p => permisosApi.update(p.id, p.permitido)))
      setSavedPermisos([...localPermisos])
      addToast(`${pendingChanges.length} permiso${pendingChanges.length !== 1 ? 's' : ''} guardado${pendingChanges.length !== 1 ? 's' : ''} correctamente`, 'success')
    } catch {
      addToast('Error al guardar permisos', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={load}
          disabled={isDirty}
          title={isDirty ? 'Guardá o descartá los cambios antes de recargar' : 'Recargar desde la base de datos'}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabla de permisos */}
      <div className={`${glassCard} overflow-hidden`}>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100/60 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#8A8A9A] w-2/5">
                    Módulo / Permiso
                  </th>
                  {ROLES_MATRIX.map(r => (
                    <th key={r.id} className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/40 dark:divide-white/[0.04]">
                {MODULES_MATRIX.map(mod => (
                  <Fragment key={mod.id}>
                    <tr>
                      <td className="px-6 py-2.5 text-xs font-extrabold text-gray-900 dark:text-white bg-primary/[0.04] dark:bg-primary/[0.06] border-y border-primary/10">
                        {mod.name}
                      </td>
                      {ROLES_MATRIX.map(role => {
                        const isAdmin = role.id === 'ADMINISTRADOR'
                        const isLocked = !isAdmin && mod.dependsOn
                          ? !localMap[`${role.id}__${mod.dependsOn.modulo}__${mod.dependsOn.accion}`]?.permitido
                          : false
                        return (
                          <td key={role.id} className="px-6 py-2.5 text-center bg-primary/[0.04] dark:bg-primary/[0.06] border-y border-primary/10">
                            {isLocked && (
                              <div
                                className="inline-flex items-center gap-1 text-[9px] text-gray-400 dark:text-gray-500 font-semibold"
                                title="Activá 'Gestionar rutinas del cliente' en Gestión de Clientes"
                              >
                                <Lock size={9} />
                                <span>Sin acceso previo</span>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {mod.actions.map(action => (
                      <tr key={`${mod.id}-${action.id}`} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-3.5 pl-10 text-sm font-medium text-gray-600 dark:text-gray-300">
                          {action.name}
                        </td>
                        {ROLES_MATRIX.map(role => {
                          const key = `${role.id}__${mod.id}__${action.id}`
                          const permiso = localMap[key]
                          const checked = permiso?.permitido ?? false
                          const isAdmin = role.id === 'ADMINISTRADOR'
                          const isLocked = !isAdmin && mod.dependsOn
                            ? !localMap[`${role.id}__${mod.dependsOn.modulo}__${mod.dependsOn.accion}`]?.permitido
                            : false
                          const savedPermiso = savedPermisos.find(sp => sp.id === permiso?.id)
                          const isChanged = savedPermiso && savedPermiso.permitido !== checked
                          return (
                            <td
                              key={role.id}
                              className={`px-6 py-3.5 text-center transition-opacity ${isLocked ? 'opacity-30' : ''}`}
                              title={isLocked ? 'Activá "Gestionar rutinas del cliente" en Gestión de Clientes para editar este permiso' : undefined}
                            >
                              <div className={`inline-flex flex-col items-center gap-1 ${isLocked ? 'pointer-events-none' : ''}`}>
                                <button
                                  type="button"
                                  disabled={isAdmin || isLocked}
                                  onClick={() => toggle(role.id, mod.id, action.id)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 ${
                                    checked ? 'bg-primary shadow-[0_0_8px_rgb(var(--color-primary)/0.4)]' : 'bg-gray-200 dark:bg-gray-700/50'
                                  } ${isAdmin || isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-105'}`}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                                </button>
                                {isChanged && (
                                  <span className="text-[9px] font-bold text-amber-500 leading-none">sin guardar</span>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barra de acciones — solo visible cuando hay cambios pendientes */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl px-5 py-3.5 shadow-lg"
          >
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              <span className="font-black">{pendingChanges.length}</span> cambio{pendingChanges.length !== 1 ? 's' : ''} sin guardar
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={descartar}
                disabled={isSaving}
                className="rounded-xl border border-amber-500/30 bg-white/60 dark:bg-black/30 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-white dark:hover:bg-black/50 transition-all disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={guardarCambios}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-gray-900 hover:bg-primary-dark transition-all disabled:opacity-60 shadow-sm"
              >
                {isSaving
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
                  : <Save size={14} />
                }
                Guardar cambios
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Tipos unificados de solicitud ────────────────────────────────────────────

type ResetRequest = {
  id: string
  usuario: { nombre: string; email: string }
  createdAt: string
  estado: string
  expiresAt: string
  used: boolean
  aprobadaAt: string | null
  completadaAt: string | null
}

type UnifiedItem =
  | { tipo: 'acceso'; data: SolicitudEntry }
  | { tipo: 'reset';  data: ResetRequest }

// ─── Unified Solicitud Card ────────────────────────────────────────────────────

interface UnifiedCardProps {
  item: UnifiedItem
  actioningId: string | null
  onAprobar:  (id: string) => void
  onRechazar: (id: string) => void
  onEliminar: (id: string) => void
}

function UnifiedSolicitudCard({ item, actioningId, onAprobar, onRechazar, onEliminar }: UnifiedCardProps) {
  const isReset   = item.tipo === 'reset'
  const id        = item.data.id
  const nombre    = isReset ? (item.data as ResetRequest).usuario.nombre : (item.data as SolicitudEntry).nombre
  const email     = isReset ? (item.data as ResetRequest).usuario.email  : (item.data as SolicitudEntry).email
  const createdAt = item.data.createdAt
  const estado    = isReset ? (item.data as ResetRequest).estado : (item.data as SolicitudEntry).estado
  const isPending = estado === 'PENDIENTE'
  const isActioning = actioningId === id

  const strip = isPending
    ? 'bg-amber-400'
    : estado === 'APROBADO' ? 'bg-emerald-500' : 'bg-red-500'

  const avatarCls = isPending
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400'

  return (
    <div className={`flex flex-col rounded-2xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)] overflow-hidden transition-opacity ${!isPending ? 'opacity-65 hover:opacity-100' : ''}`}>

      {/* Tira de color superior */}
      <div className={`h-1.5 w-full ${strip}`} />

      {/* Cuerpo */}
      <div className="flex-1 p-5 space-y-3.5">

        {/* Avatar + nombre + badge estado (procesadas) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${avatarCls}`}>
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate">{nombre}</p>
              <p className="text-xs text-[#8A8A9A] mt-0.5 truncate">{email}</p>
            </div>
          </div>
          {!isPending && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0 ${SOLICITUD_ESTADO_BADGE[estado]}`}>
              {SOLICITUD_ESTADO_LABEL[estado]}
            </span>
          )}
        </div>

        {/* Separador punteado */}
        <div className="border-t border-dashed border-white/40 dark:border-white/[0.08]" />

        {/* Datos */}
        <div className="space-y-2">

          {/* Tag de tipo — siempre visible */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8A8A9A] w-16 shrink-0">Tipo</span>
            {isReset ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                <Lock size={9} /> Cambio de contraseña
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20">
                <UserCheck size={9} /> Nueva cuenta
              </span>
            )}
          </div>

          {/* Rol — solo para solicitudes de acceso */}
          {!isReset && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8A8A9A] w-16 shrink-0">Rol</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROL_COLORS[(item.data as SolicitudEntry).rolSolicitado] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROL_LABELS[(item.data as SolicitudEntry).rolSolicitado] ?? (item.data as SolicitudEntry).rolSolicitado}
              </span>
            </div>
          )}

          {/* Fecha de solicitud */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8A8A9A] w-16 shrink-0">Solicitada</span>
            <span className="text-[11px] text-gray-600 dark:text-gray-400">
              {format(new Date(createdAt), "d MMM yyyy · HH:mm", { locale: es })}
            </span>
          </div>

          {/* Campos específicos de reset — aprobación y estado del cambio */}
          {isReset && (() => {
            const r = item.data as ResetRequest
            const aprobadaAt  = r.aprobadaAt  ? new Date(r.aprobadaAt)  : null
            const completadaAt = r.completadaAt ? new Date(r.completadaAt) : null
            const expirado = !r.used && r.estado === 'APROBADO' && new Date(r.expiresAt) < new Date()

            return (<>
              {aprobadaAt && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#8A8A9A] w-16 shrink-0">Aprobada</span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400">
                    {format(aprobadaAt, "d MMM yyyy · HH:mm", { locale: es })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8A8A9A] w-16 shrink-0">Cambio</span>
                {completadaAt ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={10} /> {format(completadaAt, "d MMM yyyy · HH:mm", { locale: es })}
                  </span>
                ) : expirado ? (
                  <span className="text-[11px] font-bold text-orange-500 dark:text-orange-400">Link vencido sin usar</span>
                ) : r.estado === 'APROBADO' ? (
                  <span className="text-[11px] text-gray-400 italic">Link enviado, esperando...</span>
                ) : r.estado === 'RECHAZADO' ? (
                  <span className="text-[11px] font-bold text-red-500 dark:text-red-400">No realizado</span>
                ) : (
                  <span className="text-[11px] text-gray-400 italic">Pendiente de aprobación</span>
                )}
              </div>
            </>)
          })()}

          {/* Fecha revisada — solo acceso */}
          {!isReset && (item.data as SolicitudEntry).revisadaAt && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8A8A9A] w-16 shrink-0">Revisada</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-500">
                {format(new Date((item.data as SolicitudEntry).revisadaAt!), "d MMM yyyy", { locale: es })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pie — acciones */}
      <div className="border-t border-white/40 dark:border-white/[0.06] px-4 py-3 bg-white/20 dark:bg-white/[0.02]">
        {isPending ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAprobar(id)}
              disabled={isActioning}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isActioning
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
                : <CheckCircle2 size={13} />}
              Aprobar
            </button>
            <button
              onClick={() => onRechazar(id)}
              disabled={isActioning}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              <Ban size={13} /> Rechazar
            </button>
            {/* Solo las solicitudes de acceso se pueden eliminar */}
            {!isReset && (
              <button
                onClick={() => onEliminar(id)}
                disabled={isActioning}
                title="Eliminar"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => onEliminar(id)}
              disabled={isActioning}
              title="Eliminar"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Solicitudes (acceso + reset unificadas) ─────────────────────────────

function SolicitudesTab() {
  const addToast        = useUiStore(s => s.addToast)
  const setPendingCount = useSolicitudesStore(s => s.setPendingCount)

  const [solicitudes, setSolicitudes] = useState<SolicitudEntry[]>([])
  const [resets, setResets]           = useState<ResetRequest[]>([])
  const [loading, setLoading]         = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [rechazarTarget, setRechazarTarget] = useState<{ id: string; tipo: 'acceso' | 'reset' } | null>(null)
  const [eliminarTarget, setEliminarTarget] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      solicitudesApi.getAll().catch(() => [] as SolicitudEntry[]),
      authApi.getResetRequests().catch(() => [] as ResetRequest[]),
    ]).then(([sols, rsts]) => {
      const filtered = sols.filter(s => s.email !== 'sebastianreibold2003@gmail.com')
      setSolicitudes(filtered)
      setResets(rsts)
      setPendingCount(
        filtered.filter(s => s.estado === 'PENDIENTE').length +
        rsts.filter(r => r.estado === 'PENDIENTE').length
      )
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── Acciones solicitudes de acceso ──
  async function aprobarAcceso(id: string) {
    setActioningId(id)
    try {
      await solicitudesApi.aprobar(id)
      addToast('Solicitud aprobada — usuario creado correctamente', 'success')
      load()
    } catch (err: unknown) {
      addToast((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al aprobar', 'error')
    } finally { setActioningId(null) }
  }

  async function rechazarAcceso(id: string) {
    setActioningId(id)
    try {
      await solicitudesApi.rechazar(id)
      addToast('Solicitud rechazada', 'success')
      load()
    } catch { addToast('Error al rechazar', 'error') }
    finally { setActioningId(null) }
  }

  async function eliminarAcceso(id: string) {
    setActioningId(id)
    try {
      await solicitudesApi.remove(id)
      addToast('Solicitud eliminada', 'success')
      setSolicitudes(prev => {
        const next = prev.filter(s => s.id !== id)
        setPendingCount(next.filter(s => s.estado === 'PENDIENTE').length + resets.length)
        return next
      })
    } catch { addToast('Error al eliminar', 'error') }
    finally { setActioningId(null) }
  }

  // ── Acciones reset de contraseña ──
  async function aprobarReset(id: string) {
    setActioningId(id)
    try {
      await authApi.aprobarReset(id)
      addToast('Aprobado — link de recuperación enviado al usuario', 'success')
      setResets(prev => {
        const next = prev.map(r => r.id === id ? { ...r, estado: 'APROBADO' } : r)
        setPendingCount(solicitudes.filter(s => s.estado === 'PENDIENTE').length + next.filter(r => r.estado === 'PENDIENTE').length)
        return next
      })
    } catch (err: unknown) {
      addToast((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al aprobar', 'error')
    } finally { setActioningId(null) }
  }

  async function rechazarReset(id: string) {
    setActioningId(id)
    try {
      await authApi.rechazarReset(id)
      addToast('Solicitud rechazada', 'success')
      setResets(prev => {
        const next = prev.map(r => r.id === id ? { ...r, estado: 'RECHAZADO' } : r)
        setPendingCount(solicitudes.filter(s => s.estado === 'PENDIENTE').length + next.filter(r => r.estado === 'PENDIENTE').length)
        return next
      })
    } catch { addToast('Error al rechazar', 'error') }
    finally { setActioningId(null) }
  }

  // ── Dispatch por tipo ──
  function handleAprobar(id: string, tipo: 'acceso' | 'reset') {
    if (tipo === 'acceso') aprobarAcceso(id)
    else aprobarReset(id)
  }

  function handleRechazar(id: string, tipo: 'acceso' | 'reset') {
    setRechazarTarget({ id, tipo })
  }

  function confirmarRechazar() {
    if (!rechazarTarget) return
    if (rechazarTarget.tipo === 'acceso') rechazarAcceso(rechazarTarget.id)
    else rechazarReset(rechazarTarget.id)
    setRechazarTarget(null)
  }

  // ── Lista unificada ordenada por fecha (más reciente primero) ──
  const allItems: UnifiedItem[] = [
    ...solicitudes.map(s => ({ tipo: 'acceso' as const, data: s })),
    ...resets.map(r    => ({ tipo: 'reset'  as const, data: r })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime())

  const pendientes = allItems.filter(i => {
    const estado = i.tipo === 'reset'
      ? (i.data as ResetRequest).estado
      : (i.data as SolicitudEntry).estado
    return estado === 'PENDIENTE'
  })
  const procesadas = allItems.filter(i => {
    const estado = i.tipo === 'reset'
      ? (i.data as ResetRequest).estado
      : (i.data as SolicitudEntry).estado
    return estado !== 'PENDIENTE'
  })

  const totalPendientes = pendientes.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {totalPendientes === 0 ? 'Sin solicitudes pendientes' : `${totalPendientes} solicitud${totalPendientes !== 1 ? 'es' : ''} pendiente${totalPendientes !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-[#8A8A9A] mt-0.5">Revisá y aprobá o rechazá cada solicitud</p>
        </div>
        <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : allItems.length === 0 ? (
        <div className={`${glassCard} py-16 text-center`}>
          <ClipboardList size={28} className="mx-auto mb-3 text-[#8A8A9A] opacity-50" />
          <p className="text-sm text-[#8A8A9A]">No hay solicitudes registradas</p>
        </div>
      ) : (<>
        {pendientes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">Pendientes de revisión</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendientes.map(item => (
                <UnifiedSolicitudCard
                  key={`${item.tipo}-${item.data.id}`}
                  item={item}
                  actioningId={actioningId}
                  onAprobar={(id) => handleAprobar(id, item.tipo)}
                  onRechazar={(id) => handleRechazar(id, item.tipo)}
                  onEliminar={(id) => setEliminarTarget(id)}
                />
              ))}
            </div>
          </div>
        )}

        {procesadas.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">Historial</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {procesadas.map(item => (
                <UnifiedSolicitudCard
                  key={`${item.tipo}-${item.data.id}`}
                  item={item}
                  actioningId={actioningId}
                  onAprobar={(id) => handleAprobar(id, item.tipo)}
                  onRechazar={(id) => handleRechazar(id, item.tipo)}
                  onEliminar={(id) => setEliminarTarget(id)}
                />
              ))}
            </div>
          </div>
        )}
      </>)}

      <ConfirmDialog
        isOpen={rechazarTarget !== null}
        title="Rechazar solicitud"
        message="La solicitud quedará marcada como rechazada."
        confirmLabel="Rechazar"
        isLoading={actioningId !== null}
        onConfirm={confirmarRechazar}
        onClose={() => setRechazarTarget(null)}
      />
      <ConfirmDialog
        isOpen={eliminarTarget !== null}
        title="Eliminar solicitud"
        message="Se eliminará permanentemente de la base de datos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={actioningId !== null}
        onConfirm={() => { if (eliminarTarget) { eliminarAcceso(eliminarTarget); setEliminarTarget(null) } }}
        onClose={() => setEliminarTarget(null)}
      />
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function UsersPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (t === 'profesores' || t === 'permisos' || t === 'solicitudes') ? t : 'usuarios'
  })

  const TABS: { value: Tab; label: string; icon: typeof Users }[] = [
    { value: 'usuarios',    label: 'Usuarios',        icon: Users },
    { value: 'profesores',  label: 'Profesores',       icon: GraduationCap },
    { value: 'permisos',    label: 'Roles y Permisos', icon: ShieldCheck },
    { value: 'solicitudes', label: 'Solicitudes',      icon: ClipboardList },
  ]

  return (
    <motion.div {...pageVariants} className="space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Usuarios
        </h1>
        <p className="text-sm text-[#8A8A9A] mt-1">Gestión de cuentas, profesores, permisos y solicitudes de acceso</p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/30 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm w-fit min-w-max">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  tab === t.value
                    ? 'bg-white/50 dark:bg-white/[0.08] backdrop-blur-sm border border-white/70 dark:border-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={15} strokeWidth={2} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'usuarios'    && <UsuariosTab />}
      {tab === 'profesores'  && <ProfesoresTab />}
      {tab === 'permisos'    && <PermisosTab />}
      {tab === 'solicitudes' && <SolicitudesTab />}
    </motion.div>
  )
}
