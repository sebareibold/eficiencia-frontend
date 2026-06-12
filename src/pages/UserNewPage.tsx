import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft, Eye, EyeOff, ShieldCheck, Users, GraduationCap, Check,
  UserCircle2, Lock, AlertCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usuariosApi } from '../api/usuarios.api'
import { permisosApi, type PermisoEntry } from '../api/permisos.api'
import { useUiStore } from '../store/uiStore'
import { ROUTES } from '../constants/routes'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nombre:          z.string().min(1, 'El nombre es requerido'),
  email:           z.string().email('Email inválido'),
  password:        z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmá la contraseña'),
  rol:             z.enum(['ADMINISTRADOR', 'STAFF', 'PROFESOR', 'CLIENTE_COMUN']),
  activo:          z.boolean(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type FormValues = z.infer<typeof schema>

// ─── Constantes ───────────────────────────────────────────────────────────────

const GLASS = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

const STEPS = [
  { id: 1, label: 'Datos' },
  { id: 2, label: 'Rol y acceso' },
] as const

const ROL_OPTIONS = [
  {
    value:    'STAFF' as const,
    label:    'Staff',
    tagline:  'Operaciones del día a día',
    Icon:     Users,
    ring:     'border-blue-500 ring-2 ring-blue-500/30',
    iconBg:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    activeBg: 'bg-blue-500/5 dark:bg-blue-500/10',
  },
  {
    value:    'PROFESOR' as const,
    label:    'Profesor',
    tagline:  'Clases y entrenamiento',
    Icon:     GraduationCap,
    ring:     'border-emerald-500 ring-2 ring-emerald-500/30',
    iconBg:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
  },
  {
    value:    'ADMINISTRADOR' as const,
    label:    'Administrador',
    tagline:  'Control total del sistema',
    Icon:     ShieldCheck,
    ring:     'border-primary ring-2 ring-primary/30',
    iconBg:   'bg-primary/10 text-amber-600 dark:text-primary',
    activeBg: 'bg-primary/5 dark:bg-primary/10',
  },
  {
    value:    'CLIENTE_COMUN' as const,
    label:    'Cliente común',
    tagline:  'Cuenta compartida para socios',
    Icon:     UserCircle2,
    ring:     'border-purple-500 ring-2 ring-purple-500/30',
    iconBg:   'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    activeBg: 'bg-purple-500/5 dark:bg-purple-500/10',
  },
] as const

const MODULO_LABEL: Record<string, string> = {
  clients:     'Clientes',
  payments:    'Pagos y cobros',
  shifts:      'Turnos',
  attendance:  'Asistencia',
  memberships: 'Membresías',
  expenses:    'Gastos',
  dashboard:   'Dashboard',
  users:       'Usuarios',
  rutinas:     'Rutinas',
  exercises:   'Ejercicios',
  plantillas:  'Plantillas de rutina',
}

function buildPermisosSummary(perms: PermisoEntry[]): { puede: string[]; noPuede: string[] } {
  const byModule: Record<string, Record<string, boolean>> = {}
  perms.forEach(p => {
    if (!byModule[p.modulo]) byModule[p.modulo] = {}
    byModule[p.modulo][p.accion] = p.permitido
  })

  const puede: string[]   = []
  const noPuede: string[] = []

  for (const [modulo, acciones] of Object.entries(byModule)) {
    const label    = MODULO_LABEL[modulo] ?? modulo
    const canRead  = acciones['read']   === true
    const canWrite = acciones['create'] === true || acciones['update'] === true || acciones['delete'] === true

    if (canRead && canWrite) puede.push(`Gestionar ${label.toLowerCase()}`)
    else if (canRead)        puede.push(`Ver ${label.toLowerCase()}`)
    else                     noPuede.push(`Sin acceso a ${label.toLowerCase()}`)
  }

  return { puede, noPuede }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function UserNewPage() {
  const navigate   = useNavigate()
  const addToast   = useUiStore(s => s.addToast)

  const [step, setStep]               = useState(0)
  const [showPwd, setShowPwd]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clienteComunExiste, setClienteComunExiste] = useState(false)
  const [checkingCliente, setCheckingCliente]       = useState(true)
  const [permisosMap, setPermisosMap]               = useState<Record<string, PermisoEntry[]>>({})
  const [loadingPermisos, setLoadingPermisos]       = useState(true)

  useEffect(() => {
    Promise.all([
      usuariosApi.getAll(),
      ...(['ADMINISTRADOR', 'STAFF', 'PROFESOR'] as const).map(r =>
        permisosApi.getAll(r).then(p => [r, p] as const)
      ),
    ]).then(([users, ...rolPerms]) => {
      setClienteComunExiste((users as typeof users).some(u => u.rol === 'CLIENTE_COMUN'))
      const map: Record<string, PermisoEntry[]> = {}
      ;(rolPerms as [string, PermisoEntry[]][]).forEach(([rol, perms]) => { map[rol] = perms })
      setPermisosMap(map)
    }).catch(() => {}).finally(() => {
      setCheckingCliente(false)
      setLoadingPermisos(false)
    })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rol: 'STAFF', activo: true },
  })

  const selectedRol = watch('rol')
  const isActivo    = watch('activo')
  const numericStep = step + 1

  async function goNext() {
    const ok = await trigger(['nombre', 'email'])
    if (ok) setStep(1)
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      await usuariosApi.create({
        nombre:   data.nombre,
        email:    data.email,
        password: data.password,
        rol:      data.rol,
        activo:   data.activo,
      })
      addToast('Usuario creado correctamente', 'success')
      navigate(ROUTES.USERS)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      addToast(msg ?? 'Error al crear el usuario', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Stepper (igual a CreateClientPage) ──────────────────────────────────────
  function Stepper() {
    return (
      <div className="flex items-start mb-8">
        {STEPS.map((s, idx) => {
          const done = numericStep > s.id
          const curr = numericStep === s.id
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center relative">
              {idx > 0 && (
                <div
                  className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                  style={{
                    left: 0, right: '50%',
                    background: done || curr
                      ? 'linear-gradient(90deg, rgba(251,198,8,0.25), rgba(251,198,8,0.7))'
                      : 'var(--line-inactive)',
                  }}
                />
              )}
              {idx < STEPS.length - 1 && (
                <div
                  className="absolute z-10 h-px top-[18px] -translate-y-1/2"
                  style={{
                    left: '50%', right: 0,
                    background: done
                      ? 'linear-gradient(90deg, rgba(251,198,8,0.7), rgba(251,198,8,0.25))'
                      : 'var(--line-inactive)',
                  }}
                />
              )}
              <div className={[
                'relative z-20 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black transition-all duration-300',
                curr
                  ? 'bg-primary text-black ring-4 ring-primary/25 shadow-[0_0_24px_rgba(251,198,8,0.45),0_0_48px_rgba(251,198,8,0.18)] scale-110'
                  : done
                    ? 'bg-primary text-black/80 border-2 border-primary/80 shadow-[0_2px_10px_rgba(251,198,8,0.30)]'
                    : 'bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-white/[0.18] text-gray-500 dark:text-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
              ].join(' ')}>
                {done ? <Check size={14} strokeWidth={2.5} /> : s.id}
              </div>
              <div className="mt-2 flex flex-col items-center gap-0.5">
                <span className={[
                  'text-[10px] font-bold uppercase tracking-wider',
                  curr  ? 'text-gray-900 dark:text-white'
                  : done ? 'text-primary'
                  :        'text-gray-400 dark:text-[#4A4A5A]',
                ].join(' ')}>
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <motion.div {...pageVariants} className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => step === 0 ? navigate(ROUTES.USERS) : setStep(0)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Nuevo usuario</h1>
          <p className="text-sm text-[#8A8A9A]">{STEPS[step].label}</p>
        </div>
      </div>

      {/* Formulario dentro de card principal */}
      <div className={`${GLASS} p-6 md:p-8`}>
        {Stepper()}

        <form onSubmit={handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">

            {/* ── Paso 1: Datos del usuario ── */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
                  <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
                    <Users size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">Datos del usuario</p>
                    <p className="text-xs text-[#8A8A9A]">Nombre y email de acceso al sistema</p>
                  </div>
                </div>

                <Input
                  label="Nombre completo"
                  placeholder="Ej: Carlos García"
                  error={errors.nombre?.message}
                  {...register('nombre')}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="Ej: carlos@eficiencia.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={goNext}>
                    Continuar
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Paso 2: Rol y acceso ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
                  <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
                    <Lock size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">Rol y acceso</p>
                    <p className="text-xs text-[#8A8A9A]">Definí qué puede hacer este usuario en el sistema</p>
                  </div>
                </div>

                {/* Selector de rol */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Rol</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROL_OPTIONS.map(opt => {
                      const isActive   = selectedRol === opt.value
                      const isDisabled = opt.value === 'CLIENTE_COMUN' && clienteComunExiste

                      // Permisos dinámicos para roles del sistema; CLIENTE_COMUN es fijo
                      const { puede, noPuede } = opt.value === 'CLIENTE_COMUN'
                        ? { puede: ['Ver su propia rutina asignada'], noPuede: ['Sin acceso al sistema de gestión', 'Solo 1 cuenta permitida'] }
                        : buildPermisosSummary(permisosMap[opt.value] ?? [])

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isDisabled || checkingCliente}
                          onClick={() => !isDisabled && setValue('rol', opt.value)}
                          className={[
                            'relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all',
                            isDisabled
                              ? 'opacity-50 cursor-not-allowed border-white/20 dark:border-white/[0.05]'
                              : isActive
                              ? `${opt.ring} ${opt.activeBg}`
                              : 'border-white/30 dark:border-white/[0.08] hover:bg-white/20 dark:hover:bg-white/[0.04] cursor-pointer',
                          ].join(' ')}
                        >
                          {/* Header de la card */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${opt.iconBg}`}>
                                <opt.Icon size={17} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{opt.label}</p>
                                <p className="text-[11px] text-[#8A8A9A] leading-tight">{opt.tagline}</p>
                              </div>
                            </div>
                            {isActive && !isDisabled && (
                              <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                                <Check size={11} strokeWidth={3} className="text-white" />
                              </div>
                            )}
                            {isDisabled && (
                              <AlertCircle size={15} className="shrink-0 text-gray-400" />
                            )}
                          </div>

                          {/* Separador */}
                          <div className="h-px bg-gray-100 dark:bg-white/[0.05]" />

                          {/* Permisos dinámicos */}
                          {loadingPermisos && opt.value !== 'CLIENTE_COMUN' ? (
                            <div className="space-y-1.5">
                              {[1,2,3].map(i => (
                                <div key={i} className="h-3 rounded bg-gray-100 dark:bg-white/[0.06] animate-pulse" style={{ width: `${60 + i * 12}%` }} />
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {puede.map(p => (
                                <div key={p} className="flex items-start gap-1.5">
                                  <Check size={10} strokeWidth={3} className="mt-0.5 shrink-0 text-emerald-500" />
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400 leading-tight capitalize">{p}</span>
                                </div>
                              ))}
                              {noPuede.map(p => (
                                <div key={p} className="flex items-start gap-1.5">
                                  <span className="mt-0.5 shrink-0 text-[10px] text-gray-400 leading-none">✕</span>
                                  <span className="text-[11px] text-gray-400 dark:text-gray-600 leading-tight capitalize">{p}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Aviso si CLIENTE_COMUN ya existe */}
                          {isDisabled && (
                            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2">
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                                Ya existe una cuenta Cliente común. Solo se permite una.
                              </p>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Contraseña</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          className={`w-full rounded-xl border ${
                            errors.password
                              ? 'border-red-400 focus:border-red-400'
                              : 'border-white/50 dark:border-white/[0.12] focus:border-gray-300 dark:focus:border-white/20'
                          } bg-white/60 dark:bg-white/[0.04] px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all`}
                          {...register('password')}
                        />
                        <button type="button" onClick={() => setShowPwd(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">
                        Confirmar contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Repetí la contraseña"
                          className={`w-full rounded-xl border ${
                            errors.confirmPassword
                              ? 'border-red-400 focus:border-red-400'
                              : 'border-white/50 dark:border-white/[0.12] focus:border-gray-300 dark:focus:border-white/20'
                          } bg-white/60 dark:bg-white/[0.04] px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all`}
                          {...register('confirmPassword')}
                        />
                        <button type="button" onClick={() => setShowConfirm(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
                    </div>
                  </div>
                </div>

                {/* Estado activo */}
                <div className="flex items-center justify-between rounded-2xl border border-white/30 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.02] px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Usuario activo</p>
                    <p className="text-xs text-[#8A8A9A]">Puede iniciar sesión inmediatamente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('activo', !isActivo)}
                    className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                      isActivo ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isActivo ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                    Volver
                  </Button>
                  <Button type="submit" isLoading={isSubmitting}>
                    Crear usuario
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </form>
      </div>
    </motion.div>
  )
}
