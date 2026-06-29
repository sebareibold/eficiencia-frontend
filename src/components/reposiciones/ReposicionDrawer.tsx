/**
 * ReposicionDrawer — Drawer compartido para registrar ausencias y agendar recuperaciones.
 * Emil design: spring exit/enter, glassmorphism, active:scale-[0.97], EASE_OUT.
 * Usado desde: ClientProfilePage, ShiftDetailPage, AttendancePage.
 */
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CalendarX2, CalendarCheck2, Clock, Users,
  CheckCircle2, ChevronRight, Loader2,
  MessageSquare, Bell, BellOff,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { reposicionesApi } from '../../api/reposiciones.api'
import { shiftsApi } from '../../api/shifts.api'
import { useUiStore } from '../../store/uiStore'
import type { AusenciaTurno, CupoInfo } from '../../types/reposicion.types'
import type { Shift } from '../../types/shift.types'

// ─── Emil animation constants ─────────────────────────────────────────────────
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
}

const drawerVariants = {
  initial: { x: '100%', opacity: 0.5 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.35, ease: EASE_OUT } },
  exit:    { x: '100%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
}

const stepVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.14, ease: 'easeIn' } },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DIA_TO_SHORT: Record<string, string> = {
  lunes: 'Lu', martes: 'Ma', miercoles: 'Mi', 'miércoles': 'Mi',
  jueves: 'Ju', viernes: 'Vi', sabado: 'Sá', 'sábado': 'Sá', domingo: 'Do',
}

function fmtFecha(iso: string) {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es })
  } catch {
    return iso
  }
}

function diasStr(diasSemana: string[]) {
  return diasSemana.map(d => DIA_TO_SHORT[d.toLowerCase()] ?? d).join(' · ')
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
type DrawerMode = 'ausencia' | 'recuperar'

export interface ReposicionDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  mode?: DrawerMode
  ausencia?: AusenciaTurno
  inscripcionId?: string
  clienteNombre?: string
  turnoLabel?: string
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ReposicionDrawer({
  isOpen,
  onClose,
  onSuccess,
  mode = 'ausencia',
  ausencia,
  inscripcionId,
  clienteNombre,
  turnoLabel,
}: ReposicionDrawerProps) {
  const addToast = useUiStore(s => s.addToast)

  const [step, setStep] = useState<1 | 2>(mode === 'recuperar' ? 2 : 1)
  const [ausenciaCreada, setAusenciaCreada] = useState<AusenciaTurno | null>(ausencia ?? null)

  const [fechaAusencia, setFechaAusencia] = useState(todayStr())
  const [conAviso, setConAviso] = useState(false)
  const [notasAusencia, setNotasAusencia] = useState('')
  const [savingAusencia, setSavingAusencia] = useState(false)

  const [fechaRecup, setFechaRecup] = useState(todayStr())
  const [turnos, setTurnos] = useState<Shift[]>([])
  const [loadingTurnos, setLoadingTurnos] = useState(false)
  const [cupos, setCupos] = useState<Record<string, CupoInfo>>({})
  const [loadingCupos, setLoadingCupos] = useState(false)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string | null>(null)
  const [notasRecup, setNotasRecup] = useState('')
  const [savingRecup, setSavingRecup] = useState(false)
  const [skipRecup, setSkipRecup] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep(mode === 'recuperar' ? 2 : 1)
      setAusenciaCreada(ausencia ?? null)
      setFechaAusencia(todayStr())
      setConAviso(false)
      setNotasAusencia('')
      setFechaRecup(todayStr())
      setTurnoSeleccionado(null)
      setNotasRecup('')
      setSkipRecup(false)
      setCupos({})
    }
  }, [isOpen, mode, ausencia])

  useEffect(() => {
    if (step !== 2 || !isOpen) return
    setLoadingTurnos(true)
    shiftsApi.getAll()
      .then(t => setTurnos(t))
      .catch(() => addToast({ type: 'error', message: 'No se pudieron cargar los turnos' }))
      .finally(() => setLoadingTurnos(false))
  }, [step, isOpen])

  const cargarCupos = useCallback(async (fecha: string, lista: Shift[]) => {
    if (!fecha || lista.length === 0) return
    setLoadingCupos(true)
    const results = await Promise.allSettled(
      lista.map(t => reposicionesApi.getCupo(t.id, fecha).then(c => ({ id: t.id, cupo: c })))
    )
    const map: Record<string, CupoInfo> = {}
    results.forEach(r => {
      if (r.status === 'fulfilled') map[r.value.id] = r.value.cupo
    })
    setCupos(map)
    setLoadingCupos(false)
  }, [])

  useEffect(() => {
    if (step === 2 && turnos.length > 0) {
      void cargarCupos(fechaRecup, turnos)
    }
  }, [fechaRecup, turnos, step, cargarCupos])

  async function handleRegistrarAusencia() {
    if (!inscripcionId) return
    setSavingAusencia(true)
    try {
      const nueva = await reposicionesApi.createAusencia({
        inscripcionId,
        fecha: fechaAusencia,
        conAviso,
        notas: notasAusencia || undefined,
      })
      setAusenciaCreada(nueva)
      addToast({ type: 'success', message: 'Ausencia registrada' })
      if (skipRecup) {
        onSuccess?.()
        onClose()
      } else {
        setStep(2)
      }
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al registrar ausencia' })
    } finally {
      setSavingAusencia(false)
    }
  }

  async function handleAgendarRecuperacion() {
    const target = ausenciaCreada
    if (!target || !turnoSeleccionado) return
    setSavingRecup(true)
    try {
      await reposicionesApi.createRecuperacion(target.id, {
        turnoDestinoId: turnoSeleccionado,
        fecha: fechaRecup,
        notas: notasRecup || undefined,
      })
      addToast({ type: 'success', message: 'Recuperación agendada correctamente' })
      onSuccess?.()
      onClose()
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.message ?? 'Error al agendar recuperación' })
    } finally {
      setSavingRecup(false)
    }
  }

  function handleSaltarRecup() {
    onSuccess?.()
    onClose()
  }

  function cupoDisponible(turnoId: string): number {
    const c = cupos[turnoId]
    if (!c) return 0
    return c.cupoDisponibleA + c.cupoDisponibleB
  }

  function cupoColor(turnoId: string): string {
    const n = cupoDisponible(turnoId)
    if (n === 0) return 'text-red-500'
    if (n <= 2) return 'text-amber-500'
    return 'text-emerald-500'
  }

  const title = step === 1 ? 'Registrar ausencia' : 'Agendar recuperación'

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
          />

          <motion.aside
            key="drawer"
            className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-md
              border-l border-gray-200 dark:border-white/[0.08]
              bg-white/80 dark:bg-[#111]/90
              backdrop-blur-3xl
              shadow-[-24px_0_80px_rgba(0,0,0,0.08)] dark:shadow-[-24px_0_80px_rgba(0,0,0,0.5)]"
            variants={drawerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                {mode === 'ausencia' && (
                  <div className="flex items-center gap-1.5">
                    {[1, 2].map(s => (
                      <motion.div
                        key={s}
                        animate={{
                          width: step === s ? 24 : 8,
                          backgroundColor: step === s ? '#FBC608' : step > s ? '#22c55e' : 'rgba(156,163,175,0.4)',
                        }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        className="h-2 rounded-full"
                      />
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#666]">
                    {mode === 'ausencia' ? `Paso ${step} de 2` : 'Recuperación'}
                  </p>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{title}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-all active:scale-[0.92]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contexto cliente / turno */}
            {(clienteNombre || turnoLabel) && (
              <div className="px-6 pt-4 pb-0 shrink-0">
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-primary">
                      {clienteNombre?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    {clienteNombre && (
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{clienteNombre}</p>
                    )}
                    {turnoLabel && (
                      <p className="text-xs text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1">
                        <Clock size={10} className="shrink-0" />
                        {turnoLabel}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="p-6 space-y-5"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5">
                        <CalendarX2 size={11} className="text-red-400" />
                        Fecha de ausencia
                      </label>
                      <input
                        type="date"
                        value={fechaAusencia}
                        onChange={e => setFechaAusencia(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl
                          bg-white dark:bg-white/[0.05]
                          border border-gray-200 dark:border-white/[0.1]
                          text-gray-900 dark:text-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-primary/40
                          transition-all duration-150"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setConAviso(v => !v)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all duration-200 active:scale-[0.98]
                        ${conAviso
                          ? 'bg-primary/5 border-primary/30 dark:bg-primary/10'
                          : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08]'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {conAviso
                          ? <Bell size={16} className="text-primary" />
                          : <BellOff size={16} className="text-gray-400" />
                        }
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${conAviso ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-[#8A8A9A]'}`}>
                            {conAviso ? 'Con aviso previo' : 'Sin aviso previo'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-[#666]">
                            El cliente {conAviso ? 'avisó con anticipación' : 'no avisó con anticipación'}
                          </p>
                        </div>
                      </div>
                      <div className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${conAviso ? 'bg-primary' : 'bg-gray-200 dark:bg-white/[0.12]'}`}>
                        <motion.div
                          animate={{ x: conAviso ? 16 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                        />
                      </div>
                    </button>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5">
                        <MessageSquare size={11} />
                        Notas <span className="normal-case font-normal text-gray-400">(opcional)</span>
                      </label>
                      <textarea
                        value={notasAusencia}
                        onChange={e => setNotasAusencia(e.target.value)}
                        rows={3}
                        placeholder="Motivo de la ausencia, observaciones…"
                        className="w-full px-4 py-3 rounded-2xl resize-none
                          bg-white dark:bg-white/[0.05]
                          border border-gray-200 dark:border-white/[0.1]
                          text-gray-900 dark:text-white text-sm
                          placeholder-gray-400 dark:placeholder-[#555]
                          focus:outline-none focus:ring-2 focus:ring-primary/40
                          transition-all duration-150"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setSkipRecup(v => !v)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm transition-all duration-200 active:scale-[0.98]
                        ${skipRecup
                          ? 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-[#8A8A9A]'
                          : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-[#666]'
                        }`}
                    >
                      <div className={`h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                        ${skipRecup ? 'bg-primary border-primary' : 'border-gray-300 dark:border-white/[0.2]'}`}>
                        {skipRecup && <CheckCircle2 size={10} className="text-black" />}
                      </div>
                      <span>Solo registrar ausencia, sin agendar recuperación ahora</span>
                    </button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="p-6 space-y-5"
                  >
                    {ausenciaCreada && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-500/20">
                        <CalendarX2 size={14} className="text-red-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-red-500 dark:text-red-400">Ausencia registrada</p>
                          <p className="text-xs text-red-400/80 dark:text-red-400/60">
                            {fmtFecha(ausenciaCreada.fecha)}
                            {ausenciaCreada.inscripcion?.turno && (
                              <> · {ausenciaCreada.inscripcion.turno.horaInicio} – {ausenciaCreada.inscripcion.turno.horaFin}</>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5">
                        <CalendarCheck2 size={11} className="text-emerald-500" />
                        Fecha de recuperación
                      </label>
                      <input
                        type="date"
                        value={fechaRecup}
                        min={todayStr()}
                        onChange={e => setFechaRecup(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl
                          bg-white dark:bg-white/[0.05]
                          border border-gray-200 dark:border-white/[0.1]
                          text-gray-900 dark:text-white text-sm
                          focus:outline-none focus:ring-2 focus:ring-primary/40
                          transition-all duration-150"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5">
                          <Users size={11} />
                          Turno destino
                        </label>
                        {loadingCupos && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> verificando cupos
                          </span>
                        )}
                      </div>

                      {loadingTurnos ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {turnos.map(t => {
                            const cupoN = cupoDisponible(t.id)
                            const sinCupo = cupos[t.id] ? cupoN === 0 : false
                            const isSelected = turnoSeleccionado === t.id

                            return (
                              <motion.button
                                key={t.id}
                                type="button"
                                disabled={sinCupo}
                                onClick={() => setTurnoSeleccionado(isSelected ? null : t.id)}
                                whileTap={{ scale: sinCupo ? 1 : 0.98 }}
                                transition={{ duration: 0.1, ease: EASE_OUT }}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-left
                                  transition-all duration-200
                                  ${sinCupo
                                    ? 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-white/[0.02] border-gray-100 dark:border-white/[0.05]'
                                    : isSelected
                                      ? 'bg-primary/5 dark:bg-primary/10 border-primary/40 dark:border-primary/30 shadow-[0_0_0_1px_rgba(251,198,8,0.2)]'
                                      : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] hover:bg-gray-50 dark:hover:bg-white/[0.07]'
                                  }`}
                              >
                                <div className="min-w-0">
                                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                                    {t.startTime} – {t.endTime}
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-[#666] mt-0.5">
                                    {diasStr(
                                      (t as any).diasSemana ??
                                      t.days.map((d: string) => {
                                        const m: Record<string, string> = { monday:'lunes',tuesday:'martes',wednesday:'miércoles',thursday:'jueves',friday:'viernes',saturday:'sábado',sunday:'domingo' }
                                        return m[d] ?? d
                                      })
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  {cupos[t.id] ? (
                                    <span className={`text-xs font-bold ${cupoColor(t.id)}`}>
                                      {sinCupo ? 'Sin cupo' : `${cupoN} lugar${cupoN !== 1 ? 'es' : ''}`}
                                    </span>
                                  ) : loadingCupos ? (
                                    <Loader2 size={12} className="animate-spin text-gray-300" />
                                  ) : null}
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0.5, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ duration: 0.18, ease: EASE_OUT }}
                                    >
                                      <CheckCircle2 size={16} className="text-primary" />
                                    </motion.div>
                                  )}
                                </div>
                              </motion.button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-[#8A8A9A] flex items-center gap-1.5">
                        <MessageSquare size={11} />
                        Notas <span className="normal-case font-normal text-gray-400">(opcional)</span>
                      </label>
                      <textarea
                        value={notasRecup}
                        onChange={e => setNotasRecup(e.target.value)}
                        rows={2}
                        placeholder="Observaciones sobre la recuperación…"
                        className="w-full px-4 py-3 rounded-2xl resize-none
                          bg-white dark:bg-white/[0.05]
                          border border-gray-200 dark:border-white/[0.1]
                          text-gray-900 dark:text-white text-sm
                          placeholder-gray-400 dark:placeholder-[#555]
                          focus:outline-none focus:ring-2 focus:ring-primary/40
                          transition-all duration-150"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-gray-100 dark:border-white/[0.07] space-y-3 shrink-0">
              {step === 1 ? (
                <button
                  onClick={handleRegistrarAusencia}
                  disabled={!inscripcionId || !fechaAusencia || savingAusencia}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl
                    bg-primary hover:bg-primary-dark
                    disabled:opacity-50 disabled:cursor-not-allowed
                    text-black font-bold text-sm
                    transition-all duration-150 active:scale-[0.97]
                    shadow-[0_4px_16px_rgba(251,198,8,0.25)] hover:shadow-[0_4px_20px_rgba(251,198,8,0.35)]"
                >
                  {savingAusencia
                    ? <><Loader2 size={16} className="animate-spin" /> Registrando…</>
                    : skipRecup
                      ? 'Registrar ausencia'
                      : <> Registrar y continuar <ChevronRight size={16} /></>
                  }
                </button>
              ) : (
                <>
                  <button
                    onClick={handleAgendarRecuperacion}
                    disabled={!turnoSeleccionado || savingRecup}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl
                      bg-primary hover:bg-primary-dark
                      disabled:opacity-50 disabled:cursor-not-allowed
                      text-black font-bold text-sm
                      transition-all duration-150 active:scale-[0.97]
                      shadow-[0_4px_16px_rgba(251,198,8,0.25)] hover:shadow-[0_4px_20px_rgba(251,198,8,0.35)]"
                  >
                    {savingRecup
                      ? <><Loader2 size={16} className="animate-spin" /> Agendando…</>
                      : <><CalendarCheck2 size={16} /> Confirmar recuperación</>
                    }
                  </button>
                  {mode === 'ausencia' && (
                    <button
                      onClick={handleSaltarRecup}
                      className="w-full px-5 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-[#8A8A9A]
                        hover:bg-gray-50 dark:hover:bg-white/[0.05]
                        border border-gray-100 dark:border-white/[0.06]
                        transition-all duration-150 active:scale-[0.98]"
                    >
                      Omitir por ahora
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
