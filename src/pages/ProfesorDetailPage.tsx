import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  ArrowLeft, GraduationCap, Edit2, Check, X, Save, UserX, UserCheck,
  CalendarDays, Link2Off, Link2, Mail,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { usuariosApi, type ProfesorDetalle } from '../api/usuarios.api'
import { useUiStore } from '../store/uiStore'
import { ROUTES } from '../constants/routes'
import Input from '../components/ui/Input'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  buildTurnosDisplay, VIEW_MODES,
  TurnosGrid, TurnosList, TurnosCalendar,
  type TurnoViewMode,
} from '../components/profesor/TurnosProfesor'

const glassCard = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-48 rounded-2xl bg-white/20 dark:bg-white/[0.06]" />
      <div className={`${glassCard} p-6 lg:p-8 space-y-4`}>
        <div className="flex gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white/20 dark:bg-white/[0.08] shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-6 w-48 rounded-xl bg-white/20 dark:bg-white/[0.08]" />
            <div className="h-4 w-64 rounded-xl bg-white/10 dark:bg-white/[0.05]" />
            <div className="h-4 w-36 rounded-xl bg-white/10 dark:bg-white/[0.05]" />
          </div>
        </div>
      </div>
      <div className={`${glassCard} p-6 space-y-3`}>
        {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white/10 dark:bg-white/[0.05]" />)}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfesorDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const addToast  = useUiStore(s => s.addToast)

  const [prof,    setProf]    = useState<ProfesorDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [acting,  setActing]  = useState(false)
  const [showBaja,         setShowBaja]         = useState(false)
  const [showReactivar,    setShowReactivar]    = useState(false)
  const [showDesvincular,  setShowDesvincular]  = useState(false)
  const [vinculando,       setVinculando]       = useState(false)
  const [espVincular,      setEspVincular]      = useState('')
  const [turnoView,        setTurnoView]        = useState<TurnoViewMode>('grid')

  type EditForm = { email: string; activo: boolean; especialidad: string }
  const { register, handleSubmit, reset, watch, setValue } = useForm<EditForm>()

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await usuariosApi.getProfesorDetalle(id)
      setProf(data)
    } catch {
      addToast('Error al cargar el profesor', 'error')
    } finally {
      setLoading(false)
    }
  }, [id]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function onSave(values: EditForm) {
    if (!id) return
    setSaving(true)
    try {
      await Promise.all([
        usuariosApi.update(id, { email: values.email, activo: values.activo }),
        usuariosApi.updateProfesor(id, values.especialidad),
      ])
      await load()
      setEditing(false)
      addToast('Datos actualizados', 'success')
    } catch {
      addToast('Error al actualizar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function onBaja() {
    if (!id) return
    setActing(true)
    try {
      const result = await usuariosApi.bajaProfesor(id)
      await load()
      setShowBaja(false)
      const n = result.turnosAfectados
      addToast(
        `Baja registrada. ${n} turno${n !== 1 ? 's' : ''} conserva${n !== 1 ? 'n' : ''} la referencia histórica.`,
        'success',
      )
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al dar de baja', 'error')
    } finally {
      setActing(false)
    }
  }

  async function onReactivar() {
    if (!id) return
    setActing(true)
    try {
      await usuariosApi.reactivarProfesor(id)
      await load()
      setShowReactivar(false)
      addToast('Profesor reactivado', 'success')
    } catch {
      addToast('Error al reactivar', 'error')
    } finally {
      setActing(false)
    }
  }

  async function onDesvincular() {
    if (!id) return
    setActing(true)
    try {
      await usuariosApi.unlinkProfesor(id)
      addToast('Perfil de profesor desvinculado', 'success')
      navigate(`${ROUTES.USERS}?tab=profesores`)
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al desvincular', 'error')
      setActing(false)
    }
  }

  async function onVincular() {
    if (!id) return
    setVinculando(true)
    try {
      await usuariosApi.linkProfesor(id, espVincular.trim() || undefined)
      addToast('Perfil de profesor vinculado', 'success')
      await load()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Error al vincular', 'error')
    } finally {
      setVinculando(false)
    }
  }

  if (loading) return (
    <motion.div {...pageVariants} className="space-y-6 pb-10 relative z-10">
      <button onClick={() => navigate(`${ROUTES.USERS}?tab=profesores`)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} /> Volver
      </button>
      <PageSkeleton />
    </motion.div>
  )

  if (!prof) return (
    <motion.div {...pageVariants} className="space-y-6 pb-10 relative z-10">
      <button onClick={() => navigate(`${ROUTES.USERS}?tab=profesores`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Volver a usuarios
      </button>
      <div className="py-20 text-center text-sm text-[#8A8A9A]">Profesor no encontrado</div>
    </motion.div>
  )

  if (!prof.profesor) return (
    <motion.div {...pageVariants} className="space-y-6 pb-10 relative z-10">

      {/* Blob */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <button onClick={() => navigate(`${ROUTES.USERS}?tab=profesores`)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} /> Volver
      </button>

      {/* Card usuario */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
        className={`${glassCard} p-6 lg:p-8`}
      >
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-200/60 dark:bg-white/[0.05]">
            <GraduationCap size={28} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">{prof.nombre}</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Mail</span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                <Mail size={12} className="text-gray-400 shrink-0" />
                {prof.email}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card vincular */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.08 } }}
        className={`${glassCard} p-6 lg:p-8`}
      >
        <div className="flex items-center gap-2.5 mb-1">
          <Link2 size={16} className="text-gray-400" />
          <h3 className="font-bold text-gray-900 dark:text-white">Vincular perfil de profesor</h3>
        </div>
        <p className="text-sm text-[#8A8A9A] mb-5">
          Este usuario tiene rol <span className="font-bold text-gray-600 dark:text-gray-300">PROFESOR</span> pero no tiene un perfil vinculado.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#8A8A9A] mb-1.5">
              Especialidad <span className="font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Crossfit, Yoga, Funcional"
              value={espVincular}
              onChange={e => setEspVincular(e.target.value)}
              className="w-full rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.06] px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6A6A7A] focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
          <button
            onClick={onVincular}
            disabled={vinculando}
            className="flex items-center gap-2 rounded-2xl btn-action px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {vinculando
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
              : <Link2 size={14} />}
            Vincular perfil
          </button>
        </div>
      </motion.div>

    </motion.div>
  )

  const p = prof.profesor
  const turnosDisplay = buildTurnosDisplay(p.turnosSalaA, p.turnosSalaB)
  const isActivo = p.activo

  return (
    <motion.div {...pageVariants} className="space-y-6 pb-10 relative z-10">

      {/* Blob */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      {/* Header */}
      <button onClick={() => navigate(`${ROUTES.USERS}?tab=profesores`)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={15} /> Volver
      </button>

      {/* ── Hero card ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
        className={`${glassCard} p-6 lg:p-8`}
      >
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${isActivo ? 'bg-emerald-500/10' : 'bg-gray-200/60 dark:bg-white/[0.05]'}`}>
            <GraduationCap size={28} className={isActivo ? 'text-emerald-500' : 'text-gray-400'} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">{prof.nombre}</h2>

            {/* Campos info */}
            {!editing && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Mail</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                    <Mail size={12} className="text-gray-400 shrink-0" />
                    {prof.email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Estado</span>
                  {isActivo
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><Check size={10} />Activo</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 border border-red-500/20"><X size={10} />Inactivo</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Alta</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {format(parseISO(prof.createdAt), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                {!isActivo && p.fechaBaja && (
                  <div className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-red-400">Baja</span>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {format(parseISO(p.fechaBaja), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Especialidad</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {p.especialidad || <span className="text-gray-400 italic font-normal">—</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Editar */}
            {editing && (
              <form onSubmit={handleSubmit(onSave)} className="mt-4 space-y-3">
                <Input
                  label="Mail"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  {...register('email')}
                />
                {/* Estado toggle */}
                <div>
                  <span className="block text-xs font-bold text-gray-500 dark:text-[#8A8A9A] mb-1.5">Estado</span>
                  <button
                    type="button"
                    onClick={() => setValue('activo', !watch('activo'))}
                    className="flex items-center gap-2.5"
                  >
                    {/* Switch */}
                    <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${watch('activo') ? 'bg-emerald-500' : 'bg-red-400'}`}>
                      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${watch('activo') ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                    {/* Label */}
                    <span className={`text-xs font-bold ${watch('activo') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {watch('activo') ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>
                </div>
                <Input
                  label="Especialidad"
                  placeholder="Ej. Crossfit, Yoga, Funcional"
                  {...register('especialidad')}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-2xl btn-action px-4 py-2.5 text-sm font-bold disabled:opacity-60"
                >
                  {saving
                    ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
                    : <Save size={13} />}
                  Guardar
                </button>
              </form>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-3 shrink-0 w-36">
            <button
              onClick={() => { setEditing(v => !v); reset({ email: prof.email, activo: p.activo, especialidad: p.especialidad ?? '' }) }}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/[0.06] px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-all"
            >
              {editing ? <X size={13} /> : <Edit2 size={13} />}
              {editing ? 'Cancelar' : 'Editar'}
            </button>
            {isActivo ? (
              <button
                onClick={() => setShowBaja(true)}
                className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-2 text-xs font-bold transition-all"
              >
                <UserX size={13} /> Dar de baja
              </button>
            ) : (
              <button
                onClick={() => setShowReactivar(true)}
                className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-2 text-xs font-bold transition-all"
              >
                <UserCheck size={13} /> Reactivar
              </button>
            )}
            <button
              onClick={() => setShowDesvincular(true)}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-2 text-xs font-bold transition-all"
            >
              <Link2Off size={13} /> Desvincular
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Turnos asignados ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.08 } }}
        className={`${glassCard} overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} className="text-gray-400" />
            <h3 className="font-bold text-gray-900 dark:text-white">{isActivo ? 'Turnos asignados' : 'Historial de turnos'}</h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white/40 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]">
              {turnosDisplay.length}
            </span>
            {!isActivo && p.fechaBaja && (
              <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">
                hasta {format(parseISO(p.fechaBaja), "d MMM yyyy", { locale: es })}
              </span>
            )}
          </div>

          {turnosDisplay.length > 0 && (
            <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
              {VIEW_MODES.map(({ mode, icon: Icon, label }) => {
                const isActive = turnoView === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setTurnoView(mode)}
                    title={label}
                    className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'text-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />
                    )}
                    <span className="relative z-10"><Icon size={13} /></span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {turnosDisplay.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarDays size={28} className="mx-auto text-gray-300 dark:text-white/20 mb-3" />
            <p className="text-sm text-[#8A8A9A]">Sin turnos asignados</p>
          </div>
        ) : turnoView === 'grid' ? (
          <TurnosGrid turnos={turnosDisplay} onNavigate={id => navigate(`/shifts/${id}`)} />
        ) : turnoView === 'list' ? (
          <TurnosList turnos={turnosDisplay} onNavigate={id => navigate(`/shifts/${id}`)} />
        ) : (
          <TurnosCalendar turnos={turnosDisplay} onNavigate={(id, date) => navigate(`/shifts/${id}${date ? `?date=${date}` : ''}`)} fechaCutoff={!isActivo ? p.fechaBaja : null} />
        )}
      </motion.div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showBaja}
        title="Dar de baja al profesor"
        message={`¿Dar de baja a ${prof.nombre}? Se marcará como inactivo desde hoy. Los ${turnosDisplay.length} turno${turnosDisplay.length !== 1 ? 's' : ''} conservarán la referencia histórica.`}
        warning={turnosDisplay.length > 0 ? `Para reasignar los turnos a otro profesor, editá cada turno manualmente.` : undefined}
        confirmLabel="Dar de baja"
        isLoading={acting}
        onConfirm={onBaja}
        onClose={() => setShowBaja(false)}
      />

      <ConfirmDialog
        isOpen={showReactivar}
        title="Reactivar al profesor"
        message={`¿Reactivar a ${prof.nombre}? Volverá a aparecer disponible para asignar en turnos y rutinas.`}
        confirmLabel="Reactivar"
        isLoading={acting}
        onConfirm={onReactivar}
        onClose={() => setShowReactivar(false)}
      />

      <ConfirmDialog
        isOpen={showDesvincular}
        title="Desvincular perfil de profesor"
        message={`¿Desvincular el perfil de profesor de ${prof.nombre}? Su cuenta de usuario seguirá existiendo con rol PROFESOR, pero sin perfil vinculado.`}
        warning="Las asistencias y rutinas históricas se conservan. Los turnos asignados quedarán sin profesor."
        confirmLabel="Desvincular"
        isLoading={acting}
        onConfirm={onDesvincular}
        onClose={() => setShowDesvincular(false)}
      />

    </motion.div>
  )
}
