import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Power, Save, Pencil, Minus, Plus, Trash2, Check, X,
  BookOpen, LayoutList, Dumbbell, Search, ChevronDown,
} from 'lucide-react'
import { plantillasApi } from '../api/plantillas.api'
import type { CreatePlantillaPayload } from '../api/plantillas.api'
import { ejerciciosApi } from '../api/ejercicios.api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { PlantillaRutinaData, PlantillaEjercicioData, TipoDistribucion } from '../types/rutina.types'
import { ROUTES } from '../constants/routes'
import Skeleton from '../components/ui/Skeleton'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoDistribucion, string> = {
  FULL_BODY: 'Full Body', ARM_LEG: 'Arm-Leg', PUSH_PULL: 'Push-Pull', CUSTOM: 'Custom',
}

const TIPO_COLORS: Record<TipoDistribucion, string> = {
  FULL_BODY: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  ARM_LEG:   'bg-purple-500/15 text-purple-400 border-purple-500/25',
  PUSH_PULL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  CUSTOM:    'bg-gray-500/15 text-gray-400 border-gray-500/25',
}

const PATRON_LABELS: Record<string, string> = {
  MOVILIDAD:         'Movilidad',
  RODILLA_DOMINANTE: 'Rodilla dom.',
  CADERA_DOMINANTE:  'Cadera dom.',
  EMPUJE:            'Empuje',
  TRACCION:          'Tracción',
  HIBRIDO:           'Híbrido',
  HOMBROS:           'Hombros',
  CORE:              'Core',
  POTENCIA:          'Potencia',
  PLIO_MI:           'Plio MI',
  PLIO_MS:           'Plio MS',
  ISO_MI:            'Iso MI',
  ISO_MS:            'Iso MS',
  ACCESORIO:         'Accesorio',
  OTROS:             'Otros',
}

const PATRON_OPTIONS = Object.entries(PATRON_LABELS).map(([value, label]) => ({ value, label }))
const EJ_DATALIST = 'pv-ej-catalog'
const glass = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'

// Colores por bloque (A, B, C, D, E, F…)
const BLOQUE_COLORS = [
  { bg: 'bg-blue-500/20 dark:bg-blue-500/15',    border: 'border-blue-500/50 dark:border-blue-400/30',    text: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-emerald-500/20 dark:bg-emerald-500/15', border: 'border-emerald-500/50 dark:border-emerald-400/30', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-violet-500/20 dark:bg-violet-500/15', border: 'border-violet-500/50 dark:border-violet-400/30', text: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-amber-500/20 dark:bg-amber-500/15',   border: 'border-amber-500/50 dark:border-amber-400/30',   text: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-rose-500/20 dark:bg-rose-500/15',     border: 'border-rose-500/50 dark:border-rose-400/30',     text: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-cyan-500/20 dark:bg-cyan-500/15',     border: 'border-cyan-500/50 dark:border-cyan-400/30',     text: 'text-cyan-600 dark:text-cyan-400' },
]
function getBloqueColor(letra: string) {
  return BLOQUE_COLORS[(letra.charCodeAt(0) - 65) % BLOQUE_COLORS.length]
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// ─── buildPayload ─────────────────────────────────────────────────────────────

function buildPayload(p: PlantillaRutinaData): CreatePlantillaPayload {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    cantidadSesiones: p.sesiones.length,
    especializada: p.especializada,
    sesiones: p.sesiones.map(ses => ({
      numero: ses.numero,
      nombre: ses.nombre,
      bloques: ses.bloques.map((bl, j) => ({
        letra: bl.letra,
        orden: j,
        patronMovimiento: bl.patronMovimiento,
        cantidadEjercicios: bl.cantidadEjercicios,
        ejercicios: p.especializada
          ? bl.ejercicios.map((ej, k) => ({
              catalogoId: ej.catalogoId,
              nombre: ej.nombre,
              series: ej.series,
              repeticiones: ej.repeticiones,
              peso: ej.peso,
              rir: ej.rir,
              rpe: ej.rpe,
              notas: ej.notas,
              orden: k,
            }))
          : undefined,
      })),
    })),
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PlantillaViewSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <button
          onClick={onBack}
          className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a ejercicios
        </button>
        <div className="animate-pulse flex flex-col gap-3">
          <Skeleton className="h-9 w-72 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div className={`${glass} overflow-hidden p-5 space-y-2 animate-pulse`}>
        <Skeleton className="h-8 w-full rounded-lg" />
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    </div>
  )
}

// ─── Tipos locales ────────────────────────────────────────────────────────────

type EjEdit = { nombre: string; series: string; repeticiones: string; peso: string; rir: string }

// ─── Página ───────────────────────────────────────────────────────────────────

const EMPTY_DRAFT: PlantillaRutinaData = {
  id: '', nombre: '', tipo: 'CUSTOM' as TipoDistribucion,
  cantidadSesiones: 0, activa: true, especializada: false, sesiones: [],
}

export default function PlantillaViewPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const addToast = useUiStore(s => s.addToast)
  const isAdmin  = user?.role === 'admin'
  const isNew    = !id || id === 'new'

  const [draft, setDraft]           = useState<PlantillaRutinaData | null>(() => isNew ? { ...EMPTY_DRAFT } : null)
  const [loading, setLoading]       = useState(!isNew)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [toggling, setToggling]     = useState(false)
  const [catalog, setCatalog]       = useState<{ id: string; nombre: string }[]>([])

  // ── Wizard (isNew) ────────────────────────────────────────────────────────
  const [expandedEjKey, setExpandedEjKey] = useState<string | null>(null)
  const [step, setStep]                 = useState(1)
  const [wizardSesCount, setWizardSesCount] = useState(3)
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  function wizardNext() {
    if (step === 1) {
      if (!draft?.nombre.trim()) { addToast('El nombre es requerido', 'error'); return }
      const sesiones = Array.from({ length: wizardSesCount }, (_, i) => ({
        id: uid(), numero: i + 1, nombre: undefined,
        bloques: [{ id: uid(), letra: 'A', orden: 0, patronMovimiento: PATRON_OPTIONS[0].value, cantidadEjercicios: 3, ejercicios: [] }],
      }))
      setDraft(prev => prev ? { ...prev, sesiones, cantidadSesiones: wizardSesCount } : prev)
      setStep(2)
      return
    }
    if (step === 2) {
      if (draft?.especializada) {
        if (catalog.length === 0) ejerciciosApi.getAll().then(ejs => setCatalog(ejs.map(e => ({ id: e.id, nombre: e.nombre }))))
        setStep(3)
      } else {
        handleSave()
      }
    }
    if (step === 3) handleSave()
  }

  function wizardBack() { setStep(s => Math.max(1, s - 1)) }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [renamingSesionId, setRenamingSesionId] = useState<string | null>(null)
  const [renameVal, setRenameVal]               = useState('')
  const [renamingBloqueKey, setRenamingBloqueKey] = useState<string | null>(null) // "sesId:blId"
  const [bloqueLetraVal, setBloqueLetraVal]       = useState('')
  const [addingBloqueToSesId, setAddingBloqueToSesId] = useState<string | null>(null)
  const [pendingPatron, setPendingPatron]               = useState(PATRON_OPTIONS[0].value)
  const [addingEjKey, setAddingEjKey] = useState<string | null>(null)  // "sesId:blId"
  const [newEjNombre, setNewEjNombre] = useState('')
  const [editingEjKey, setEditingEjKey] = useState<string | null>(null) // "sesId:blId:ejId"
  const [ejEdit, setEjEdit]             = useState<EjEdit>({ nombre: '', series: '', repeticiones: '', peso: '', rir: '' })

  useEffect(() => {
    if (isNew || !id) return
    setLoading(true)
    plantillasApi.getById(id)
      .then(data => {
        setDraft(JSON.parse(JSON.stringify(data)))
        if (data.especializada) {
          ejerciciosApi.getAll().then(ejs => setCatalog(ejs.map(e => ({ id: e.id, nombre: e.nombre }))))
        }
      })
      .catch(() => { addToast('Plantilla no encontrada', 'error'); navigate(ROUTES.EXERCISES) })
      .finally(() => setLoading(false))
  }, [id, isNew, addToast, navigate])

  // ── Guardar / Toggle ──────────────────────────────────────────────────────

  async function handleSave() {
    if (!draft) return
    if (!draft.nombre.trim()) { addToast('El nombre es requerido', 'error'); return }
    setSaving(true)
    try {
      if (isNew) {
        const created = await plantillasApi.create(buildPayload(draft))
        addToast('Plantilla creada', 'success')
        navigate(`/plantillas/${created.id}`, { replace: true })
      } else {
        const updated = await plantillasApi.update(id!, buildPayload(draft))
        setDraft(JSON.parse(JSON.stringify(updated)))
        setHasChanges(false)
        addToast('Plantilla guardada', 'success')
      }
    } catch {
      addToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!draft || !id) return
    setToggling(true)
    try {
      const updated = await plantillasApi.toggle(id)
      setDraft(prev => prev ? { ...prev, activa: updated.activa } : prev)
      addToast(updated.activa ? 'Plantilla activada' : 'Plantilla desactivada', 'success')
    } catch {
      addToast('Error al cambiar estado', 'error')
    } finally {
      setToggling(false)
    }
  }

  // ── Mutators helper ───────────────────────────────────────────────────────

  function mut(fn: (p: PlantillaRutinaData) => PlantillaRutinaData) {
    setDraft(prev => prev ? fn(prev) : prev)
    setHasChanges(true)
  }

  // ── Sesiones ──────────────────────────────────────────────────────────────

  function addSesion() {
    mut(prev => {
      const nextNum = prev.sesiones.length > 0 ? Math.max(...prev.sesiones.map(s => s.numero)) + 1 : 1
      const bloqueInicial = { id: uid(), letra: 'A', orden: 0, patronMovimiento: PATRON_OPTIONS[0].value, cantidadEjercicios: 3, ejercicios: [] }
      return { ...prev, cantidadSesiones: prev.sesiones.length + 1, sesiones: [...prev.sesiones, { id: uid(), numero: nextNum, nombre: undefined, bloques: [bloqueInicial] }] }
    })
  }

  function deleteSesion(sesionId: string) {
    mut(prev => {
      const updated = prev.sesiones.filter(s => s.id !== sesionId)
      return { ...prev, cantidadSesiones: updated.length, sesiones: updated }
    })
  }

  function renameSesion(sesionId: string, nombre: string) {
    mut(prev => ({ ...prev, sesiones: prev.sesiones.map(s => s.id === sesionId ? { ...s, nombre: nombre.trim() || undefined } : s) }))
    setRenamingSesionId(null)
  }

  // ── Bloques ───────────────────────────────────────────────────────────────

  function addBloque(sesionId: string) {
    mut(prev => ({
      ...prev,
      sesiones: prev.sesiones.map(ses => {
        if (ses.id !== sesionId) return ses
        const letra = String.fromCharCode(65 + ses.bloques.length)
        return { ...ses, bloques: [...ses.bloques, { id: uid(), letra, orden: ses.bloques.length, patronMovimiento: pendingPatron, cantidadEjercicios: 3, ejercicios: [] }] }
      }),
    }))
    setAddingBloqueToSesId(null)
    setPendingPatron(PATRON_OPTIONS[0].value)
  }

  function deleteBloque(sesionId: string, bloqueId: string) {
    mut(prev => ({
      ...prev,
      sesiones: prev.sesiones.map(ses => {
        if (ses.id !== sesionId) return ses
        const updated = ses.bloques.filter(b => b.id !== bloqueId)
        return { ...ses, bloques: updated.map((b, i) => ({ ...b, letra: String.fromCharCode(65 + i) })) }
      }),
    }))
  }

  function renameBloque(sesionId: string, bloqueId: string, letra: string) {
    const val = letra.trim().slice(0, 3).toUpperCase()
    if (!val) return
    mut(prev => ({ ...prev, sesiones: prev.sesiones.map(ses => ses.id !== sesionId ? ses : { ...ses, bloques: ses.bloques.map(bl => bl.id !== bloqueId ? bl : { ...bl, letra: val }) }) }))
    setRenamingBloqueKey(null)
  }

  function updateBloquePatron(sesionId: string, bloqueId: string, patron: string) {
    mut(prev => ({ ...prev, sesiones: prev.sesiones.map(ses => ses.id !== sesionId ? ses : { ...ses, bloques: ses.bloques.map(bl => bl.id !== bloqueId ? bl : { ...bl, patronMovimiento: patron }) }) }))
  }

  function updateCantidad(sesionId: string, bloqueId: string, delta: number) {
    mut(prev => ({ ...prev, sesiones: prev.sesiones.map(ses => ses.id !== sesionId ? ses : { ...ses, bloques: ses.bloques.map(bl => bl.id !== bloqueId ? bl : { ...bl, cantidadEjercicios: Math.max(1, Math.min(10, bl.cantidadEjercicios + delta)) }) }) }))
  }

  // ── Update campo ejercicio (wizard paso 3) ────────────────────────────────

  function updateEjField(sesId: string, blId: string, ejId: string, field: string, value: string | number | undefined) {
    mut(prev => ({
      ...prev,
      sesiones: prev.sesiones.map(ses => ses.id !== sesId ? ses : {
        ...ses,
        bloques: ses.bloques.map(bl => bl.id !== blId ? bl : {
          ...bl,
          ejercicios: bl.ejercicios.map(ej => ej.id !== ejId ? ej : { ...ej, [field]: value }),
        }),
      }),
    }))
  }

  // ── Ejercicios (especializada) ────────────────────────────────────────────

  function addEjercicio(sesionId: string, bloqueId: string) {
    const nombre = newEjNombre.trim()
    if (!nombre) return
    const match = catalog.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
    mut(prev => ({
      ...prev,
      sesiones: prev.sesiones.map(ses => ses.id !== sesionId ? ses : {
        ...ses,
        bloques: ses.bloques.map(bl => bl.id !== bloqueId ? bl : {
          ...bl,
          cantidadEjercicios: bl.ejercicios.length + 1,
          ejercicios: [...bl.ejercicios, { id: uid(), nombre: match?.nombre ?? nombre, catalogoId: match?.id, orden: bl.ejercicios.length, series: undefined, repeticiones: undefined, peso: undefined, rir: undefined }],
        }),
      }),
    }))
    setNewEjNombre('')
    setAddingEjKey(null)
  }

  function deleteEjercicio(sesionId: string, bloqueId: string, ejId: string) {
    mut(prev => ({
      ...prev,
      sesiones: prev.sesiones.map(ses => ses.id !== sesionId ? ses : {
        ...ses,
        bloques: ses.bloques.map(bl => bl.id !== bloqueId ? bl : {
          ...bl,
          cantidadEjercicios: Math.max(0, bl.ejercicios.length - 1),
          ejercicios: bl.ejercicios.filter(e => e.id !== ejId).map((e, i) => ({ ...e, orden: i })),
        }),
      }),
    }))
    if (editingEjKey?.includes(ejId)) setEditingEjKey(null)
  }

  function startEditEj(sesionId: string, bloqueId: string, ej: PlantillaEjercicioData) {
    setEditingEjKey(`${sesionId}:${bloqueId}:${ej.id}`)
    setEjEdit({ nombre: ej.nombre, series: ej.series != null ? String(ej.series) : '', repeticiones: ej.repeticiones ?? '', peso: ej.peso ?? '', rir: ej.rir != null ? String(ej.rir) : '' })
  }

  function saveEditEj(sesionId: string, bloqueId: string, ejId: string) {
    const nombre = ejEdit.nombre.trim()
    if (!nombre) return
    const match = catalog.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
    mut(prev => ({
      ...prev,
      sesiones: prev.sesiones.map(ses => ses.id !== sesionId ? ses : {
        ...ses,
        bloques: ses.bloques.map(bl => bl.id !== bloqueId ? bl : {
          ...bl,
          ejercicios: bl.ejercicios.map(e => e.id !== ejId ? e : {
            ...e,
            nombre: match?.nombre ?? nombre,
            catalogoId: match?.id ?? e.catalogoId,
            series: ejEdit.series ? Number(ejEdit.series) : undefined,
            repeticiones: ejEdit.repeticiones || undefined,
            peso: ejEdit.peso || undefined,
            rir: ejEdit.rir ? Number(ejEdit.rir) : undefined,
          }),
        }),
      }),
    }))
    setEditingEjKey(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <PlantillaViewSkeleton onBack={() => navigate(ROUTES.EXERCISES)} />
  if (!draft)  return null

  // ── Wizard (nueva plantilla) ───────────────────────────────────────────────
  if (isNew) {
    const totalSteps = draft.especializada ? 3 : 2

    const WIZARD_STEPS = [
      { id: 1, label: 'Datos básicos' },
      { id: 2, label: 'Estructura' },
      ...(draft.especializada ? [{ id: 3, label: 'Ejercicios' }] : []),
    ]

    const STEP_META: Record<number, { Icon: typeof BookOpen; title: string; description: string }> = {
      1: { Icon: BookOpen,    title: 'Datos básicos',         description: 'Definí el nombre, tipo y especialidad de la plantilla.' },
      2: { Icon: LayoutList,  title: 'Estructura de sesiones', description: 'Configurá los bloques y cantidad de ejercicios por sesión.' },
      3: { Icon: Dumbbell,    title: 'Ejercicios',             description: 'Asigná ejercicios específicos con series y repeticiones a cada bloque.' },
    }

    const wIc = [
      'w-full rounded-xl py-3 px-4 text-sm transition-all duration-200',
      'bg-gray-50 dark:bg-white/[0.05]',
      'border border-gray-200 dark:border-white/[0.08]',
      'text-gray-900 dark:text-white',
      'placeholder:text-gray-400 dark:placeholder:text-white/30',
      'focus:outline-none focus:bg-white dark:focus:bg-white/[0.08]',
      'focus:border-primary/50 focus:ring-2 focus:ring-primary/10',
      'hover:border-gray-300 dark:hover:border-white/[0.14]',
    ].join(' ')

    const meta = STEP_META[step]

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex flex-col gap-6">
        <style>{`:root { --line-inactive: rgba(0,0,0,0.10); } .dark { --line-inactive: rgba(255,255,255,0.06); }`}</style>

        {/* Back */}
        <button onClick={() => navigate(ROUTES.EXERCISES)} className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a ejercicios
        </button>

        {/* Título */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tighter text-gray-900 dark:text-white">Nueva plantilla</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Completá los pasos para crear la plantilla de rutina.</p>
        </div>

        {/* Card de contenido — stepper adentro */}
        <div className={`${glass} p-6`}>

          {/* Stepper — mismo diseño que CreateClientPage */}
          <div className="flex items-start mb-8">
            {WIZARD_STEPS.map((s, idx) => {
              const done = step > s.id
              const curr = step === s.id
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center relative">
                  {idx > 0 && (
                    <div className="absolute z-10 h-px top-[20px] -translate-y-1/2" style={{
                      left: 0, right: '50%',
                      background: done || curr
                        ? 'linear-gradient(90deg, rgba(251,198,8,0.25), rgba(251,198,8,0.7))'
                        : 'var(--line-inactive)',
                    }} />
                  )}
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div className="absolute z-10 h-px top-[20px] -translate-y-1/2" style={{
                      left: '50%', right: 0,
                      background: done
                        ? 'linear-gradient(90deg, rgba(251,198,8,0.7), rgba(251,198,8,0.25))'
                        : 'var(--line-inactive)',
                    }} />
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
                  <div className="mt-2 flex flex-col items-center">
                    <span className={[
                      'text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
                      curr  ? 'text-gray-900 dark:text-white'
                      : done ? 'text-primary'
                             : 'text-gray-400 dark:text-[#4A4A5A]',
                    ].join(' ')}>{s.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Step header */}
          {meta && (
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20 dark:border-primary/15">
                <meta.Icon size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{meta.title}</h2>
                <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">{meta.description}</p>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-[#3A3A4A]">
                  Paso {step}/{totalSteps}
                </span>
              </div>
            </div>
          )}

          {/* ── Paso 1: Datos básicos ── */}
          {step === 1 && (
            <div className="space-y-6">

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] flex items-center gap-1">
                  Nombre <span className="text-primary text-[10px]">*</span>
                </label>
                <input
                  autoFocus
                  value={draft.nombre}
                  onChange={e => setDraft(prev => prev ? { ...prev, nombre: e.target.value } : prev)}
                  placeholder="Ej: Full Body 3 días…"
                  onKeyDown={e => e.key === 'Enter' && wizardNext()}
                  className={wIc}
                />
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Tipo de distribución</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.entries(TIPO_LABELS) as [TipoDistribucion, string][]).map(([k, v]) => {
                    const sel = draft.tipo === k
                    return (
                      <button key={k} type="button" onClick={() => setDraft(prev => prev ? { ...prev, tipo: k } : prev)}
                        className={[
                          'relative text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden w-full',
                          sel
                            ? 'border-primary/50 dark:border-primary/40 bg-gradient-to-br from-[rgba(251,198,8,0.10)] via-[rgba(251,198,8,0.04)] to-transparent dark:from-[rgba(251,198,8,0.08)] dark:via-[rgba(251,198,8,0.03)] dark:to-transparent shadow-[0_4px_24px_rgba(251,198,8,0.12)]'
                            : 'border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-white/70 dark:hover:border-white/[0.16] hover:bg-white/60 dark:hover:bg-white/[0.07]',
                        ].join(' ')}>
                        {sel && (
                          <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary shadow-[0_2px_8px_rgba(251,198,8,0.4)]">
                            <Check size={11} strokeWidth={3} className="text-black" />
                          </span>
                        )}
                        <span className={`text-sm font-bold ${sel ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/50'}`}>{v}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Especialidad */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Especialidad</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: false, label: 'Básica',        desc: 'Solo estructura de bloques. Los ejercicios se asignan al crear la rutina.' },
                    { value: true,  label: 'Especializada',    desc: 'Definís los ejercicios exactos con series, repeticiones y peso.' },
                  ].map(opt => {
                    const sel = draft.especializada === opt.value
                    return (
                      <button key={String(opt.value)} type="button" onClick={() => setDraft(prev => prev ? { ...prev, especializada: opt.value } : prev)}
                        className={[
                          'relative text-left rounded-2xl border p-4 transition-all duration-200 overflow-hidden w-full',
                          sel
                            ? 'border-primary/50 dark:border-primary/40 bg-gradient-to-br from-[rgba(251,198,8,0.10)] via-[rgba(251,198,8,0.04)] to-transparent dark:from-[rgba(251,198,8,0.08)] dark:via-[rgba(251,198,8,0.03)] dark:to-transparent shadow-[0_4px_24px_rgba(251,198,8,0.12)]'
                            : 'border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-white/70 dark:hover:border-white/[0.16] hover:bg-white/60 dark:hover:bg-white/[0.07]',
                        ].join(' ')}>
                        {sel && (
                          <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary shadow-[0_2px_8px_rgba(251,198,8,0.4)]">
                            <Check size={11} strokeWidth={3} className="text-black" />
                          </span>
                        )}
                        <p className={`text-sm font-bold mb-1 ${sel ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/50'}`}>{opt.label}</p>
                        <p className="text-[11px] text-gray-400 dark:text-white/30 leading-relaxed">{opt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Cantidad de sesiones */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A]">Sesiones por semana</label>
                <div className="flex items-center justify-center gap-6 py-4">
                  <button onClick={() => setWizardSesCount(n => Math.max(1, n - 1))} disabled={wizardSesCount <= 1}
                    className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20 bg-gray-50 dark:bg-white/[0.04] transition-all disabled:opacity-30">
                    <Minus size={16} />
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="tabular-nums text-3xl font-black text-gray-900 dark:text-white leading-none">{wizardSesCount}</span>
                    <span className="text-[10px] text-gray-400 dark:text-white/30 mt-1 uppercase tracking-wider">{wizardSesCount === 1 ? 'sesión' : 'sesiones'}</span>
                  </div>
                  <button onClick={() => setWizardSesCount(n => Math.min(7, n + 1))} disabled={wizardSesCount >= 7}
                    className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20 bg-gray-50 dark:bg-white/[0.04] transition-all disabled:opacity-30">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 2: Estructura de bloques ── */}
          {step === 2 && (
            <div className="space-y-5">
              {draft.sesiones.map((ses, sesIdx) => (
                <div key={ses.id}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">Sesión {ses.numero}</p>
                  <div className="space-y-2">
                    {ses.bloques.map((bl) => {
                      const col = getBloqueColor(bl.letra)
                      return (
                        <div key={bl.id} className="flex items-center gap-3 rounded-2xl border border-white/50 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                          <div className={`w-9 h-9 rounded-xl ${col.bg} border ${col.border} ${col.text} text-sm font-black flex items-center justify-center shrink-0`}>{bl.letra}</div>
                          <select value={bl.patronMovimiento} onChange={e => updateBloquePatron(ses.id, bl.id, e.target.value)}
                            className="flex-1 rounded-xl py-2 px-3 text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-white/70 font-medium cursor-pointer focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all">
                            {PATRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-gray-400 dark:text-white/25 font-semibold uppercase tracking-wider hidden sm:block">Ejercicios</span>
                            <button onClick={() => updateCantidad(ses.id, bl.id, -1)} disabled={bl.cantidadEjercicios <= 1}
                              className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white bg-white/60 dark:bg-white/[0.04] disabled:opacity-30 transition-all">
                              <Minus size={11} />
                            </button>
                            <span className="tabular-nums text-base font-black text-gray-700 dark:text-white/80 w-6 text-center">{bl.cantidadEjercicios}</span>
                            <button onClick={() => updateCantidad(ses.id, bl.id, 1)} disabled={bl.cantidadEjercicios >= 10}
                              className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white bg-white/60 dark:bg-white/[0.04] disabled:opacity-30 transition-all">
                              <Plus size={11} />
                            </button>
                          </div>
                          {ses.bloques.length > 1 && (
                            <button onClick={() => deleteBloque(ses.id, bl.id)} className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <button onClick={() => {
                      const letra = String.fromCharCode(65 + ses.bloques.length)
                      mut(prev => ({ ...prev, sesiones: prev.sesiones.map(s => s.id !== ses.id ? s : { ...s, bloques: [...s.bloques, { id: uid(), letra, orden: s.bloques.length, patronMovimiento: PATRON_OPTIONS[0].value, cantidadEjercicios: 3, ejercicios: [] }] }) }))
                    }} className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-white/25 hover:text-primary dark:hover:text-primary transition-colors mt-1 ml-1">
                      <Plus size={12} /> Agregar bloque
                    </button>
                  </div>
                  {sesIdx < draft.sesiones.length - 1 && <div className="border-t border-gray-100 dark:border-white/[0.06] mt-5" />}
                </div>
              ))}
            </div>
          )}

          {/* ── Paso 3: Ejercicios (especializada) ── */}
          {step === 3 && (() => {
            const rIc = 'w-full rounded-xl border border-white/50 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors'
            const rLbl = 'block text-[10px] font-bold text-gray-500 dark:text-[#8A8A9A] mb-1 uppercase tracking-wider'
            return (
              <div className="space-y-6">
                {draft.sesiones.map((ses, sesIdx) => (
                  <div key={ses.id}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#6A6A7A] mb-3">Sesión {ses.numero}</p>
                    <div className="space-y-3">
                      {ses.bloques.map((bl) => {
                        const col = getBloqueColor(bl.letra)
                        const aejKey = `${ses.id}:${bl.id}`
                        const q = addingEjKey === aejKey ? newEjNombre : ''
                        const results = q.trim() ? catalog.filter(c => c.nombre.toLowerCase().startsWith(q.toLowerCase())).slice(0, 8) : []
                        return (
                          <div key={bl.id} className="rounded-2xl border border-white/50 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                            {/* Bloque header */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                              <div className={`w-8 h-8 rounded-xl ${col.bg} border ${col.border} ${col.text} text-xs font-black flex items-center justify-center shrink-0`}>{bl.letra}</div>
                              <span className="text-xs font-semibold text-gray-500 dark:text-white/40">{PATRON_LABELS[bl.patronMovimiento] ?? bl.patronMovimiento}</span>
                            </div>
                            {/* Ejercicios */}
                            <div className="px-4 py-3 space-y-2">
                              {bl.ejercicios.map(ej => {
                                const ejKey = `${ses.id}:${bl.id}:${ej.id}`
                                const isExpanded = expandedEjKey === ejKey
                                return (
                                  <div key={ej.id} className="rounded-xl border border-white/[0.08] dark:border-white/[0.08] bg-white/[0.06] dark:bg-white/[0.03] overflow-hidden">
                                    {/* Fila colapsada */}
                                    <button type="button" onClick={() => setExpandedEjKey(isExpanded ? null : ejKey)}
                                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] dark:hover:bg-white/[0.03] transition-colors">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ej.nombre}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {ej.series != null && <span className="text-[10px] text-gray-500 dark:text-white/30 tabular-nums">{ej.series}×{ej.repeticiones ?? '—'}</span>}
                                        <button type="button" onClick={e => { e.stopPropagation(); deleteEjercicio(ses.id, bl.id, ej.id) }}
                                          className="p-1 rounded-lg text-gray-400 dark:text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                          <Trash2 size={12} />
                                        </button>
                                        <ChevronDown size={12} className={`text-gray-400 dark:text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                      </div>
                                    </button>
                                    {/* Panel expandido */}
                                    <AnimatePresence initial={false}>
                                      {isExpanded && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                          <div className="px-3 pb-3 border-t border-white/[0.06] space-y-2">
                                            <div className="grid grid-cols-3 gap-2 pt-2">
                                              <div>
                                                <label className={rLbl}>Series</label>
                                                <input type="number" min={1} value={ej.series ?? ''} onChange={e => updateEjField(ses.id, bl.id, ej.id, 'series', e.target.value ? Number(e.target.value) : undefined)} className={rIc} placeholder="4" />
                                              </div>
                                              <div>
                                                <label className={rLbl}>Reps</label>
                                                <input value={ej.repeticiones ?? ''} onChange={e => updateEjField(ses.id, bl.id, ej.id, 'repeticiones', e.target.value || undefined)} className={rIc} placeholder="8-12" />
                                              </div>
                                              <div>
                                                <label className={rLbl}>Peso (kg)</label>
                                                <input value={ej.peso ?? ''} onChange={e => updateEjField(ses.id, bl.id, ej.id, 'peso', e.target.value || undefined)} className={rIc} placeholder="60" />
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className={rLbl}>RIR</label>
                                                <input type="number" min={0} max={5} value={ej.rir ?? ''} onChange={e => updateEjField(ses.id, bl.id, ej.id, 'rir', e.target.value ? Number(e.target.value) : undefined)} className={rIc} placeholder="2" />
                                              </div>
                                              <div>
                                                <label className={rLbl}>Notas</label>
                                                <input value={ej.notas ?? ''} onChange={e => updateEjField(ses.id, bl.id, ej.id, 'notas', e.target.value || undefined)} className={rIc} placeholder="Indicaciones…" />
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )
                              })}
                              {/* Buscador con dropdown — mismo patrón que CreateRutinaPage */}
                              <div className="space-y-1.5 pt-1">
                                <div className="relative">
                                  <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" />
                                  <input
                                    value={q}
                                    onFocus={() => setAddingEjKey(aejKey)}
                                    onChange={e => { setAddingEjKey(aejKey); setNewEjNombre(e.target.value) }}
                                    placeholder="Buscar ejercicio…"
                                    onKeyDown={e => { if (e.key === 'Escape') { setAddingEjKey(null); setNewEjNombre('') } }}
                                    className="w-full rounded-xl py-2.5 pl-8 pr-3 text-sm bg-white/60 dark:bg-white/[0.05] border border-white/50 dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors"
                                  />
                                </div>
                                {addingEjKey === aejKey && q.trim() && (
                                  <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1A1A1A] overflow-hidden shadow-lg max-h-52 overflow-y-auto">
                                    {results.length === 0 ? (
                                      <p className="px-3 py-3 text-sm text-gray-400 dark:text-white/30">Sin resultados para &ldquo;{q}&rdquo;</p>
                                    ) : results.map(item => (
                                      <button key={item.id} type="button"
                                        onClick={() => {
                                          const newEj = { id: uid(), nombre: item.nombre, catalogoId: item.id, orden: bl.ejercicios.length, series: undefined, repeticiones: undefined, peso: undefined, rir: undefined }
                                          mut(prev => ({ ...prev, sesiones: prev.sesiones.map(s => s.id !== ses.id ? s : { ...s, bloques: s.bloques.map(b => b.id !== bl.id ? b : { ...b, cantidadEjercicios: b.ejercicios.length + 1, ejercicios: [...b.ejercicios, newEj] }) }) }))
                                          setExpandedEjKey(`${ses.id}:${bl.id}:${newEj.id}`)
                                          setNewEjNombre('')
                                          setAddingEjKey(null)
                                        }}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] border-b border-gray-50 dark:border-white/[0.03] last:border-0 transition-colors"
                                      >
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.nombre}</p>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {sesIdx < draft.sesiones.length - 1 && <div className="border-t border-gray-100 dark:border-white/[0.06] mt-2" />}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Botones de navegación */}
        <div className="flex items-center justify-between pt-2">
          <button onClick={step === 1 ? () => navigate(ROUTES.EXERCISES) : wizardBack}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.04] hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all">
            <ArrowLeft size={14} />{step === 1 ? 'Cancelar' : 'Anterior'}
          </button>
          <button onClick={wizardNext} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary text-black px-6 py-2.5 text-sm font-black disabled:opacity-40 hover:bg-primary-dark transition-all shadow-[0_4px_16px_rgba(251,198,8,0.3)] hover:shadow-[0_6px_20px_rgba(251,198,8,0.4)]">
            {saving ? 'Creando...' : (step < totalSteps ? 'Siguiente →' : 'Crear plantilla')}
          </button>
        </div>
      </motion.div>
    )
  }

  const COLS = draft.especializada ? 9 : 4
  const inp  = 'w-full bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.12] rounded-lg px-1.5 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors'
  const addBtnCls = 'flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/25 hover:text-primary dark:hover:text-primary transition-colors'

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <button onClick={() => hasChanges ? setShowDiscardModal(true) : navigate(ROUTES.EXERCISES)} className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a ejercicios
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tighter text-gray-900 dark:text-white">{draft.nombre}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-xl border backdrop-blur-xl px-3 py-1 text-[11px] font-bold shadow-sm ${
                draft.tipo === 'FULL_BODY'  ? 'bg-blue-500/25 text-blue-600 dark:text-blue-400 border-blue-500/40' :
                draft.tipo === 'ARM_LEG'   ? 'bg-purple-500/25 text-purple-600 dark:text-purple-400 border-purple-500/40' :
                draft.tipo === 'PUSH_PULL' ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/40' :
                                             'bg-gray-500/25 text-gray-600 dark:text-gray-400 border-gray-500/40'
              }`}>
                {TIPO_LABELS[draft.tipo]}
              </span>
              <span className={`inline-flex items-center rounded-xl border backdrop-blur-xl px-3 py-1 text-[11px] font-bold shadow-sm ${
                draft.especializada
                  ? 'bg-primary/40 dark:bg-primary/25 text-amber-800 dark:text-primary border-primary/60'
                  : 'bg-gray-500/25 text-gray-600 dark:text-gray-400 border-gray-500/40'
              }`}>
                {draft.especializada ? 'Especializada' : 'Básica'}
              </span>
              <span className="inline-flex items-center rounded-xl border backdrop-blur-xl px-3 py-1 text-[11px] font-bold shadow-sm bg-white/30 dark:bg-black/30 border-white/50 dark:border-white/10 text-gray-600 dark:text-white/60">
                {draft.cantidadSesiones} {draft.cantidadSesiones === 1 ? 'sesión' : 'sesiones'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && hasChanges && (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-primary text-black px-3 py-2 text-xs font-semibold disabled:opacity-40">
                <Save size={12} />{saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
            {isAdmin && (
              <button onClick={handleToggle} disabled={toggling} className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/[0.08] px-3 py-2 text-xs text-gray-500 dark:text-white/40 hover:text-amber-500 hover:border-amber-500/30 transition-colors disabled:opacity-40">
                <Power size={12} />{draft.activa ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal descartar cambios ────────────────────────────────────────── */}
      {createPortal(
      <AnimatePresence>
        {showDiscardModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowDiscardModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/50 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-6 shadow-2xl"
            >
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">¿Descartár los cambios?</h3>
              <p className="text-sm text-gray-500 dark:text-white/40 mb-6">Tenés cambios sin guardar. Si volvés ahora los perdés.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscardModal(false)}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-black text-black hover:bg-primary-dark transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => navigate(ROUTES.EXERCISES)}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-black text-white hover:bg-red-600 transition-colors"
                >
                  Descartar y volver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className={`${glass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">

            {draft.especializada && (
              <datalist id={EJ_DATALIST}>
                {catalog.map(c => <option key={c.id} value={c.nombre} />)}
              </datalist>
            )}

            {/* Encabezados */}
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/25 backdrop-blur-sm">
                <th className="px-8 py-3.5 text-left text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[110px]">Sesión</th>
                <th className="px-7 py-3.5 text-left text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[60px]">Bloque</th>
                <th className="px-7 py-3.5 text-left text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[130px]">Patrón</th>
                {draft.especializada ? (
                  <>
                    <th className="px-8 py-3.5 text-left text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">Ejercicio</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[52px]">Ser.</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[72px]">Reps</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[72px]">Peso</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest w-[52px]">RIR</th>
                    <th className="w-[56px]" />
                  </>
                ) : (
                  <th className="px-8 py-3.5 text-left text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">Cant. ejercicios</th>
                )}
              </tr>
            </thead>

            <tbody>
              {draft.sesiones.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="py-16 text-center text-sm text-gray-400 dark:text-white/30">
                    Sin sesiones.{isAdmin && ' Usá el botón de abajo para agregar la primera.'}
                  </td>
                </tr>
              ) : (
                draft.sesiones.flatMap((ses, sesIdx) => {
                  let sesShown = false
                  const rows: JSX.Element[] = []

                  const semBorder = (blIdx: number) =>
                    blIdx === 0 && sesIdx > 0 ? 'border-t-2 border-white/20 dark:border-white/[0.12]'
                    : blIdx > 0 ? 'border-t border-white/10 dark:border-white/[0.05]'
                    : ''

                  const sesCell = (key: string) => {
                    const shown = sesShown; sesShown = true
                    if (shown) return <td key={`sc-${key}`} className="w-[110px] px-8 py-4" />
                    const label = ses.nombre?.trim() ? ses.nombre : `Sesión ${ses.numero}`
                    const isRenaming = renamingSesionId === ses.id
                    return (
                      <td key={`sc-${key}`} className="px-8 py-4 w-[110px] align-top">
                        {isRenaming ? (
                          <form onSubmit={e => { e.preventDefault(); renameSesion(ses.id, renameVal) }} className="flex items-center gap-1">
                            <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)} placeholder={`Sesión ${ses.numero}`}
                              className="w-20 bg-white dark:bg-white/[0.08] border border-primary/40 rounded-md px-1.5 py-0.5 text-[11px] text-gray-900 dark:text-white focus:outline-none" />
                            <button type="submit" className="p-0.5 text-primary shrink-0"><Check size={11} /></button>
                            <button type="button" onClick={() => setRenamingSesionId(null)} className="p-0.5 text-gray-400 dark:text-white/30 shrink-0"><X size={11} /></button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-1 group/ses">
                            <span onClick={isAdmin ? () => { setRenameVal(ses.nombre ?? ''); setRenamingSesionId(ses.id) } : undefined}
                              title={isAdmin ? 'Click para renombrar' : undefined}
                              className={`px-3 py-1 bg-gray-800/10 dark:bg-white/[0.08] border border-gray-300 dark:border-white/20 rounded-lg text-gray-700 dark:text-white/80 text-[11px] font-bold whitespace-nowrap ${isAdmin ? 'cursor-pointer hover:bg-gray-800/15 dark:hover:bg-white/[0.12] transition-colors' : ''}`}>
                              {label}
                            </span>
                            {isAdmin && <>
                              <button onClick={() => { setRenameVal(ses.nombre ?? ''); setRenamingSesionId(ses.id) }}
                                className="p-1 text-gray-300 dark:text-white/20 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover/ses:opacity-100 transition-all shrink-0"><Pencil size={13} /></button>
                              <button onClick={() => deleteSesion(ses.id)}
                                className="p-1 text-gray-300 dark:text-white/20 hover:text-red-400 opacity-0 group-hover/ses:opacity-100 transition-all shrink-0"><X size={13} /></button>
                            </>}
                          </div>
                        )}
                      </td>
                    )
                  }

                  if (!draft.especializada) {
                    // ── BÁSICA ──────────────────────────────────────────────
                    if (ses.bloques.length === 0 && !isAdmin) {
                      rows.push(
                        <tr key={`${ses.id}-nb`} className={sesIdx > 0 ? 'border-t-2 border-white/20 dark:border-white/[0.12]' : ''}>
                          {sesCell('nb')}
                          <td colSpan={3} className="px-4 py-3 text-xs text-gray-400 dark:text-white/30 italic">Sin bloques</td>
                        </tr>
                      )
                    }

                    ses.bloques.forEach((bl, blIdx) => {
                      rows.push(
                        <tr key={bl.id} className={`group/row hover:bg-gray-50/40 dark:hover:bg-white/[0.02] transition-colors ${semBorder(blIdx)}`}>
                          {sesCell(bl.id)}
                          <td className="px-7 py-4 align-middle">
                            <div className="flex items-center gap-1.5">
                              {isAdmin && renamingBloqueKey === `${ses.id}:${bl.id}` ? (
                                <form onSubmit={e => { e.preventDefault(); renameBloque(ses.id, bl.id, bloqueLetraVal) }} className="flex items-center gap-1">
                                  <input autoFocus value={bloqueLetraVal} onChange={e => setBloqueLetraVal(e.target.value)} maxLength={3}
                                    className="w-12 text-center bg-white dark:bg-white/[0.08] border border-primary/40 rounded-md px-1 py-0.5 text-xs font-black text-gray-900 dark:text-white focus:outline-none uppercase" />
                                  <button type="submit" className="p-0.5 text-primary shrink-0"><Check size={11} /></button>
                                  <button type="button" onClick={() => setRenamingBloqueKey(null)} className="p-0.5 text-gray-400 dark:text-white/30 shrink-0"><X size={11} /></button>
                                </form>
                              ) : (
                                <>
                                  <div
                                    onClick={isAdmin ? () => { setBloqueLetraVal(bl.letra); setRenamingBloqueKey(`${ses.id}:${bl.id}`) } : undefined}
                                    title={isAdmin ? 'Click para renombrar' : undefined}
                                    className={`w-9 h-9 rounded-xl ${getBloqueColor(bl.letra).bg} border ${getBloqueColor(bl.letra).border} ${getBloqueColor(bl.letra).text} text-sm font-black flex items-center justify-center shrink-0 ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                  >{bl.letra}</div>
                                  {isAdmin && <button onClick={() => deleteBloque(ses.id, bl.id)} className="p-1 text-gray-400 dark:text-white/30 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all shrink-0"><Trash2 size={13} /></button>}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-7 py-4 align-middle">
                            {isAdmin ? (
                              <select value={bl.patronMovimiento} onChange={e => updateBloquePatron(ses.id, bl.id, e.target.value)}
                                className="appearance-none bg-transparent text-xs text-gray-500 dark:text-white/55 font-medium cursor-pointer hover:text-primary dark:hover:text-primary outline-none border-none transition-colors">
                                {PATRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-white/55 font-medium whitespace-nowrap">{PATRON_LABELS[bl.patronMovimiento] ?? bl.patronMovimiento}</span>
                            )}
                          </td>
                          <td className="px-8 py-4 align-middle">
                            {isAdmin ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateCantidad(ses.id, bl.id, -1)} disabled={bl.cantidadEjercicios <= 1}
                                  className="w-6 h-6 rounded-lg border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-30">
                                  <Minus size={10} />
                                </button>
                                <span className="tabular-nums text-sm font-semibold text-gray-700 dark:text-white/70 w-5 text-center select-none">{bl.cantidadEjercicios}</span>
                                <button onClick={() => updateCantidad(ses.id, bl.id, 1)} disabled={bl.cantidadEjercicios >= 10}
                                  className="w-6 h-6 rounded-lg border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-30">
                                  <Plus size={10} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-white/40 tabular-nums">{bl.cantidadEjercicios}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })

                    // Add bloque
                    if (isAdmin) {
                      if (addingBloqueToSesId === ses.id) {
                        rows.push(
                          <tr key={`${ses.id}-abl-f`} className="border-t border-white/10 dark:border-white/[0.05]">
                            <td className="w-[110px]" />
                            <td colSpan={3} className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <select value={pendingPatron} onChange={e => setPendingPatron(e.target.value)}
                                  className="bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.12] rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-white/70 focus:outline-none focus:border-primary/50">
                                  {PATRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <button onClick={() => addBloque(ses.id)} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">Agregar</button>
                                <button onClick={() => setAddingBloqueToSesId(null)} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/[0.1] text-xs text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">Cancelar</button>
                              </div>
                            </td>
                          </tr>
                        )
                      } else {
                        rows.push(
                          <tr key={`${ses.id}-abl`} className="border-t border-white/10 dark:border-white/[0.05]">
                            <td className="w-[110px]" />
                            <td colSpan={3} className="px-4 py-2">
                              <button onClick={() => { setAddingBloqueToSesId(ses.id); setPendingPatron(PATRON_OPTIONS[0].value) }} className={addBtnCls}>
                                <Plus size={11} /> Agregar bloque
                              </button>
                            </td>
                          </tr>
                        )
                      }
                    }

                  } else {
                    // ── ESPECIALIZADA ───────────────────────────────────────
                    ses.bloques.forEach((bl, blIdx) => {
                      let blShown = false

                      const blCell = (key: string) => {
                        const shown = blShown; blShown = true
                        if (shown) return <td key={`bc-${key}`} className="px-7 py-4 w-[60px]" />
                        return (
                          <td key={`bc-${key}`} className="px-7 py-4 w-[60px] align-top">
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isAdmin && renamingBloqueKey === `${ses.id}:${bl.id}` ? (
                                <form onSubmit={e => { e.preventDefault(); renameBloque(ses.id, bl.id, bloqueLetraVal) }} className="flex items-center gap-1">
                                  <input autoFocus value={bloqueLetraVal} onChange={e => setBloqueLetraVal(e.target.value)} maxLength={3}
                                    className="w-12 text-center bg-white dark:bg-white/[0.08] border border-primary/40 rounded-md px-1 py-0.5 text-xs font-black text-gray-900 dark:text-white focus:outline-none uppercase" />
                                  <button type="submit" className="p-0.5 text-primary shrink-0"><Check size={11} /></button>
                                  <button type="button" onClick={() => setRenamingBloqueKey(null)} className="p-0.5 text-gray-400 dark:text-white/30 shrink-0"><X size={11} /></button>
                                </form>
                              ) : (
                                <>
                                  <div
                                    onClick={isAdmin ? () => { setBloqueLetraVal(bl.letra); setRenamingBloqueKey(`${ses.id}:${bl.id}`) } : undefined}
                                    title={isAdmin ? 'Click para renombrar' : undefined}
                                    className={`w-9 h-9 rounded-xl ${getBloqueColor(bl.letra).bg} border ${getBloqueColor(bl.letra).border} ${getBloqueColor(bl.letra).text} text-sm font-black flex items-center justify-center shrink-0 ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                  >{bl.letra}</div>
                                  {isAdmin && <button onClick={() => deleteBloque(ses.id, bl.id)} className="p-1 text-gray-400 dark:text-white/30 hover:text-red-400 opacity-0 group-hover/ejrow:opacity-100 transition-all shrink-0"><Trash2 size={13} /></button>}
                                </>
                              )}
                            </div>
                          </td>
                        )
                      }

                      const patronCell = (key: string, show: boolean) =>
                        !show ? <td key={`pc-${key}`} className="px-7 py-4 w-[130px]" /> : (
                          <td key={`pc-${key}`} className="px-7 py-4 w-[130px] align-top">
                            {isAdmin ? (
                              <select value={bl.patronMovimiento} onChange={e => updateBloquePatron(ses.id, bl.id, e.target.value)}
                                className="appearance-none bg-transparent text-xs text-gray-500 dark:text-white/55 font-medium cursor-pointer hover:text-primary dark:hover:text-primary outline-none border-none transition-colors">
                                {PATRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-white/55 font-medium whitespace-nowrap">{PATRON_LABELS[bl.patronMovimiento] ?? bl.patronMovimiento}</span>
                            )}
                          </td>
                        )

                      // Sin ejercicios (no admin)
                      if (bl.ejercicios.length === 0 && !isAdmin) {
                        rows.push(
                          <tr key={`${bl.id}-ne`} className={semBorder(blIdx)}>
                            {sesCell(bl.id + '-ne')}
                            {blCell(bl.id + '-ne')}
                            {patronCell(bl.id + '-ne', true)}
                            <td colSpan={6} className="px-4 py-3 text-xs text-gray-300 dark:text-white/20 italic">Sin ejercicios</td>
                          </tr>
                        )
                      }

                      // Filas de ejercicios
                      bl.ejercicios.forEach((ej, ejIdx) => {
                        const bc = ejIdx === 0 ? semBorder(blIdx) : 'border-t border-white/10 dark:border-white/[0.04]'
                        const ejKey = `${ses.id}:${bl.id}:${ej.id}`

                        if (editingEjKey === ejKey) {
                          rows.push(
                            <tr key={ejKey + '-ed'} className={`bg-gray-50/60 dark:bg-white/[0.03] ${bc}`}>
                              {sesCell(ej.id + '-ed')}
                              {blCell(ej.id + '-ed')}
                              {patronCell(ej.id + '-ed', ejIdx === 0)}
                              <td className="px-2 py-1.5"><input value={ejEdit.nombre} onChange={e => setEjEdit(p => ({ ...p, nombre: e.target.value }))} list={EJ_DATALIST} placeholder="Nombre" className={inp} autoFocus onKeyDown={e => e.key === 'Escape' && setEditingEjKey(null)} /></td>
                              <td className="px-1 py-1.5"><input value={ejEdit.series} onChange={e => setEjEdit(p => ({ ...p, series: e.target.value }))} placeholder="—" className={`${inp} text-center`} onKeyDown={e => e.key === 'Escape' && setEditingEjKey(null)} /></td>
                              <td className="px-1 py-1.5"><input value={ejEdit.repeticiones} onChange={e => setEjEdit(p => ({ ...p, repeticiones: e.target.value }))} placeholder="—" className={`${inp} text-center`} onKeyDown={e => e.key === 'Escape' && setEditingEjKey(null)} /></td>
                              <td className="px-1 py-1.5"><input value={ejEdit.peso} onChange={e => setEjEdit(p => ({ ...p, peso: e.target.value }))} placeholder="—" className={`${inp} text-center`} onKeyDown={e => e.key === 'Escape' && setEditingEjKey(null)} /></td>
                              <td className="px-1 py-1.5"><input value={ejEdit.rir} onChange={e => setEjEdit(p => ({ ...p, rir: e.target.value }))} placeholder="—" className={`${inp} text-center`} onKeyDown={e => e.key === 'Escape' && setEditingEjKey(null)} /></td>
                              <td className="px-2 py-1.5 w-[56px]">
                                <div className="flex items-center gap-0.5">
                                  <button onClick={() => saveEditEj(ses.id, bl.id, ej.id)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"><Check size={12} /></button>
                                  <button onClick={() => setEditingEjKey(null)} className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:bg-white/[0.06] transition-colors"><X size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        } else {
                          rows.push(
                            <tr key={ej.id} className={`hover:bg-gray-50/40 dark:hover:bg-white/[0.02] transition-colors group/ejrow ${bc}`}>
                              {sesCell(ej.id)}
                              {blCell(ej.id)}
                              {patronCell(ej.id, ejIdx === 0)}
                              <td className="px-8 py-4 align-middle"><span className="text-sm font-medium text-gray-800 dark:text-white/90 truncate block">{ej.nombre}</span></td>
                              <td className="px-5 py-4 text-center align-middle">{ej.series != null ? <span className="text-xs tabular-nums bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-gray-600 dark:text-white/60 font-medium">{ej.series}×</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}</td>
                              <td className="px-5 py-4 text-center align-middle">{ej.repeticiones ? <span className="text-xs text-gray-500 dark:text-white/50">{ej.repeticiones}</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}</td>
                              <td className="px-5 py-4 text-center align-middle">{ej.peso ? <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded-md font-medium">{ej.peso}</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}</td>
                              <td className="px-5 py-4 text-center align-middle">{ej.rir != null ? <span className="text-xs tabular-nums text-gray-500 dark:text-white/50">{ej.rir}</span> : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}</td>
                              <td className="px-2 py-2.5 w-[56px]">
                                {isAdmin && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/ejrow:opacity-100 transition-opacity">
                                    <button onClick={() => startEditEj(ses.id, bl.id, ej)} className="p-1.5 rounded-lg text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"><Pencil size={14} /></button>
                                    <button onClick={() => deleteEjercicio(ses.id, bl.id, ej.id)} className="p-1.5 rounded-lg text-gray-400 dark:text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        }
                      })

                      // Add ejercicio
                      if (isAdmin) {
                        const aejKey = `${ses.id}:${bl.id}`
                        if (addingEjKey === aejKey) {
                          rows.push(
                            <tr key={`${bl.id}-aej-f`} className="border-t border-white/10 dark:border-white/[0.04] bg-gray-50/30 dark:bg-white/[0.015]">
                              {sesCell(bl.id + '-aej')}
                              {blCell(bl.id + '-aej')}
                              {patronCell(bl.id + '-aej', false)}
                              <td colSpan={6} className="px-3 py-2">
                                <form onSubmit={e => { e.preventDefault(); addEjercicio(ses.id, bl.id) }} className="flex items-center gap-2">
                                  <input autoFocus value={newEjNombre} onChange={e => setNewEjNombre(e.target.value)} list={EJ_DATALIST} placeholder="Buscar o escribir ejercicio…"
                                    className="flex-1 bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.12] rounded-lg px-2.5 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors"
                                    onKeyDown={e => { if (e.key === 'Escape') { setAddingEjKey(null); setNewEjNombre('') } }} />
                                  <button type="submit" className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap">Agregar</button>
                                  <button type="button" onClick={() => { setAddingEjKey(null); setNewEjNombre('') }} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/[0.1] text-xs text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">Cancelar</button>
                                </form>
                              </td>
                            </tr>
                          )
                        } else {
                          rows.push(
                            <tr key={`${bl.id}-aej`} className="border-t border-white/10 dark:border-white/[0.04]">
                              {sesCell(bl.id + '-aej-btn')}
                              {blCell(bl.id + '-aej-btn')}
                              <td colSpan={7} className="px-4 py-1.5">
                                <button onClick={() => setAddingEjKey(aejKey)} className={addBtnCls}><Plus size={11} /> Agregar ejercicio</button>
                              </td>
                            </tr>
                          )
                        }
                      }
                    })

                    // Add bloque (especializada)
                    if (isAdmin) {
                      if (addingBloqueToSesId === ses.id) {
                        rows.push(
                          <tr key={`${ses.id}-abl-f`} className="border-t border-white/20 dark:border-white/[0.08]">
                            <td className="w-[110px]" />
                            <td colSpan={8} className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <select value={pendingPatron} onChange={e => setPendingPatron(e.target.value)}
                                  className="bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.12] rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-white/70 focus:outline-none focus:border-primary/50">
                                  {PATRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <button onClick={() => addBloque(ses.id)} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">Agregar bloque</button>
                                <button onClick={() => setAddingBloqueToSesId(null)} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/[0.1] text-xs text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">Cancelar</button>
                              </div>
                            </td>
                          </tr>
                        )
                      } else {
                        rows.push(
                          <tr key={`${ses.id}-abl`} className="border-t border-white/20 dark:border-white/[0.08]">
                            <td className="w-[110px]" />
                            <td colSpan={8} className="px-4 py-2">
                              <button onClick={() => { setAddingBloqueToSesId(ses.id); setPendingPatron(PATRON_OPTIONS[0].value) }} className={addBtnCls}><Plus size={12} /> Agregar bloque</button>
                            </td>
                          </tr>
                        )
                      }
                    }
                  }

                  return rows
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Agregar sesión */}
        {isAdmin && (
          <div className="px-5 py-3 border-t border-white/20 dark:border-white/[0.06]">
            <button onClick={addSesion} className={addBtnCls}><Plus size={12} /> Agregar sesión</button>
          </div>
        )}
      </div>

      {!draft.especializada && (
        <p className="text-[11px] text-gray-400 dark:text-white/25">
          Plantilla básica: los ejercicios específicos se definen al crear la rutina del deportista.
        </p>
      )}
    </motion.div>
  )
}
