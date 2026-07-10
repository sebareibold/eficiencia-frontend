import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, tabContentVariants } from '../lib/motion'
import {
  ArrowLeft, Eye, EyeOff, ShieldCheck, Users, GraduationCap,
  UserCircle2, Save, Lock, Mail, Check, Trash2,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usuariosApi, type AppUser, type UserRole } from '../api/usuarios.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEV_EMAIL = 'sebastianreibold2003@gmail.com'

const GLASS = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

const ROL_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: 'Administrador',
  STAFF:         'Staff',
  PROFESOR:      'Profesor',
  CLIENTE_COMUN: 'Cliente común',
}

const ROL_COLORS: Record<UserRole, string> = {
  ADMINISTRADOR: 'bg-primary/15 text-amber-700 dark:text-primary border border-primary/30',
  STAFF:         'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
  PROFESOR:      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  CLIENTE_COMUN: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20',
}

const ROL_ICONS: Record<UserRole, typeof ShieldCheck> = {
  ADMINISTRADOR: ShieldCheck,
  STAFF:         Users,
  PROFESOR:      GraduationCap,
  CLIENTE_COMUN: UserCircle2,
}

type DetailTab = 'datos' | 'contrasena' | 'acceso'

const TABS: { value: DetailTab; label: string }[] = [
  { value: 'datos',      label: 'Datos personales' },
  { value: 'contrasena', label: 'Contraseña' },
  { value: 'acceso',     label: 'Rol y acceso' },
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const datosSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  email:  z.string().email('Email inválido'),
})

const passwordSchema = z.object({
  password: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
  confirmPassword: z.string().min(1, 'Confirmá la contraseña'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

const accesoSchema = z.object({
  rol:    z.enum(['ADMINISTRADOR', 'STAFF', 'PROFESOR', 'CLIENTE_COMUN']),
  activo: z.boolean(),
})

type DatosValues    = z.infer<typeof datosSchema>
type PasswordValues = z.infer<typeof passwordSchema>
type AccesoValues   = z.infer<typeof accesoSchema>

// ─── Componente ───────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const authUser = useAuthStore(s => s.user)

  const [user, setUser]             = useState<AppUser | null>(null)
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<DetailTab>('datos')
  const [showPwd, setShowPwd]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingDatos, setSavingDatos]       = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingAcceso, setSavingAcceso]     = useState(false)
  const [deletingId, setDeletingId]         = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)

  const {
    register: regDatos,
    handleSubmit: hsDatos,
    formState: { errors: errDatos, isDirty: datosDirty },
    reset: resetDatos,
  } = useForm<DatosValues>({ resolver: zodResolver(datosSchema) })

  const {
    register: regPwd,
    handleSubmit: hsPwd,
    formState: { errors: errPwd },
    reset: resetPwd,
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  const {
    register: regAcceso,
    handleSubmit: hsAcceso,
    formState: { errors: errAcceso, isDirty: accesoDirty },
    reset: resetAcceso,
    watch: watchAcceso,
    setValue: setAccesoValue,
  } = useForm<AccesoValues>({ resolver: zodResolver(accesoSchema) })

  const isActivo = watchAcceso('activo')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    usuariosApi.getById(id)
      .then(u => {
        setUser(u)
        resetDatos({ nombre: u.nombre, email: u.email })
        resetAcceso({ rol: u.rol, activo: u.activo })
      })
      .catch(() => addToast('No se pudo cargar el usuario', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  const isLocked = user?.email === DEV_EMAIL || user?.email === authUser?.email

  async function onSaveDatos(data: DatosValues) {
    if (!user) return
    setSavingDatos(true)
    try {
      const updated = await usuariosApi.update(user.id, { nombre: data.nombre, email: data.email })
      setUser(updated)
      resetDatos({ nombre: updated.nombre, email: updated.email })
      addToast('Datos actualizados correctamente', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      addToast(msg ?? 'Error al actualizar los datos', 'error')
    } finally {
      setSavingDatos(false)
    }
  }

  async function onSavePassword(data: PasswordValues) {
    if (!user) return
    setSavingPassword(true)
    try {
      await usuariosApi.update(user.id, { password: data.password })
      resetPwd()
      addToast('Contraseña actualizada correctamente', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      addToast(msg ?? 'Error al actualizar la contraseña', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  async function onSaveAcceso(data: AccesoValues) {
    if (!user) return
    setSavingAcceso(true)
    try {
      const updated = await usuariosApi.update(user.id, { rol: data.rol, activo: data.activo })
      setUser(updated)
      resetAcceso({ rol: updated.rol, activo: updated.activo })
      addToast('Acceso actualizado correctamente', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      addToast(msg ?? 'Error al actualizar el acceso', 'error')
    } finally {
      setSavingAcceso(false)
    }
  }

  async function onDelete() {
    if (!user) return
    setDeletingId(true)
    try {
      await usuariosApi.remove(user.id)
      addToast('Usuario eliminado', 'success')
      navigate(ROUTES.USERS)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      addToast(msg ?? 'Error al eliminar el usuario', 'error')
    } finally {
      setDeletingId(false)
      setConfirmDelete(false)
    }
  }

  // ─── Skeleton ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <motion.div {...pageVariants} className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </motion.div>
    )
  }

  if (!user) {
    return (
      <motion.div {...pageVariants} className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(ROUTES.USERS)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A]">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Usuario no encontrado</h1>
        </div>
      </motion.div>
    )
  }

  const RolIcon = ROL_ICONS[user.rol]

  return (
    <motion.div {...pageVariants} className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.USERS)}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={15} />
          Volver
        </button>

        {!isLocked && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        )}
      </div>

      {/* Hero card */}
      <div className={`${GLASS} p-5 flex items-center gap-4`}>
        <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
          <RolIcon size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg text-gray-900 dark:text-white truncate mb-1">{user.nombre}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROL_COLORS[user.rol]}`}>
              {ROL_LABELS[user.rol]}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              user.activo
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400 border border-gray-200 dark:border-white/[0.08]'
            }`}>
              {user.activo && <Check size={10} strokeWidth={3} />}
              {user.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8A8A9A]">
            Creado el {new Date(user.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Sub-navegación + contenido */}
      <div className="space-y-3">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center justify-center gap-1.5 flex-shrink-0 flex-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 ${
                tab === t.value
                  ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={`${GLASS} overflow-hidden min-h-[260px]`}>
          <AnimatePresence mode="wait">

            {/* ══ DATOS PERSONALES ══ */}
            {tab === 'datos' && (
              <motion.div key="datos" {...tabContentVariants}>
                <div className="p-6 md:p-8 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#8A8A9A]">Nombre y email de acceso al sistema</p>
                  </div>

                  <form onSubmit={hsDatos(onSaveDatos)} className="space-y-4">
                    <Input
                      label="Nombre completo"
                      placeholder="Ej: Carlos García"
                      error={errDatos.nombre?.message}
                      {...regDatos('nombre')}
                    />
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                        Email
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          type="email"
                          placeholder="Ej: carlos@eficiencia.com"
                          className={`w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all bg-white/60 dark:bg-white/[0.04] ${
                            errDatos.email
                              ? 'border-red-400 focus:border-red-400'
                              : 'border-white/50 dark:border-white/[0.12] focus:border-gray-300 dark:focus:border-white/20'
                          }`}
                          {...regDatos('email')}
                        />
                      </div>
                      {errDatos.email && <p className="text-xs text-red-500">{errDatos.email.message}</p>}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" isLoading={savingDatos} disabled={!datosDirty}>
                        <Save size={14} />
                        Guardar cambios
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ══ CONTRASEÑA ══ */}
            {tab === 'contrasena' && (
              <motion.div key="contrasena" {...tabContentVariants}>
                <div className="p-6 md:p-8 space-y-4">
                  <div className="pb-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#8A8A9A]">Mínimo 10 caracteres · mayúscula · minúscula · número</p>
                  </div>

                  <form onSubmit={hsPwd(onSavePassword)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                          Nueva contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            placeholder="Nueva contraseña"
                            className={`w-full rounded-xl border pr-10 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all bg-white/60 dark:bg-white/[0.04] ${
                              errPwd.password
                                ? 'border-red-400 focus:border-red-400'
                                : 'border-white/50 dark:border-white/[0.12] focus:border-gray-300 dark:focus:border-white/20'
                            }`}
                            {...regPwd('password')}
                          />
                          <button type="button" onClick={() => setShowPwd(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        {errPwd.password && <p className="text-xs text-red-500">{errPwd.password.message}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                          Confirmar contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Repetí la contraseña"
                            className={`w-full rounded-xl border pr-10 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all bg-white/60 dark:bg-white/[0.04] ${
                              errPwd.confirmPassword
                                ? 'border-red-400 focus:border-red-400'
                                : 'border-white/50 dark:border-white/[0.12] focus:border-gray-300 dark:focus:border-white/20'
                            }`}
                            {...regPwd('confirmPassword')}
                          />
                          <button type="button" onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        {errPwd.confirmPassword && <p className="text-xs text-red-500">{errPwd.confirmPassword.message}</p>}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" isLoading={savingPassword}>
                        <Lock size={14} />
                        Cambiar contraseña
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ══ ROL Y ACCESO ══ */}
            {tab === 'acceso' && (
              <motion.div key="acceso" {...tabContentVariants}>
                <div className="p-6 md:p-8 space-y-4">
                  <div className="pb-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#8A8A9A]">
                      {isLocked ? 'No se puede modificar tu propia cuenta' : 'Permiso de acceso al sistema'}
                    </p>
                  </div>

                  <form onSubmit={hsAcceso(onSaveAcceso)} className="space-y-4">
                    <Select
                      label="Rol *"
                      error={errAcceso.rol?.message}
                      disabled={isLocked}
                      options={[
                        { value: 'ADMINISTRADOR', label: 'Administrador' },
                        { value: 'STAFF',         label: 'Staff' },
                        { value: 'PROFESOR',      label: 'Profesor' },
                        { value: 'CLIENTE_COMUN', label: 'Cliente común' },
                      ]}
                      {...regAcceso('rol')}
                    />

                    <div className={`flex items-center justify-between rounded-2xl border border-white/30 dark:border-white/[0.06] px-4 py-3 ${
                      isLocked ? 'opacity-50 bg-white/10 dark:bg-white/[0.01]' : 'bg-white/20 dark:bg-white/[0.02]'
                    }`}>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Usuario activo</p>
                        <p className="text-xs text-[#8A8A9A]">Puede iniciar sesión en el sistema</p>
                      </div>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => !isLocked && setAccesoValue('activo', !isActivo, { shouldDirty: true })}
                        className={`relative h-6 w-11 rounded-full transition-colors duration-200 disabled:cursor-not-allowed ${
                          isActivo ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          isActivo ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {!isLocked && (
                      <div className="flex justify-end pt-2">
                        <Button type="submit" isLoading={savingAcceso} disabled={!accesoDirty}>
                          <Save size={14} />
                          Guardar acceso
                        </Button>
                      </div>
                    )}
                  </form>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Eliminar usuario"
        message={`¿Seguro que querés eliminar a ${user.nombre}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={deletingId}
        onConfirm={onDelete}
        onClose={() => setConfirmDelete(false)}
      />

    </motion.div>
  )
}
