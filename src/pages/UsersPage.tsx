import { useState, useEffect, Fragment, useCallback } from 'react'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Plus, Search, RefreshCw, Edit2, Trash2, UserCheck, UserX,
  ShieldCheck, Users, GraduationCap, Check, X as XIcon,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usuariosApi, type AppUser, type UserRole } from '../api/usuarios.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'

// ─── Tipos y constantes ───────────────────────────────────────────────────────

type Tab = 'usuarios' | 'profesores' | 'permisos'

const ROL_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: 'Administrador',
  STAFF: 'Staff',
  PROFESOR: 'Profesor',
}

const ROL_COLORS: Record<UserRole, string> = {
  ADMINISTRADOR: 'bg-primary/15 text-amber-700 dark:text-primary border border-primary/30',
  STAFF:         'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
  PROFESOR:      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  nombre:   z.string().min(1, 'El nombre es requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol:      z.enum(['ADMINISTRADOR', 'STAFF', 'PROFESOR']),
  activo:   z.boolean().optional(),
})

const editSchema = z.object({
  nombre:   z.string().min(1, 'El nombre es requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres').or(z.literal('')).optional(),
  rol:      z.enum(['ADMINISTRADOR', 'STAFF', 'PROFESOR']),
  activo:   z.boolean().optional(),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues   = z.infer<typeof editSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const glassCard = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

function RolBadge({ rol }: { rol: UserRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${ROL_COLORS[rol]}`}>
      {ROL_LABELS[rol]}
    </span>
  )
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return activo
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><Check size={10} />Activo</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-gray-200/60 dark:bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08]"><XIcon size={10} />Inactivo</span>
}

// ─── Tab: Usuarios ────────────────────────────────────────────────────────────

function UsuariosTab() {
  const addToast  = useUiStore(s => s.addToast)
  const currentUser = useAuthStore(s => s.user)

  const [users, setUsers]             = useState<AppUser[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [rolFilter, setRolFilter]     = useState<UserRole | 'all'>('all')
  const [createOpen, setCreateOpen]   = useState(false)
  const [editTarget, setEditTarget]   = useState<AppUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    usuariosApi.getAll()
      .then(setUsers)
      .catch(() => addToast('Error al cargar usuarios', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const { register: regCreate, handleSubmit: hsCreate, formState: { errors: errCreate }, reset: resetCreate } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { rol: 'STAFF', activo: true },
  })

  const { register: regEdit, handleSubmit: hsEdit, formState: { errors: errEdit }, reset: resetEdit } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRol = rolFilter === 'all' || u.rol === rolFilter
    return matchSearch && matchRol
  })

  async function onCreate(data: CreateValues) {
    setIsSubmitting(true)
    try {
      const created = await usuariosApi.create(data)
      setUsers(prev => [created, ...prev])
      addToast('Usuario creado correctamente', 'success')
      setCreateOpen(false)
      resetCreate()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al crear el usuario', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onEdit(data: EditValues) {
    if (!editTarget) return
    setIsSubmitting(true)
    try {
      const dto: any = { nombre: data.nombre, email: data.email, rol: data.rol, activo: data.activo }
      if (data.password) dto.password = data.password
      const updated = await usuariosApi.update(editTarget.id, dto)
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      addToast('Usuario actualizado', 'success')
      setEditTarget(null)
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al actualizar', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onDelete(user: AppUser) {
    if (!confirm(`¿Eliminar al usuario ${user.nombre}? Esta acción no se puede deshacer.`)) return
    setDeletingId(user.id)
    try {
      await usuariosApi.remove(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      addToast('Usuario eliminado', 'success')
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al eliminar', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function openEdit(u: AppUser) {
    setEditTarget(u)
    resetEdit({ nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, password: '' })
  }

  const countByRol = (rol: UserRole) => users.filter(u => u.rol === rol).length

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { label: 'Administradores', count: countByRol('ADMINISTRADOR'), color: 'text-primary bg-primary/10' },
          { label: 'Staff',           count: countByRol('STAFF'),          color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
          { label: 'Profesores',      count: countByRol('PROFESOR'),       color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
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

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="w-64 rounded-xl border border-saas-border bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-saas-border bg-white p-1">
            {(['all', 'ADMINISTRADOR', 'STAFF', 'PROFESOR'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRolFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${rolFilter === r ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {r === 'all' ? 'Todos' : ROL_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-saas-border bg-white text-gray-400 hover:text-gray-700 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2 text-sm"
          >
            <Plus size={14} strokeWidth={2.5} /> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`${glassCard} overflow-hidden`}>
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
                    <td className="px-5 py-3.5"><RolBadge rol={u.rol} /></td>
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
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => onDelete(u)}
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

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); resetCreate() }} title="Nuevo usuario" size="md">
        <form onSubmit={hsCreate(onCreate)} className="space-y-4">
          <Input label="Nombre *" error={errCreate.nombre?.message} {...regCreate('nombre')} />
          <Input label="Email *" type="email" error={errCreate.email?.message} {...regCreate('email')} />
          <Input label="Contraseña *" type="password" error={errCreate.password?.message} {...regCreate('password')} />
          <Select label="Rol *" error={errCreate.rol?.message} options={[
            { value: 'STAFF',         label: 'Staff' },
            { value: 'PROFESOR',      label: 'Profesor' },
            { value: 'ADMINISTRADOR', label: 'Administrador' },
          ]} {...regCreate('rol')} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...regCreate('activo')} defaultChecked className="h-4 w-4 rounded accent-primary" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuario activo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setCreateOpen(false); resetCreate() }}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>Crear usuario</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Editar usuario" size="md">
        <form onSubmit={hsEdit(onEdit)} className="space-y-4">
          <Input label="Nombre *" error={errEdit.nombre?.message} {...regEdit('nombre')} />
          <Input label="Email *" type="email" error={errEdit.email?.message} {...regEdit('email')} />
          <Input label="Nueva contraseña" type="password" placeholder="Dejar vacío para no cambiar" error={errEdit.password?.message} {...regEdit('password')} />
          <Select label="Rol *" error={errEdit.rol?.message} options={[
            { value: 'STAFF',         label: 'Staff' },
            { value: 'PROFESOR',      label: 'Profesor' },
            { value: 'ADMINISTRADOR', label: 'Administrador' },
          ]} {...regEdit('rol')} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...regEdit('activo')} className="h-4 w-4 rounded accent-primary" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuario activo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Tab: Profesores ──────────────────────────────────────────────────────────

const espSchema = z.object({ especialidad: z.string().optional() })
type EspValues  = z.infer<typeof espSchema>

function ProfesoresTab() {
  const addToast = useUiStore(s => s.addToast)
  const [users, setUsers]       = useState<AppUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [linking, setLinking]   = useState<string | null>(null)
  const [linkTarget, setLinkTarget] = useState<AppUser | null>(null)
  const [editEspTarget, setEditEspTarget] = useState<AppUser | null>(null)

  const { register, handleSubmit, reset } = useForm<EspValues>({ resolver: zodResolver(espSchema) })
  const { register: regEdit, handleSubmit: hsEditEsp, reset: resetEsp } = useForm<EspValues>({ resolver: zodResolver(espSchema) })

  const load = useCallback(() => {
    setLoading(true)
    usuariosApi.getAll()
      .then(data => setUsers(data.filter(u => u.rol === 'PROFESOR')))
      .catch(() => addToast('Error al cargar profesores', 'error'))
      .finally(() => setLoading(false))
  }, [])

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
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al vincular', 'error')
    } finally {
      setLinking(null)
    }
  }

  async function onUnlink(u: AppUser) {
    if (!confirm(`¿Desvincular el perfil de profesor de ${u.nombre}? Los turnos asignados quedarán sin profesor.`)) return
    setLinking(u.id)
    try {
      const updated = await usuariosApi.unlinkProfesor(u.id)
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))
      addToast('Perfil de profesor desvinculado', 'success')
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al desvincular', 'error')
    } finally {
      setLinking(null)
    }
  }

  async function onUpdateEsp(data: EspValues) {
    if (!editEspTarget) return
    setLinking(editEspTarget.id)
    try {
      const updated = await usuariosApi.updateProfesor(editEspTarget.id, data.especialidad ?? '')
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      addToast('Especialidad actualizada', 'success')
      setEditEspTarget(null)
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al actualizar', 'error')
    } finally {
      setLinking(null)
    }
  }

  const vinculados   = users.filter(u => u.profesor)
  const noVinculados = users.filter(u => !u.profesor)

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <strong>Flujo:</strong> Los usuarios con rol Profesor necesitan un <em>perfil de profesor vinculado</em> para poder ser asignados a turnos. Podés crearlos desde la pestaña Usuarios y vincularlos aquí.
      </div>

      {/* Vinculados */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#8A8A9A]">
          Con perfil vinculado ({vinculados.length})
        </h3>
        <div className={`${glassCard} overflow-hidden`}>
          {loading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : vinculados.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#8A8A9A]">Ningún profesor vinculado aún</div>
          ) : (
            <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
              {vinculados.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <GraduationCap size={18} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{u.nombre}</p>
                    <p className="text-xs text-[#8A8A9A]">
                      {u.profesor?.especialidad ? u.profesor.especialidad : 'Sin especialidad'} · {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditEspTarget(u); resetEsp({ especialidad: u.profesor?.especialidad ?? '' }) }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onUnlink(u)}
                      disabled={linking === u.id}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                      <UserX size={13} /> Desvincular
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sin vincular */}
      {noVinculados.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#8A8A9A]">
            Sin perfil vinculado ({noVinculados.length})
          </h3>
          <div className={`${glassCard} overflow-hidden`}>
            <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
              {noVinculados.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <GraduationCap size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{u.nombre}</p>
                    <p className="text-xs text-[#8A8A9A]">{u.email} · Tiene rol Profesor pero sin perfil vinculado</p>
                  </div>
                  <button
                    onClick={() => { setLinkTarget(u); reset({ especialidad: '' }) }}
                    disabled={linking === u.id}
                    className="flex items-center gap-1.5 rounded-xl btn-action px-3 py-2 text-xs shrink-0"
                  >
                    <UserCheck size={13} /> Vincular como profesor
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal vincular */}
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

      {/* Modal editar especialidad */}
      <Modal isOpen={!!editEspTarget} onClose={() => setEditEspTarget(null)} title="Editar especialidad" size="sm">
        <form onSubmit={hsEditEsp(onUpdateEsp)} className="space-y-4">
          <Input label="Especialidad" placeholder="Ej. Crossfit, Yoga, Funcional" {...regEdit('especialidad')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setEditEspTarget(null)}>Cancelar</Button>
            <Button type="submit" isLoading={!!linking}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Tab: Roles y Permisos ────────────────────────────────────────────────────

const ROLES_MATRIX = [
  { id: 'admin',    name: 'Administrador' },
  { id: 'staff',    name: 'Staff' },
  { id: 'profesor', name: 'Profesor' },
]

const MODULES_MATRIX = [
  {
    id: 'clientes', name: 'Gestión de Clientes',
    actions: [
      { id: 'read',   name: 'Ver listado y perfiles' },
      { id: 'create', name: 'Crear nuevos clientes' },
      { id: 'update', name: 'Editar datos personales' },
      { id: 'delete', name: 'Eliminar clientes' },
    ],
  },
  {
    id: 'pagos', name: 'Gestión de Pagos',
    actions: [
      { id: 'read',   name: 'Ver historial de cobros' },
      { id: 'create', name: 'Registrar nuevos cobros' },
      { id: 'update', name: 'Editar o anular pagos' },
    ],
  },
  {
    id: 'turnos', name: 'Turnos y Calendario',
    actions: [
      { id: 'read',   name: 'Ver calendario y grilla' },
      { id: 'create', name: 'Crear nuevos turnos' },
      { id: 'update', name: 'Editar turnos existentes' },
      { id: 'delete', name: 'Eliminar turnos' },
    ],
  },
  {
    id: 'asistencia', name: 'Asistencia',
    actions: [
      { id: 'read',   name: 'Ver registros de asistencia' },
      { id: 'mark',   name: 'Tomar asistencia' },
    ],
  },
  {
    id: 'membresias', name: 'Membresías y Planes',
    actions: [
      { id: 'read',   name: 'Ver membresías y planes' },
      { id: 'manage', name: 'Gestionar membresías' },
    ],
  },
  {
    id: 'gastos', name: 'Gastos',
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
      { id: 'view',     name: 'Ver métricas y KPIs' },
      { id: 'charts',   name: 'Ver gráficos financieros' },
    ],
  },
  {
    id: 'usuarios', name: 'Usuarios y Profesores',
    actions: [
      { id: 'read',   name: 'Ver usuarios y profesores' },
      { id: 'manage', name: 'Crear, editar y eliminar usuarios' },
    ],
  },
  {
    id: 'config', name: 'Configuración del Sistema',
    actions: [
      { id: 'view',   name: 'Ver configuración' },
      { id: 'manage', name: 'Modificar configuración global' },
    ],
  },
]

type PermMatrix = Record<string, Record<string, Record<string, boolean>>>

const DEFAULT_PERMS: PermMatrix = {
  admin: {
    clientes:   { read: true,  create: true,  update: true,  delete: true  },
    pagos:      { read: true,  create: true,  update: true                  },
    turnos:     { read: true,  create: true,  update: true,  delete: true  },
    asistencia: { read: true,  mark: true                                   },
    membresias: { read: true,  manage: true                                 },
    gastos:     { read: true,  create: true,  update: true,  delete: true  },
    dashboard:  { view: true,  charts: true                                 },
    usuarios:   { read: true,  manage: true                                 },
    config:     { view: true,  manage: true                                 },
  },
  staff: {
    clientes:   { read: true,  create: true,  update: true,  delete: false },
    pagos:      { read: true,  create: true,  update: false                 },
    turnos:     { read: true,  create: false, update: false, delete: false },
    asistencia: { read: true,  mark: true                                   },
    membresias: { read: true,  manage: false                                },
    gastos:     { read: false, create: false, update: false, delete: false },
    dashboard:  { view: false, charts: false                                },
    usuarios:   { read: false, manage: false                                },
    config:     { view: true,  manage: false                                },
  },
  profesor: {
    clientes:   { read: true,  create: false, update: false, delete: false },
    pagos:      { read: false, create: false, update: false                 },
    turnos:     { read: true,  create: false, update: false, delete: false },
    asistencia: { read: true,  mark: true                                   },
    membresias: { read: false, manage: false                                },
    gastos:     { read: false, create: false, update: false, delete: false },
    dashboard:  { view: false, charts: false                                },
    usuarios:   { read: false, manage: false                                },
    config:     { view: false, manage: false                                },
  },
}

function PermisosTab() {
  const [perms, setPerms] = useState<PermMatrix>(DEFAULT_PERMS)

  const toggle = (roleId: string, modId: string, actionId: string, val: boolean) => {
    if (roleId === 'admin') return
    setPerms(prev => ({
      ...prev,
      [roleId]: { ...prev[roleId], [modId]: { ...prev[roleId][modId], [actionId]: val } },
    }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        Esta matriz es <strong>referencial</strong> — los permisos reales se controlan por el rol asignado a cada usuario. El rol <strong>Administrador</strong> tiene acceso total y no puede modificarse.
      </div>

      <div className={`${glassCard} overflow-hidden`}>
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
                    <td colSpan={ROLES_MATRIX.length + 1} className="px-6 py-2.5 text-xs font-extrabold text-gray-900 dark:text-white bg-primary/[0.04] dark:bg-primary/[0.06] border-y border-primary/10">
                      {mod.name}
                    </td>
                  </tr>
                  {mod.actions.map(action => (
                    <tr key={`${mod.id}-${action.id}`} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 pl-10 text-sm font-medium text-gray-600 dark:text-gray-300">
                        {action.name}
                      </td>
                      {ROLES_MATRIX.map(role => {
                        const checked = perms[role.id]?.[mod.id]?.[action.id] ?? false
                        const isAdmin = role.id === 'admin'
                        return (
                          <td key={role.id} className="px-6 py-3.5 text-center">
                            <button
                              type="button"
                              disabled={isAdmin}
                              onClick={() => toggle(role.id, mod.id, action.id, !checked)}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 ${
                                checked ? 'bg-primary shadow-[0_0_8px_rgb(var(--color-primary)/0.4)]' : 'bg-gray-200 dark:bg-gray-700/50'
                              } ${isAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-105'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
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
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('usuarios')

  const TABS: { value: Tab; label: string; icon: typeof Users }[] = [
    { value: 'usuarios',   label: 'Usuarios',        icon: Users       },
    { value: 'profesores', label: 'Profesores',       icon: GraduationCap },
    { value: 'permisos',   label: 'Roles y Permisos', icon: ShieldCheck },
  ]

  return (
    <motion.div {...pageVariants} className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Usuarios
        </h1>
        <p className="text-sm text-[#8A8A9A] mt-1">Gestión de cuentas, profesores y permisos del sistema</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07] w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                tab === t.value
                  ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={15} strokeWidth={2} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'usuarios'   && <UsuariosTab />}
      {tab === 'profesores' && <ProfesoresTab />}
      {tab === 'permisos'   && <PermisosTab />}
    </motion.div>
  )
}
