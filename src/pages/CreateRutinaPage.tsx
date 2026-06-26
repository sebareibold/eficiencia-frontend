import { Fragment, useReducer, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainerFast, fadeUpItem } from '../lib/motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, Check, Search, User, Plus, X, Wrench,
  ChevronDown, ExternalLink, AlertCircle, Layers,
  ClipboardList, Dumbbell, Settings2, Eye, Pencil, Trash2,
  GripVertical, Copy,
} from 'lucide-react'
import { ejerciciosApi } from '../api/ejercicios.api'
import { patronesApi } from '../api/patrones.api'
import type { PatronMovimientoConfig } from '../api/patrones.api'
import { clientsApi } from '../api/clients.api'
import { rutinasApi } from '../api/rutinas.api'
import { plantillasApi } from '../api/plantillas.api'
import { usuariosApi } from '../api/usuarios.api'
import { useUiStore } from '../store/uiStore'
import Skeleton from '../components/ui/Skeleton'
import type {
  WizardState, WizardModo, ClienteResumen, SesionDraft, BloqueDraft,
  EjercicioDraft, PatronMovimientoEnum, PeriodoEntrenamiento,
  PlantillaRutinaData, TipoDistribucion, CrearCompletaPayload, Rutina,
  WSemanaDraft, WSesionDraft, WBloqueDraft, PatronEntry,
} from '../types/rutina.types'
import type { EjercicioCatalogo } from '../types/ejercicio-catalogo.types'

// ─── Constantes y helpers ─────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoDistribucion, string> = {
  FULL_BODY:  'Full Body',
  ARM_LEG:    'Arm-Leg',
  PUSH_PULL:  'Push-Pull',
  CUSTOM:     'Custom',
}

const TIPO_COLORS: Record<TipoDistribucion, string> = {
  FULL_BODY:  'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  ARM_LEG:    'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  PUSH_PULL:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  CUSTOM:     'bg-gray-500/15 text-gray-400 border border-gray-500/25',
}

const PERIODO_LABELS: Record<PeriodoEntrenamiento, string> = {
  CARGA:          'Carga',
  IMPACTO:        'Impacto',
  DESCARGA:       'Descarga',
  MANTENIMIENTO:  'Mantenimiento',
}

const STEP_LABELS = ['Cliente', 'Sesiones', 'Plantilla', 'Ejercicios', 'Config', 'Confirmar']

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const DIAS_DEFAULT = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const SESIONES_DESC: Record<number, string> = {
  2: 'Inicio · Recuperación',
  3: 'Estándar',
  4: 'Intenso',
  5: 'Avanzado',
}

const PERIODO_DESCS: Record<string, string> = {
  CARGA:         'Alta carga y volumen. Semana eje del mesociclo.',
  IMPACTO:       'Alta intensidad con menor volumen. Foco en rendimiento.',
  DESCARGA:      'Recuperación activa con carga reducida.',
  MANTENIMIENTO: 'Conserva las adaptaciones con trabajo mínimo.',
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11)
}

function crearEjercicioVacio(): EjercicioDraft {
  return { _id: uid(), nombre: '' }
}

function crearBloqueVacio(letra: string, orden: number, cant = 2): BloqueDraft {
  return {
    _id: uid(),
    letra,
    orden,
    patrones: [{ _id: uid(), patronMovimiento: null, cantidad: cant }],
    ejercicios: Array.from({ length: cant }, crearEjercicioVacio),
  }
}

function crearSesionVacia(numero: number, cantBloques = 3): SesionDraft {
  return {
    _id: uid(),
    numero,
    bloques: Array.from({ length: cantBloques }, (_, i) => crearBloqueVacio(LETRAS[i] ?? String(i + 1), i)),
  }
}

function normalizarPatrones(bp: PlantillaRutinaData['sesiones'][0]['bloques'][0]): PatronEntry[] {
  if (bp.patrones && bp.patrones.length > 0) {
    return bp.patrones.map(p => ({ _id: uid(), patronMovimiento: p.patronMovimiento as PatronMovimientoEnum, cantidad: p.cantidad }))
  }
  if (bp.patronMovimiento) {
    return [{ _id: uid(), patronMovimiento: bp.patronMovimiento as PatronMovimientoEnum, cantidad: bp.cantidadEjercicios ?? 2 }]
  }
  return []
}

function generarEstructura(plantilla: PlantillaRutinaData, cantidadSesiones: number): SesionDraft[] {
  const sesionesPlantilla = plantilla.sesiones.slice(0, cantidadSesiones)
  return sesionesPlantilla.map((sp) => {
    if (plantilla.especializada) {
      // Plantilla especializada: pre-cargamos ejercicios reales con sus parámetros
      const bloques: BloqueDraft[] = sp.bloques.map((bp, idx) => {
        const patronesDraft = normalizarPatrones(bp)
        const totalCant = patronesDraft.reduce((s, p) => s + p.cantidad, 0) || bp.cantidadEjercicios || 2
        return {
          _id: uid(),
          letra: bp.letra,
          orden: idx,
          patrones: patronesDraft,
          ejercicios: bp.ejercicios.length > 0
            ? bp.ejercicios.map(ej => ({
                _id: uid(),
                catalogoId: ej.catalogoId,
                nombre: ej.nombre,
                series: ej.series ?? undefined,
                repeticiones: ej.repeticiones ?? undefined,
                peso: ej.peso ?? undefined,
                rir: ej.rir ?? undefined,
                rpe: ej.rpe ?? undefined,
                notas: ej.notas ?? undefined,
              }))
            : Array.from({ length: totalCant }, crearEjercicioVacio),
        }
      })
      return { _id: uid(), numero: sp.numero, nombre: sp.nombre, bloques }
    }

    // Plantilla básica: agrupa por letra y apila los ejercicios en orden (patron A primero, patron B después).
    const byLetra = new Map<string, { patrones: PatronEntry[]; count: number }>()
    for (const bp of sp.bloques) {
      const patronesBp = normalizarPatrones(bp)
      const totalCant = patronesBp.reduce((s, p) => s + p.cantidad, 0) || bp.cantidadEjercicios || 2
      const entry = byLetra.get(bp.letra)
      if (entry) {
        entry.patrones.push(...patronesBp)
        entry.count += totalCant
      } else {
        byLetra.set(bp.letra, { patrones: patronesBp, count: totalCant })
      }
    }
    const bloques: BloqueDraft[] = []
    let idx = 0
    for (const [letra, { patrones, count }] of byLetra) {
      bloques.push({
        _id: uid(),
        letra,
        orden: idx++,
        patrones,
        ejercicios: Array.from({ length: count }, crearEjercicioVacio),
      })
    }
    return { _id: uid(), numero: sp.numero, nombre: sp.nombre, bloques }
  })
}

function generarEstructuraVacia(cantidadSesiones: number): SesionDraft[] {
  return Array.from({ length: cantidadSesiones }, (_, i) => crearSesionVacia(i + 1))
}

function rutinaToSesionesDraft(rutina: Rutina): SesionDraft[] {
  const primera = rutina.semanas[0]
  if (!primera) return []
  return primera.sesiones.map((s, si) => ({
    _id: uid(),
    numero: si + 1,
    bloques: s.bloques.map((b, bi) => ({
      _id: uid(),
      letra: b.letra,
      orden: bi,
      patrones: [],
      ejercicios: b.ejerciciosPlan.map(e => ({
        _id: uid(),
        catalogoId: e.catalogoId,
        nombre: e.nombre,
        series: e.series,
        repeticiones: e.repeticiones ?? undefined,
        peso: e.peso ?? undefined,
        rir: e.rir ?? undefined,
        rpe: e.rpe ?? undefined,
      })),
    })),
  }))
}

// Copia estructura sin valores del plan (series/reps/peso/rir/rpe/notas)
// Usado al crear a partir de la rutina de otro cliente
function rutinaToSesionesDraftSinPlan(rutina: Rutina): SesionDraft[] {
  const primera = rutina.semanas[0]
  if (!primera) return []
  return primera.sesiones.map((s, si) => ({
    _id: uid(),
    numero: si + 1,
    bloques: s.bloques.map((b, bi) => ({
      _id: uid(),
      letra: b.letra,
      orden: bi,
      patrones: [],
      ejercicios: b.ejerciciosPlan.map(e => ({
        _id: uid(),
        catalogoId: e.catalogoId,
        nombre: e.nombre,
        series: undefined,
        repeticiones: undefined,
        peso: undefined,
        rir: undefined,
        rpe: undefined,
      })),
    })),
  }))
}

// ─── Estado inicial y reducer ─────────────────────────────────────────────────

const initialState: WizardState = {
  paso: 1,
  modo: 'nueva',
  cliente: null,
  sesionesSemanales: null,
  plantillaId: null,
  sinPlantilla: false,
  sesiones: [],
  semanasWizard: [],
  nombre: '',
  cantidadSemanas: 4,
  fechaInicio: new Date().toISOString().split('T')[0],
  periodo: null,
  descripcion: '',
  profesorId: null,
  rutinaBaseId: null,
  rutinaBaseSesiones: [],
}

type WizardAction =
  | { type: 'SET_PASO'; paso: number }
  | { type: 'SET_CLIENTE'; cliente: ClienteResumen }
  | { type: 'SET_MODO'; modo: WizardModo; rutinaBaseId?: string }
  | { type: 'SET_SESIONES_SEMANALES'; cantidad: number }
  | { type: 'SET_PLANTILLA'; plantillaId: string | null; sinPlantilla: boolean; sesiones: SesionDraft[] }
  | { type: 'UPDATE_BLOQUE'; sesionId: string; bloqueId: string; changes: Partial<BloqueDraft> }
  | { type: 'ADD_BLOQUE'; sesionId: string }
  | { type: 'DELETE_BLOQUE'; sesionId: string; bloqueId: string }
  | { type: 'UPDATE_EJERCICIO'; sesionId: string; bloqueId: string; ejercicioId: string; changes: Partial<EjercicioDraft> }
  | { type: 'ADD_EJERCICIO_EXTRA'; sesionId: string; bloqueId: string }
  | { type: 'DELETE_EJERCICIO'; sesionId: string; bloqueId: string; ejercicioId: string }
  | { type: 'SET_CONFIG'; nombre: string; cantidadSemanas: number; fechaInicio: string; periodo: PeriodoEntrenamiento | null; descripcion: string; profesorId: string | null }
  | { type: 'INIT_MESOCICLO'; sesiones: SesionDraft[]; rutinaBaseId: string }
  | { type: 'SET_BASE_RUTINA'; sesiones: SesionDraft[]; rutinaBaseId: string; sesionesSemanales: number }
  | { type: 'SET_DESCRIPCION'; descripcion: string }
  | { type: 'RESET_PASO1' }
  // ── Acciones semanas wizard (Paso 5) ─────────────────────────────────────────
  | { type: 'INIT_WIZARD_SEMANAS' }
  | { type: 'ADD_SEMANA_W' }
  | { type: 'CLONE_SEMANA_W'; semanaId: string }
  | { type: 'DELETE_SEMANA_W'; semanaId: string }
  | { type: 'RENAME_SEMANA_W'; semanaId: string; nombre: string }
  | { type: 'ADD_SESION_W'; semanaId: string; dia: string }
  | { type: 'DELETE_SESION_W'; semanaId: string; sesionId: string }
  | { type: 'RENAME_SESION_W'; semanaId: string; sesionId: string; nombre: string }
  | { type: 'ADD_BLOQUE_W'; sesionId: string }
  | { type: 'DELETE_BLOQUE_W'; sesionId: string; bloqueId: string }
  | { type: 'ADD_EJ_W'; bloqueId: string; nombre: string; catalogoId?: string }
  | { type: 'UPDATE_EJ_W'; sesionId: string; bloqueId: string; ejId: string; changes: Partial<EjercicioDraft> }
  | { type: 'DELETE_EJ_W'; sesionId: string; bloqueId: string; ejId: string }
  | { type: 'REORDER_SEMANAS_W'; fromId: string; toId: string }

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_PASO':
      return { ...state, paso: action.paso }

    case 'SET_CLIENTE':
      return { ...state, cliente: action.cliente }

    case 'SET_MODO':
      return {
        ...state,
        modo: action.modo,
        rutinaBaseId: action.rutinaBaseId ?? state.rutinaBaseId,
      }

    case 'SET_SESIONES_SEMANALES':
      return { ...state, sesionesSemanales: action.cantidad }

    case 'SET_PLANTILLA':
      return {
        ...state,
        plantillaId: action.plantillaId,
        sinPlantilla: action.sinPlantilla,
        sesiones: action.sesiones,
      }

    case 'UPDATE_BLOQUE':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : { ...b, ...action.changes }
            ),
          }
        ),
      }

    case 'ADD_BLOQUE': {
      return {
        ...state,
        sesiones: state.sesiones.map(s => {
          if (s._id !== action.sesionId) return s
          const siguiente = s.bloques.length
          const letra = LETRAS[siguiente] ?? String.fromCharCode(65 + siguiente)
          return {
            ...s,
            bloques: [...s.bloques, crearBloqueVacio(letra, siguiente)],
          }
        }),
      }
    }

    case 'DELETE_BLOQUE':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.filter(b => b._id !== action.bloqueId),
          }
        ),
      }

    case 'UPDATE_EJERCICIO':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : {
                ...b,
                ejercicios: b.ejercicios.map(e =>
                  e._id !== action.ejercicioId ? e : { ...e, ...action.changes }
                ),
              }
            ),
          }
        ),
      }

    case 'ADD_EJERCICIO_EXTRA':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : {
                ...b,
                ejercicios: [...b.ejercicios, crearEjercicioVacio()],
              }
            ),
          }
        ),
      }

    case 'DELETE_EJERCICIO':
      return {
        ...state,
        sesiones: state.sesiones.map(s =>
          s._id !== action.sesionId ? s : {
            ...s,
            bloques: s.bloques.map(b =>
              b._id !== action.bloqueId ? b : {
                ...b,
                ejercicios: b.ejercicios.filter(e => e._id !== action.ejercicioId),
              }
            ),
          }
        ),
      }

    case 'SET_CONFIG':
      return {
        ...state,
        nombre: action.nombre,
        cantidadSemanas: action.cantidadSemanas,
        fechaInicio: action.fechaInicio,
        periodo: action.periodo,
        descripcion: action.descripcion,
        profesorId: action.profesorId,
      }

    case 'INIT_MESOCICLO':
      return {
        ...state,
        sesiones: action.sesiones,
        rutinaBaseId: action.rutinaBaseId,
        rutinaBaseSesiones: action.sesiones,
      }

    case 'SET_BASE_RUTINA':
      return {
        ...state,
        sesiones: action.sesiones,
        rutinaBaseId: action.rutinaBaseId,
        rutinaBaseSesiones: action.sesiones,
        sesionesSemanales: action.sesionesSemanales,
        sinPlantilla: true,
        plantillaId: null,
      }

    case 'SET_DESCRIPCION':
      return { ...state, descripcion: action.descripcion }

    case 'RESET_PASO1':
      return {
        ...state,
        cliente: null,
        rutinaBaseId: null,
        sesiones: [],
        sesionesSemanales: null,
        sinPlantilla: false,
        plantillaId: null,
        descripcion: '',
      }

    // ── Semanas wizard (Paso 5 tabla inline) ──────────────────────────────────

    case 'INIT_WIZARD_SEMANAS': {
      // Si ya hay semanas inicializadas, no hacemos nada (preservar datos)
      if (state.semanasWizard.length > 0) return state
      // Convertir state.sesiones en 1 semana inicial
      const semana: WSemanaDraft = {
        _id: uid(),
        numero: 1,
        sesiones: state.sesiones.map((ses, idx) => ({
          _id: uid(),
          dia: DIAS_DEFAULT[idx] ?? `Día ${idx + 1}`,
          bloques: ses.bloques.map(b => ({
            _id: uid(),
            letra: b.letra,
            patrones: b.patrones,
            ejercicios: b.ejercicios.map(e => ({ ...e, _id: uid() })),
          })),
        })),
      }
      return { ...state, semanasWizard: [semana] }
    }

    case 'ADD_SEMANA_W': {
      const numero = (state.semanasWizard.at(-1)?.numero ?? 0) + 1
      const nueva: WSemanaDraft = { _id: uid(), numero, sesiones: [] }
      return { ...state, semanasWizard: [...state.semanasWizard, nueva] }
    }

    case 'CLONE_SEMANA_W': {
      const src = state.semanasWizard.find(s => s._id === action.semanaId)
      if (!src) return state
      const numero = (state.semanasWizard.at(-1)?.numero ?? 0) + 1
      const clon: WSemanaDraft = {
        _id: uid(),
        numero,
        nombre: src.nombre,
        sesiones: src.sesiones.map(ses => ({
          _id: uid(),
          dia: ses.dia,
          nombre: ses.nombre,
          bloques: ses.bloques.map(b => ({
            _id: uid(),
            letra: b.letra,
            patrones: b.patrones,
            ejercicios: b.ejercicios.map(e => ({ ...e, _id: uid() })),
          })),
        })),
      }
      return { ...state, semanasWizard: [...state.semanasWizard, clon] }
    }

    case 'DELETE_SEMANA_W':
      return { ...state, semanasWizard: state.semanasWizard.filter(s => s._id !== action.semanaId) }

    case 'RENAME_SEMANA_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(s =>
          s._id !== action.semanaId ? s : { ...s, nombre: action.nombre }
        ),
      }

    case 'ADD_SESION_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(s =>
          s._id !== action.semanaId ? s : {
            ...s,
            sesiones: [...s.sesiones, { _id: uid(), dia: action.dia, bloques: [] }],
          }
        ),
      }

    case 'DELETE_SESION_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(s =>
          s._id !== action.semanaId ? s : {
            ...s,
            sesiones: s.sesiones.filter(ses => ses._id !== action.sesionId),
          }
        ),
      }

    case 'RENAME_SESION_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(s =>
          s._id !== action.semanaId ? s : {
            ...s,
            sesiones: s.sesiones.map(ses =>
              ses._id !== action.sesionId ? ses : { ...ses, nombre: action.nombre || undefined }
            ),
          }
        ),
      }

    case 'ADD_BLOQUE_W': {
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(sem => ({
          ...sem,
          sesiones: sem.sesiones.map(ses => {
            if (ses._id !== action.sesionId) return ses
            const letra = LETRAS[ses.bloques.length] ?? String.fromCharCode(65 + ses.bloques.length)
            return {
              ...ses,
              bloques: [...ses.bloques, { _id: uid(), letra, patrones: [], ejercicios: [crearEjercicioVacio()] }],
            }
          }),
        })),
      }
    }

    case 'DELETE_BLOQUE_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(sem => ({
          ...sem,
          sesiones: sem.sesiones.map(ses =>
            ses._id !== action.sesionId ? ses : {
              ...ses,
              bloques: ses.bloques.filter(b => b._id !== action.bloqueId),
            }
          ),
        })),
      }

    case 'ADD_EJ_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(sem => ({
          ...sem,
          sesiones: sem.sesiones.map(ses => ({
            ...ses,
            bloques: ses.bloques.map(b =>
              b._id !== action.bloqueId ? b : {
                ...b,
                ejercicios: [...b.ejercicios, {
                  _id: uid(),
                  nombre: action.nombre,
                  catalogoId: action.catalogoId,
                }],
              }
            ),
          })),
        })),
      }

    case 'UPDATE_EJ_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(sem => ({
          ...sem,
          sesiones: sem.sesiones.map(ses =>
            ses._id !== action.sesionId ? ses : {
              ...ses,
              bloques: ses.bloques.map(b =>
                b._id !== action.bloqueId ? b : {
                  ...b,
                  ejercicios: b.ejercicios.map(e =>
                    e._id !== action.ejId ? e : { ...e, ...action.changes }
                  ),
                }
              ),
            }
          ),
        })),
      }

    case 'DELETE_EJ_W':
      return {
        ...state,
        semanasWizard: state.semanasWizard.map(sem => ({
          ...sem,
          sesiones: sem.sesiones.map(ses =>
            ses._id !== action.sesionId ? ses : {
              ...ses,
              bloques: ses.bloques.map(b =>
                b._id !== action.bloqueId ? b : {
                  ...b,
                  ejercicios: b.ejercicios.filter(e => e._id !== action.ejId),
                }
              ),
            }
          ),
        })),
      }

    case 'REORDER_SEMANAS_W': {
      const from = state.semanasWizard.findIndex(s => s._id === action.fromId)
      const to   = state.semanasWizard.findIndex(s => s._id === action.toId)
      if (from === -1 || to === -1 || from === to) return state
      const semanas = [...state.semanasWizard]
      const [moved] = semanas.splice(from, 1)
      semanas.splice(to, 0, moved)
      return { ...state, semanasWizard: semanas }
    }

    default:
      return state
  }
}

// ─── Clases de estilo compartidas ─────────────────────────────────────────────

const glass = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls = 'w-full rounded-xl border border-white/50 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6B7280] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors'
const labelCls = 'block text-[10px] font-bold text-gray-500 dark:text-[#8A8A9A] mb-1 uppercase tracking-wider'

// ─── StepperHeader ────────────────────────────────────────────────────────────

function StepperHeader({ currentStep, modo }: { currentStep: number; modo: WizardModo }) {
  return (
    <div className="flex items-start mb-8">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1
        const done = currentStep > stepNum
        const curr = currentStep === stepNum
        const skipped = modo === 'mesociclo' && stepNum <= 3 && currentStep > stepNum

        return (
          <div key={stepNum} className="flex-1 flex flex-col items-center relative">
            {/* Left connector */}
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
            {/* Right connector */}
            {idx < STEP_LABELS.length - 1 && (
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

            {/* Circle */}
            <div
              className={[
                'relative z-20 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition-all duration-300',
                curr
                  ? 'bg-primary text-black ring-4 ring-primary/25 shadow-[0_0_20px_rgba(251,198,8,0.4)] scale-110'
                  : skipped
                  ? 'bg-gray-300 dark:bg-white/[0.12] text-gray-500 dark:text-white/40 border-2 border-gray-300 dark:border-white/10'
                  : done
                  ? 'bg-primary text-black/80 border-2 border-primary/80 shadow-[0_2px_10px_rgba(251,198,8,0.3)]'
                  : 'bg-white dark:bg-[#111] border-2 border-gray-300 dark:border-white/[0.18] text-gray-500 dark:text-white/50',
              ].join(' ')}
            >
              {done || skipped ? <Check size={13} strokeWidth={2.5} /> : stepNum}
            </div>

            {/* Label */}
            <span className={[
              'mt-1.5 text-[9px] font-bold uppercase tracking-wider hidden sm:block',
              curr ? 'text-gray-900 dark:text-white'
                : done ? 'text-primary'
                : 'text-gray-400 dark:text-[#4A4A5A]',
            ].join(' ')}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── OptionCard ───────────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={[
        'relative text-left rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] duration-200 overflow-hidden w-full',
        selected
          ? 'border-primary/50 dark:border-primary/40 bg-gradient-to-br from-[rgba(251,198,8,0.10)] via-[rgba(251,198,8,0.04)] to-transparent dark:from-[rgba(251,198,8,0.08)] dark:via-[rgba(251,198,8,0.03)] dark:to-transparent shadow-[0_4px_24px_rgba(251,198,8,0.12)]'
          : 'border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl hover:border-white/70 dark:hover:border-white/[0.16] hover:bg-white/60 dark:hover:bg-white/[0.07]',
        className,
      ].join(' ')}
    >
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md bg-primary shadow-[0_2px_8px_rgba(251,198,8,0.4)]"
        >
          <Check size={11} strokeWidth={3} className="text-black" />
        </motion.span>
      )}
      {children}
    </motion.button>
  )
}

// ─── SearchableExerciseSelector ───────────────────────────────────────────────

function SearchableExerciseSelector({
  patronHint,
  patrones,
  onSelect,
  onCancel,
}: {
  patronHint: PatronMovimientoEnum | null
  patrones: PatronMovimientoConfig[]
  onSelect: (ej: EjercicioCatalogo) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const [patron, setPatron] = useState<string>(patronHint ?? '')
  const [results, setResults] = useState<EjercicioCatalogo[]>([])
  const [loading, setLoading] = useState(false)
  const [videoModal, setVideoModal] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string, p: string) => {
    setLoading(true)
    try {
      const data = await ejerciciosApi.getAll({
        nombre: q || undefined,
        patronMovimiento: p || undefined,
        startsWith: true,
      })
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void fetchResults(search, patron)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, patron, fetchResults])

  const DIFICULTAD_CLS: Record<string, string> = {
    FACIL:      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    INTERMEDIO: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    AVANZADO:   'bg-red-500/10 text-red-400 border border-red-500/20',
    DIFICIL:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  }
  const DIFICULTAD_LABELS: Record<string, string> = {
    FACIL: 'Fácil', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado', DIFICIL: 'Difícil',
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ejercicio..."
              autoFocus
              className={inputCls + ' pl-8'}
            />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 p-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-white/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <select
          value={patron}
          onChange={e => setPatron(e.target.value)}
          className={inputCls + ' cursor-pointer'}
        >
          <option value="">Todos los patrones</option>
          {patrones.map(p => (
            <option key={p.clave} value={p.clave}>{p.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-2 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center px-3 py-2.5">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-3 text-sm text-gray-400">Sin resultados. Probá con otro nombre o patrón.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {results.map(ej => (
            <div
              key={ej.id}
              onClick={() => onSelect(ej)}
              className="w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.06] transition-colors group cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{ej.nombre}</p>
                {ej.patronMovimiento && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{patrones.find(p => p.clave === ej.patronMovimiento)?.label ?? ej.patronMovimiento}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${ej.dificultad ? (DIFICULTAD_CLS[ej.dificultad] ?? 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/35') : 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/35'}`}>
                  {ej.categoria?.nombre ?? (ej.dificultad ? DIFICULTAD_LABELS[ej.dificultad] : null) ?? ''}
                </span>
                {ej.videoUrl && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setVideoModal(ej.videoUrl!) }}
                    className="h-6 w-6 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video modal */}
      <AnimatePresence>
        {videoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setVideoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative rounded-2xl overflow-hidden w-full max-w-2xl bg-black"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
                <span className="text-sm text-gray-900 dark:text-white font-semibold">Video del ejercicio</span>
                <button onClick={() => setVideoModal(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4">
                <a
                  href={videoModal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline text-sm"
                >
                  <ExternalLink size={14} />
                  Abrir video en nueva pestaña
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── EjercicioSlot ────────────────────────────────────────────────────────────

function EjercicioSlot({
  ejercicio,
  patronBloque,
  patrones,
  onUpdate,
  esReferencia = false,
}: {
  ejercicio: EjercicioDraft
  patronBloque: PatronMovimientoEnum | null
  patrones: PatronMovimientoConfig[]
  onUpdate: (changes: Partial<EjercicioDraft>) => void
  esReferencia?: boolean
}) {
  const [showSelector, setShowSelector] = useState(!ejercicio.nombre)
  const [expanded, setExpanded] = useState(false)

  if (esReferencia && ejercicio._esReferencia) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-white/[0.06] px-1.5 py-0.5 rounded-md">anterior</span>
          <span className="text-sm text-gray-400">{ejercicio._referenciaData?.nombre ?? ejercicio.nombre}</span>
        </div>
        {ejercicio._referenciaData && (
          <div className="flex gap-3 mt-1 text-[10px] text-gray-600">
            {ejercicio._referenciaData.series !== undefined && <span>{ejercicio._referenciaData.series} series</span>}
            {ejercicio._referenciaData.repeticiones && <span>{ejercicio._referenciaData.repeticiones} reps</span>}
            {ejercicio._referenciaData.peso && <span>{ejercicio._referenciaData.peso} kg</span>}
            {ejercicio._referenciaData.rir !== undefined && <span>RIR {ejercicio._referenciaData.rir}</span>}
          </div>
        )}
        <button
          type="button"
          onClick={() => onUpdate({ _esReferencia: false, nombre: ejercicio._referenciaData?.nombre ?? '' })}
          className="mt-2 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Usar como base y editar
        </button>
      </div>
    )
  }

  if (showSelector) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden p-3">
        <SearchableExerciseSelector
          patronHint={patronBloque}
          patrones={patrones}
          onSelect={(ej) => {
            onUpdate({
              catalogoId: ej.id,
              nombre: ej.nombre,
              _esReferencia: false,
            })
            setShowSelector(false)
            setExpanded(true)
          }}
          onCancel={() => {
            if (!ejercicio.nombre) return
            setShowSelector(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ejercicio.nombre}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ejercicio.series && <span className="text-[10px] text-gray-500">{ejercicio.series}×{ejercicio.repeticiones ?? '—'}</span>}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowSelector(true) }}
            className="text-[10px] text-gray-500 hover:text-primary transition-colors"
          >
            cambiar
          </button>
          <ChevronDown size={12} className={`text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/[0.05]">
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div>
                  <label className={labelCls}>Series</label>
                  <input
                    type="number"
                    min={1}
                    value={ejercicio.series ?? ''}
                    onChange={e => onUpdate({ series: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                    placeholder="4"
                  />
                </div>
                <div>
                  <label className={labelCls}>Reps</label>
                  <input
                    value={ejercicio.repeticiones ?? ''}
                    onChange={e => onUpdate({ repeticiones: e.target.value || undefined })}
                    className={inputCls}
                    placeholder="8-12"
                  />
                </div>
                <div>
                  <label className={labelCls}>Peso (kg)</label>
                  <input
                    value={ejercicio.peso ?? ''}
                    onChange={e => onUpdate({ peso: e.target.value || undefined })}
                    className={inputCls}
                    placeholder="60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>RIR</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={ejercicio.rir ?? ''}
                    onChange={e => onUpdate({ rir: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                    placeholder="2"
                  />
                </div>
                <div>
                  <label className={labelCls}>RPE</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={ejercicio.rpe ?? ''}
                    onChange={e => onUpdate({ rpe: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                    placeholder="8"
                  />
                </div>
                <div>
                  <label className={labelCls}>Método</label>
                  <input
                    value={ejercicio.metodo ?? ''}
                    onChange={e => onUpdate({ metodo: e.target.value || undefined })}
                    className={inputCls}
                    placeholder="Drop set"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <input
                  value={ejercicio.notas ?? ''}
                  onChange={e => onUpdate({ notas: e.target.value || undefined })}
                  className={inputCls}
                  placeholder="Indicaciones específicas..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── EjWizardInlineCells ─────────────────────────────────────────────────────
// Returns a Fragment of <td> elements — must be rendered inside a <tr>.

function EjWizardInlineCells({
  ej,
  onUpdate,
  onCancel,
  onAssign,
}: {
  ej: EjercicioDraft
  onUpdate: (changes: Partial<EjercicioDraft>) => void
  onCancel: () => void
  onAssign: () => void
}) {
  const [draft, setDraft] = useState({
    nombre:       ej.nombre,
    series:       ej.series?.toString()    ?? '',
    repeticiones: ej.repeticiones          ?? '',
    peso:         ej.peso                  ?? '',
    rir:          ej.rir?.toString()        ?? '',
    rpe:          ej.rpe?.toString()        ?? '',
    notas:        ej.notas                 ?? '',
  })

  const inp = 'w-full bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/[0.12] rounded-lg px-1.5 py-1 text-xs text-saas-text dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  function commit() {
    onUpdate({
      nombre:       draft.nombre,
      series:       draft.series       ? Number(draft.series)  : undefined,
      repeticiones: draft.repeticiones || undefined,
      peso:         draft.peso         || undefined,
      rir:          draft.rir          ? Number(draft.rir)     : undefined,
      rpe:          draft.rpe          ? Number(draft.rpe)     : undefined,
      notas:        draft.notas        || undefined,
    })
  }

  return (
    <>
      <td className="px-2 py-1.5 min-w-[180px]">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draft.nombre}
            onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
            placeholder="Nombre del ejercicio..."
            className={`${inp} flex-1`}
          />
          <button type="button" onClick={onAssign}
            className="shrink-0 text-[10px] text-primary hover:text-primary/80 transition-colors whitespace-nowrap">
            buscar
          </button>
        </div>
      </td>
      <td className="px-1.5 py-1.5 w-14">
        <input type="number" min={1} value={draft.series}
          onChange={e => setDraft(d => ({ ...d, series: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          placeholder="4" className={`${inp} text-center`} />
      </td>
      <td className="px-1.5 py-1.5 w-16">
        <input value={draft.repeticiones}
          onChange={e => setDraft(d => ({ ...d, repeticiones: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          placeholder="8-12" className={`${inp} text-center`} />
      </td>
      <td className="px-1.5 py-1.5 w-16">
        <input value={draft.peso}
          onChange={e => setDraft(d => ({ ...d, peso: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          placeholder="kg" className={`${inp} text-center`} />
      </td>
      <td className="px-1.5 py-1.5 w-20">
        <div className="flex gap-1">
          <input type="number" min={0} max={5} value={draft.rir}
            onChange={e => setDraft(d => ({ ...d, rir: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
            placeholder="RIR" className={`${inp} text-center`} />
          <input type="number" min={1} max={10} value={draft.rpe}
            onChange={e => setDraft(d => ({ ...d, rpe: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
            placeholder="RPE" className={`${inp} text-center`} />
        </div>
      </td>
      <td className="px-1.5 py-1.5 min-w-[120px]">
        <input value={draft.notas}
          onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          placeholder="Nota..." className={inp} />
      </td>
      <td className="px-1.5 py-1.5 w-16">
        <div className="flex items-center justify-center gap-0.5">
          <button type="button" onClick={commit}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Guardar (Enter)">
            <Check size={12} />
          </button>
          <button type="button" onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 dark:text-white/45 hover:bg-white/[0.06] transition-colors" title="Cancelar (Esc)">
            <X size={12} />
          </button>
        </div>
      </td>
    </>
  )
}

// ─── SesionDayDropdownW ───────────────────────────────────────────────────────
// Versión wizard del SesionDayDropdown de ClientRutinaPage (sin API calls)

function SesionDayDropdownW({ existentes, semanaId, onSelect, onClose }: {
  existentes: string[]
  semanaId: string
  onSelect: (semanaId: string, dia: string) => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      className="absolute top-full left-0 mt-1.5 z-30 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-3 shadow-xl min-w-[160px]"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-gray-500 dark:text-white/50 font-medium">Agregar día</span>
        <button onClick={onClose} className="text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {DIAS_DEFAULT.map(dia => (
          <button key={dia} onClick={() => { onSelect(semanaId, dia); onClose() }}
            disabled={existentes.includes(dia)}
            className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-xs text-gray-700 dark:text-white hover:bg-primary hover:text-black hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            {dia}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CreateRutinaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clienteIdFromUrl = searchParams.get('clienteId')
  const addToast = useUiStore(s => s.addToast)
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingClienteInit, setLoadingClienteInit] = useState(!!clienteIdFromUrl)
  const [clienteRutinas, setClienteRutinas] = useState<Rutina[]>([])
  const [showBasePhase, setShowBasePhase] = useState(false)
  const [baseDecidida, setBaseDecidida] = useState(false)
  const [editingEjId,   setEditingEjId]   = useState<string | null>(null)
  const [assigningEjId, setAssigningEjId] = useState<string | null>(null)
  const [plantillasOptions, setPlantillasOptions] = useState<PlantillaRutinaData[]>([])
  const [loadingPlantillas, setLoadingPlantillas] = useState(false)
  const [patrones, setPatrones] = useState<PatronMovimientoConfig[]>([])
  const plantillasFetchedRef  = useRef(false)
  const paso4ScrollTop        = useRef(0)

  // Carga patrones de movimiento al montar
  useEffect(() => {
    patronesApi.getAll(true).then(setPatrones).catch(() => {})
  }, [])

  // Carga plantillas una sola vez al llegar al paso 3
  useEffect(() => {
    if (state.paso !== 3 || plantillasFetchedRef.current) return
    plantillasFetchedRef.current = true
    setLoadingPlantillas(true)
    plantillasApi.getAll()
      .then(data => setPlantillasOptions(data.filter(p => p.activa && p.cantidadSesiones === state.sesionesSemanales)))
      .catch(() => setPlantillasOptions([]))
      .finally(() => setLoadingPlantillas(false))
  }, [state.paso, state.sesionesSemanales])

  // Si cambian las sesiones semanales se resetea el cache de plantillas
  useEffect(() => {
    plantillasFetchedRef.current = false
  }, [state.sesionesSemanales])

  // Si viene desde ClientRutinaPage con ?clienteId=xxx, pre-carga el cliente
  useEffect(() => {
    if (!clienteIdFromUrl) return
    let cancelled = false
    async function precargarCliente() {
      try {
        const full = await clientsApi.getById(clienteIdFromUrl!)
        const resumen: ClienteResumen = {
          id: String(full.id),
          nombre: full.name,
          apellido: full.lastName,
          planActivo: full.planName ?? null,
          frecuenciaSemanal: full.planFrequency ?? null,
          membresiaVigente: full.membershipStatus === 'ACTIVA',
          rutinaActivaId: null,
          rutinaActivaNombre: null,
        }
        let fetchedRutinas: Rutina[] = []
        try {
          fetchedRutinas = await rutinasApi.getByCliente(clienteIdFromUrl!)
          const activa = fetchedRutinas.find(r => r.activa)
          if (activa) {
            resumen.rutinaActivaId = activa.id
            resumen.rutinaActivaNombre = activa.nombre
          }
        } catch { /* sin rutinas */ }
        if (!cancelled) {
          dispatch({ type: 'SET_CLIENTE', cliente: resumen })
          if (fetchedRutinas.length > 0) {
            setClienteRutinas(fetchedRutinas)
            setShowBasePhase(true)
          } else {
            dispatch({ type: 'SET_PASO', paso: 2 })
          }
        }
      } catch {
        if (!cancelled) addToast('Error al cargar el cliente', 'error')
      } finally {
        if (!cancelled) setLoadingClienteInit(false)
      }
    }
    precargarCliente()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Paso 1 — Buscar cliente ────────────────────────────────────────────────

  function Paso1() {
    const [search, setSearch] = useState('')
    const [loadingSearch, setLoadingSearch] = useState(false)
    const [loadingCliente, setLoadingCliente] = useState(false)
    const [clienteSeleccionadoRaw, setClienteSeleccionadoRaw] = useState<ClienteResumen | null>(null)
    type ResultItem = { id: number; nombre: string; apellido: string }
    const [rawResults, setRawResults] = useState<ResultItem[]>([])
    const [localRutinas, setLocalRutinas] = useState<Rutina[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      if (search.length < 2) { setRawResults([]); return }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        setLoadingSearch(true)
        try {
          const res = await clientsApi.getAll({ search, limit: 20, page: 1 })
          setRawResults(res.data.map(c => ({ id: Number(c.id), nombre: c.name, apellido: c.lastName })))
        } catch {
          setRawResults([])
        } finally {
          setLoadingSearch(false)
        }
      }, 300)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [search])

    async function seleccionarCliente(id: number) {
      setLoadingCliente(true)
      try {
        const full = await clientsApi.getById(String(id))
        const resumen: ClienteResumen = {
          id: String(full.id),
          nombre: full.name,
          apellido: full.lastName,
          planActivo: full.planName ?? null,
          frecuenciaSemanal: full.planFrequency ?? null,
          membresiaVigente: full.membershipStatus === 'ACTIVA',
          rutinaActivaId: null,
          rutinaActivaNombre: null,
        }
        let rutinas: Rutina[] = []
        try {
          rutinas = await rutinasApi.getByCliente(String(id))
          const activa = rutinas.find(r => r.activa)
          if (activa) {
            resumen.rutinaActivaId = activa.id
            resumen.rutinaActivaNombre = activa.nombre
          }
        } catch { /* sin rutinas */ }
        setLocalRutinas(rutinas)
        setClienteSeleccionadoRaw(resumen)
      } catch {
        addToast('Error al cargar el cliente', 'error')
      } finally {
        setLoadingCliente(false)
      }
    }

    function irAFaseBase() {
      if (!clienteSeleccionadoRaw) return
      dispatch({ type: 'SET_CLIENTE', cliente: clienteSeleccionadoRaw })
      dispatch({ type: 'SET_MODO', modo: 'nueva' })
      setClienteRutinas(localRutinas)
      setShowBasePhase(true)
    }

    function confirmarClienteDirecto() {
      if (!clienteSeleccionadoRaw) return
      dispatch({ type: 'SET_CLIENTE', cliente: clienteSeleccionadoRaw })
      dispatch({ type: 'SET_MODO', modo: 'nueva' })
      dispatch({ type: 'SET_PASO', paso: 2 })
    }

    function elegirMesociclo() {
      if (!clienteSeleccionadoRaw?.rutinaActivaId) return
      dispatch({ type: 'SET_CLIENTE', cliente: clienteSeleccionadoRaw })
      dispatch({ type: 'SET_MODO', modo: 'mesociclo', rutinaBaseId: clienteSeleccionadoRaw.rutinaActivaId })
      dispatch({ type: 'SET_PASO', paso: 2 })
    }

    // ── Sub-estado para "desde otro cliente" ──────────────────────────────────
    const [showOtroCliente, setShowOtroCliente] = useState(false)
    const [otroSearch, setOtroSearch] = useState('')
    const [otroLoadingSearch, setOtroLoadingSearch] = useState(false)
    const [otroResults, setOtroResults] = useState<{ id: number; nombre: string; apellido: string }[]>([])
    const [otroRutinas, setOtroRutinas] = useState<Rutina[]>([])
    const [otroNombreCliente, setOtroNombreCliente] = useState('')
    const [otroLoadingRutinas, setOtroLoadingRutinas] = useState(false)
    const otroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      if (otroSearch.length < 2) { setOtroResults([]); return }
      if (otroTimerRef.current) clearTimeout(otroTimerRef.current)
      otroTimerRef.current = setTimeout(async () => {
        setOtroLoadingSearch(true)
        try {
          const res = await clientsApi.getAll({ search: otroSearch, limit: 20, page: 1 })
          // Excluir al cliente destino
          const destinoId = state.cliente?.id
          setOtroResults(
            res.data
              .filter(c => String(c.id) !== destinoId)
              .map(c => ({ id: Number(c.id), nombre: c.name, apellido: c.lastName }))
          )
        } catch {
          setOtroResults([])
        } finally {
          setOtroLoadingSearch(false)
        }
      }, 300)
      return () => { if (otroTimerRef.current) clearTimeout(otroTimerRef.current) }
    }, [otroSearch])

    async function seleccionarOtroCliente(id: number, nombre: string, apellido: string) {
      setOtroLoadingRutinas(true)
      setOtroNombreCliente(`${nombre} ${apellido}`)
      setOtroResults([])
      setOtroSearch(`${nombre} ${apellido}`)
      try {
        const rutinas = await rutinasApi.getByCliente(String(id))
        setOtroRutinas(rutinas)
      } catch {
        setOtroRutinas([])
        addToast('Error al cargar las rutinas', 'error')
      } finally {
        setOtroLoadingRutinas(false)
      }
    }

    function elegirRutinaOtroCliente(rutina: Rutina) {
      const sesionesDraft = rutinaToSesionesDraftSinPlan(rutina)
      const sesionesSemanales = rutina.semanas[0]?.sesiones.length ?? 3
      dispatch({ type: 'SET_BASE_RUTINA', sesiones: sesionesDraft, rutinaBaseId: rutina.id, sesionesSemanales })
      dispatch({ type: 'SET_DESCRIPCION', descripcion: `Basada en la rutina de ${otroNombreCliente}` })
      setBaseDecidida(true)
      setShowOtroCliente(false)
    }

    // ── Phase B: base rutina selection ────────────────────────────────────────
    if (showBasePhase && state.cliente) {
      return (
        <div className="space-y-4">
          {/* Client banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <User size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{state.cliente.nombre} {state.cliente.apellido}</p>
              {state.cliente.planActivo && (
                <p className="text-[10px] text-gray-500">{state.cliente.planActivo}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowBasePhase(false)
                setBaseDecidida(false)
                setClienteRutinas([])
                dispatch({ type: 'RESET_PASO1' })
              }}
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
            >
              Cambiar
            </button>
          </div>

          <p className="text-xs text-gray-500">¿Querés crear la rutina en base a alguna existente?</p>

          <div className="space-y-2">
            {/* Desde cero */}
            <OptionCard
              selected={baseDecidida && !state.rutinaBaseId}
              onClick={() => {
                if (state.rutinaBaseId) {
                  dispatch({ type: 'RESET_PASO1' })
                  dispatch({ type: 'SET_CLIENTE', cliente: state.cliente! })
                }
                setBaseDecidida(true)
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <Plus size={15} className="text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white">Desde cero</p>
                  <p className="text-xs text-gray-500 mt-0.5">Crear una rutina nueva sin tomar ninguna como referencia</p>
                </div>
              </div>
            </OptionCard>

            {/* Existing rutinas del cliente destino */}
            {clienteRutinas.map(rutina => {
              const ejCount = rutina.semanas[0]?.sesiones.reduce(
                (sum, s) => sum + s.bloques.reduce((bs, b) => bs + b.ejerciciosPlan.length, 0), 0
              ) ?? 0
              return (
                <OptionCard
                  key={rutina.id}
                  selected={baseDecidida && state.rutinaBaseId === rutina.id && !showOtroCliente}
                  onClick={() => {
                    const sesionesDraft = rutinaToSesionesDraft(rutina)
                    const sesionesSemanales = rutina.semanas[0]?.sesiones.length ?? 3
                    dispatch({ type: 'SET_BASE_RUTINA', sesiones: sesionesDraft, rutinaBaseId: rutina.id, sesionesSemanales })
                    dispatch({ type: 'SET_DESCRIPCION', descripcion: '' })
                    setBaseDecidida(true)
                    setShowOtroCliente(false)
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{rutina.nombre}</p>
                      {rutina.activa && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 shrink-0">
                          Activa
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-1.5 text-[10px] text-gray-500">
                      <span>{rutina.semanas.length} semana{rutina.semanas.length !== 1 ? 's' : ''}</span>
                      {rutina.semanas[0] && (
                        <span>{rutina.semanas[0].sesiones.length} sesiones/sem</span>
                      )}
                      {ejCount > 0 && (
                        <span>{ejCount} ejercicio{ejCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {rutina.descripcion && (
                      <p className="text-[10px] text-gray-600 mt-1 truncate">{rutina.descripcion}</p>
                    )}
                  </div>
                </OptionCard>
              )
            })}

            {/* Desde la rutina de otro cliente */}
            <OptionCard
              selected={showOtroCliente}
              onClick={() => {
                setShowOtroCliente(true)
                setBaseDecidida(false)
                if (state.rutinaBaseId) {
                  dispatch({ type: 'RESET_PASO1' })
                  dispatch({ type: 'SET_CLIENTE', cliente: state.cliente! })
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <Copy size={15} className="text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white">Desde la rutina de otro cliente</p>
                  <p className="text-xs text-gray-500 mt-0.5">Copiar la estructura de la rutina de otro socio como base</p>
                </div>
              </div>
            </OptionCard>

            {/* Sub-búsqueda de otro cliente */}
            <AnimatePresence>
              {showOtroCliente && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-4 pl-4 border-l-2 border-primary/20 space-y-3">
                    {/* Buscador de otro cliente */}
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        value={otroSearch}
                        onChange={e => { setOtroSearch(e.target.value); setOtroRutinas([]) }}
                        placeholder="Buscar cliente (mín. 2 caracteres)"
                        className={inputCls + ' pl-9 text-xs py-2'}
                        autoFocus
                      />
                      {otroSearch && (
                        <button
                          type="button"
                          onClick={() => { setOtroSearch(''); setOtroResults([]); setOtroRutinas([]) }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Resultados de búsqueda */}
                    {otroLoadingSearch && (
                      <p className="text-xs text-gray-500 px-1">Buscando...</p>
                    )}
                    {!otroLoadingSearch && otroResults.length > 0 && (
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.04] overflow-hidden">
                        {otroResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => seleccionarOtroCliente(c.id, c.nombre, c.apellido)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="h-6 w-6 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-gray-500 dark:text-white/40">{c.nombre[0]}</span>
                            </div>
                            <span className="text-sm text-gray-900 dark:text-white">{c.nombre} {c.apellido}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Rutinas del otro cliente */}
                    {otroLoadingRutinas && (
                      <p className="text-xs text-gray-500 px-1">Cargando rutinas...</p>
                    )}
                    {!otroLoadingRutinas && otroRutinas.length === 0 && otroNombreCliente && (
                      <p className="text-xs text-gray-500 px-1">{otroNombreCliente} no tiene rutinas.</p>
                    )}
                    {!otroLoadingRutinas && otroRutinas.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-gray-500 px-1 uppercase tracking-wider font-semibold">Rutinas de {otroNombreCliente}</p>
                        {otroRutinas.map(rutina => {
                          const ejCount = rutina.semanas[0]?.sesiones.reduce(
                            (sum, s) => sum + s.bloques.reduce((bs, b) => bs + b.ejerciciosPlan.length, 0), 0
                          ) ?? 0
                          const isSelected = baseDecidida && state.rutinaBaseId === rutina.id
                          return (
                            <button
                              key={rutina.id}
                              type="button"
                              onClick={() => elegirRutinaOtroCliente(rutina)}
                              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                                isSelected
                                  ? 'border-primary/40 bg-primary/[0.06]'
                                  : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{rutina.nombre}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {rutina.activa && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                                      Activa
                                    </span>
                                  )}
                                  {isSelected && <Check size={12} className="text-primary" />}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-x-3 mt-1 text-[10px] text-gray-500">
                                <span>{rutina.semanas.length} sem.</span>
                                {rutina.semanas[0] && <span>{rutina.semanas[0].sesiones.length} días/sem</span>}
                                {ejCount > 0 && <span>{ejCount} ejercicios</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )
    }

    // ── Phase A: client search ────────────────────────────────────────────────
    return (
      <div className="space-y-5">
        <div>
          <label className={labelCls}>Buscar cliente</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre o apellido (mín. 2 caracteres)"
              className={inputCls + ' pl-9'}
            />
          </div>
        </div>

        {loadingSearch && (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-3 items-center rounded-xl bg-white/[0.02] px-4 py-3 animate-pulse">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {rawResults.length > 0 && !clienteSeleccionadoRaw && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {rawResults.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => void seleccionarCliente(r.id)}
                className="w-full text-left flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.07] hover:border-white/[0.14] transition-[background-color,border-color]"
              >
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={14} className="text-primary" />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.nombre} {r.apellido}</span>
              </button>
            ))}
          </div>
        )}

        {loadingCliente && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 animate-pulse">
            <div className="flex gap-4 items-center">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-24 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {clienteSeleccionadoRaw && !loadingCliente && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/30 bg-gradient-to-br from-[rgba(251,198,8,0.07)] to-transparent p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <User size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-base font-black text-gray-900 dark:text-white">{clienteSeleccionadoRaw.nombre} {clienteSeleccionadoRaw.apellido}</p>
                <p className="text-xs text-gray-400">
                  {clienteSeleccionadoRaw.planActivo
                    ? `${clienteSeleccionadoRaw.planActivo} · ${clienteSeleccionadoRaw.frecuenciaSemanal ?? '?'}× / semana`
                    : 'Sin plan activo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClienteSeleccionadoRaw(null)}
                className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${clienteSeleccionadoRaw.membresiaVigente ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className={clienteSeleccionadoRaw.membresiaVigente ? 'text-emerald-400' : 'text-red-400'}>
                {clienteSeleccionadoRaw.membresiaVigente ? 'Membresía vigente' : 'Sin membresía activa'}
              </span>
            </div>

            {localRutinas.length > 0 ? (
              <div className="space-y-2">
                {clienteSeleccionadoRaw.rutinaActivaNombre && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70 mb-0.5">Rutina activa</p>
                    <p className="text-sm text-amber-300 font-semibold">{clienteSeleccionadoRaw.rutinaActivaNombre}</p>
                  </div>
                )}
                <div className={clienteSeleccionadoRaw.rutinaActivaNombre ? 'grid grid-cols-2 gap-2' : ''}>
                  <button
                    type="button"
                    onClick={irAFaseBase}
                    className="w-full rounded-xl bg-primary text-black text-sm font-black py-2.5 hover:bg-primary/90 transition-colors"
                  >
                    Continuar
                  </button>
                  {clienteSeleccionadoRaw.rutinaActivaNombre && (
                    <button
                      type="button"
                      onClick={elegirMesociclo}
                      className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
                    >
                      Nuevo mesociclo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={confirmarClienteDirecto}
                className="w-full rounded-xl bg-primary text-black text-sm font-black py-2.5 hover:bg-primary/90 transition-colors"
              >
                Continuar con este cliente
              </button>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  // ── Paso 2 — Cantidad de sesiones semanales ────────────────────────────────

  function Paso2() {
    const freq = state.cliente?.frecuenciaSemanal ?? null
    const opciones = [2, 3, 4, 5]

    function isHabilitado(n: number): boolean {
      if (freq === null) return true
      if (freq <= 2) return n === 2
      if (freq === 3) return n <= 3
      return true
    }

    return (
      <div className="space-y-5">
        {freq !== null && (
          <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] px-4 py-3">
            <AlertCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              El plan del cliente permite hasta <strong className="text-gray-900 dark:text-white">{freq}× por semana</strong>.
              Solo se habilitan las opciones compatibles.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {opciones.map(n => {
            const hab = isHabilitado(n)
            return (
              <motion.button
                key={n}
                type="button"
                disabled={!hab}
                whileTap={hab ? { scale: 0.95 } : {}}
                onClick={() => dispatch({ type: 'SET_SESIONES_SEMANALES', cantidad: n })}
                className={[
                  'relative rounded-2xl border p-5 text-center transition-[border-color,background-color,box-shadow] duration-200',
                  !hab
                    ? 'border-gray-100 dark:border-white/[0.04] bg-gray-50/80 dark:bg-white/[0.02] opacity-35 cursor-not-allowed'
                    : state.sesionesSemanales === n
                    ? 'border-primary/60 dark:border-primary/50 bg-gradient-to-br from-amber-50 to-amber-50/0 dark:from-[rgba(251,198,8,0.10)] dark:to-transparent shadow-[0_4px_28px_rgba(251,198,8,0.22)] dark:shadow-[0_4px_24px_rgba(251,198,8,0.12)]'
                    : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-none hover:border-primary/40 dark:hover:border-white/[0.16] hover:bg-amber-50/40 dark:hover:bg-white/[0.07] hover:shadow-[0_4px_18px_rgba(251,198,8,0.13)] dark:hover:shadow-none',
                ].join(' ')}
              >
                {state.sesionesSemanales === n && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-md bg-primary">
                    <Check size={9} strokeWidth={3} className="text-black" />
                  </span>
                )}
                <span className={`text-3xl font-black block ${state.sesionesSemanales === n ? 'text-primary' : 'text-gray-800 dark:text-white'}`}>{n}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider mt-1 block ${state.sesionesSemanales === n ? 'text-amber-700 dark:text-primary/70' : 'text-gray-500 dark:text-white/40'}`}>días/semana</span>
                <span className={`text-[9px] mt-1 block leading-tight ${state.sesionesSemanales === n ? 'text-amber-600/80 dark:text-white/40' : 'text-gray-400 dark:text-white/25'}`}>{SESIONES_DESC[n]}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Paso 3 — Elegir plantilla ──────────────────────────────────────────────

  function Paso3() {
    const plantillas = plantillasOptions
    const loading    = loadingPlantillas

    function seleccionarPlantilla(p: PlantillaRutinaData) {
      const sesiones = generarEstructura(p, state.sesionesSemanales ?? p.cantidadSesiones)
      dispatch({ type: 'SET_PLANTILLA', plantillaId: p.id, sinPlantilla: false, sesiones })
    }

    function elegirManual() {
      const alreadyFilled = state.sesiones.length > 0
      const sesiones = alreadyFilled
        ? state.sesiones
        : generarEstructuraVacia(state.sesionesSemanales ?? 3)
      dispatch({ type: 'SET_PLANTILLA', plantillaId: null, sinPlantilla: true, sesiones })
      dispatch({ type: 'INIT_WIZARD_SEMANAS' })
      dispatch({ type: 'SET_PASO', paso: 4 })
    }

    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3 animate-pulse">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-full shrink-0 ml-auto" />
              </div>
              <Skeleton className="h-3.5 w-64 rounded-md" />
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {plantillas.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 mb-2">
            <AlertCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              No hay plantillas activas para {state.sesionesSemanales} sesiones.
              Podés continuar armando la rutina manualmente.
            </p>
          </div>
        )}

        {plantillas.map(p => (
          <OptionCard
            key={p.id}
            selected={state.plantillaId === p.id}
            onClick={() => seleccionarPlantilla(p)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{p.nombre}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${TIPO_COLORS[p.tipo]}`}>
                    {TIPO_LABELS[p.tipo]}
                  </span>
                  <span className="text-[10px] text-gray-500">{p.cantidadSesiones} sesiones</span>
                  {p.especializada && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-primary/15 text-primary border border-primary/30">
                      ⚡ Especializada
                    </span>
                  )}
                </div>
              </div>
              {/* Preview difuso — simula la vista de rutina */}
              <div className="shrink-0 flex gap-1 items-start pt-0.5">
                {p.sesiones.slice(0, state.sesionesSemanales ?? p.cantidadSesiones).map((s, si) => (
                  <div key={si} className="w-8 space-y-[3px]">
                    {/* Header de sesión — barra accent */}
                    <div className="h-[3px] w-full rounded-full bg-primary/30" />
                    {/* Bloques A y B fijos (movilidad/core) — leve amarillo */}
                    <div className="h-[3px] w-4/5 rounded-full bg-primary/20" />
                    <div className="h-[3px] w-3/5 rounded-full bg-primary/15" />
                    {/* Bloques variables C/D/E — líneas difusas blancas */}
                    {[0.9, 0.7, 0.85, 0.6, 0.75, 0.5].map((w, li) => (
                      <div
                        key={li}
                        className="h-[3px] rounded-full bg-white/[0.1]"
                        style={{ width: `${w * 100}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </OptionCard>
        ))}

        {/* Sin plantilla */}
        <button
          type="button"
          onClick={elegirManual}
          className={[
            'relative text-left rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] duration-200 w-full',
            state.sinPlantilla
              ? 'border-gray-400/40 bg-white/[0.05]'
              : 'border-white/10 bg-white/[0.04] hover:border-white/[0.16] hover:bg-white/[0.07]',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center shrink-0">
              <Wrench size={15} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">Sin plantilla — armar manualmente</p>
              <p className="text-xs text-gray-500 mt-0.5">Genera {state.sesionesSemanales} sesiones con bloques vacíos para configurar libremente</p>
            </div>
          </div>
        </button>
      </div>
    )
  }

  // ── Paso 4 — Revisar y ajustar estructura ──────────────────────────────────

  // ── Paso 4 — Asignar ejercicios (tabla inline idéntica a InlineEditRutinaTable) ──

  function Paso5() {
    const C = 'px-3 py-0 align-middle'
    const [showDiaPicker, setShowDiaPicker] = useState<string | null>(null)
    const [renamingSemanaId, setRenamingSemanaId] = useState<string | null>(null)
    const [renameSemanaVal, setRenameSemanaVal] = useState('')
    const [renamingSesionId, setRenamingSesionId] = useState<string | null>(null)
    const [renameSesionVal, setRenameSesionVal] = useState('')
    const [dragSemanaId, setDragSemanaId] = useState<string | null>(null)
    const [dragOverSemanaId, setDragOverSemanaId] = useState<string | null>(null)
    const [guiaExpanded, setGuiaExpanded] = useState(false)

    return (
      <div className="space-y-3">
      {/* ── Guía desplegable ── */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] overflow-hidden">
        <button
          type="button"
          onClick={() => setGuiaExpanded(v => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/[0.03] transition-colors text-left"
        >
          <AlertCircle size={13} className="text-primary/60 shrink-0" />
          <span className="text-xs font-semibold text-gray-700 dark:text-white/70 flex-1">
            ¿Cómo leer esta tabla?
          </span>
          <ChevronDown size={13} className={`text-primary/50 shrink-0 transition-transform duration-200 ${guiaExpanded ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {guiaExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t border-primary/10 space-y-3 pt-2.5">
                {/* Estructura jerárquica */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-white/60 uppercase tracking-wide mb-1.5">Estructura</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['Semana', 'Día', 'Bloque', 'Ejercicio'] as const).map((nivel, i, arr) => (
                      <span key={nivel} className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 dark:bg-white/[0.07] text-gray-800 dark:text-white/80">{nivel}</span>
                        {i < arr.length - 1 && <span className="text-gray-400 dark:text-white/20 text-xs">→</span>}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-white/40 mt-1.5 leading-relaxed">
                    Cada semana tiene días, cada día tiene bloques y cada bloque agrupa ejercicios. Hacé click en el nombre de semana o día para renombrarlo.
                  </p>
                </div>
                {/* Columnas */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-white/60 uppercase tracking-wide mb-1.5">Columnas</p>
                  <div className="space-y-1.5">
                    {[
                      { col: 'Bloque', desc: 'Letra del bloque (A, B, C…). Los ejercicios de un mismo bloque se ejecutan en circuito, uno tras otro sin descanso entre ellos.' },
                      { col: 'Ser.', desc: 'Cantidad de series a realizar.' },
                      { col: 'Reps', desc: 'Repeticiones por serie. Podés escribir un rango (ej: 8–12) o un número fijo.' },
                      { col: 'Peso', desc: 'Carga a utilizar (en kg). Podés dejarlo en blanco si el ejercicio no lleva carga fija.' },
                      { col: 'RIR', desc: 'Repeticiones en reserva — cuántas repeticiones te quedaban antes del fallo. 0 = hasta el fallo, 2 = te quedaban 2. Campo opcional.' },
                      { col: 'RPE', desc: 'Esfuerzo percibido del 1 al 10 (1 = sin esfuerzo, 10 = máximo esfuerzo). Alternativa al RIR. Campo opcional.' },
                      { col: 'Nota', desc: 'Indicaciones extras para el ejercicio (tempo, agarre, variante, etc.).' },
                    ].map(({ col, desc }) => (
                      <div key={col} className="flex gap-2">
                        <span className="text-[11px] font-semibold text-primary/80 shrink-0 w-14">{col}</span>
                        <span className="text-[11px] text-gray-500 dark:text-white/40 leading-relaxed">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Atajos */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-white/60 uppercase tracking-wide mb-1.5">Atajos</p>
                  <div className="space-y-1">
                    {[
                      'Arrastrá el ícono ⠿ de una semana para reordenarla.',
                      'Pasá el cursor sobre cualquier encabezado subrayado para ver su descripción.',
                    ].map((tip, i) => (
                      <p key={i} className="text-[11px] text-gray-500 dark:text-white/40 leading-relaxed flex gap-1.5">
                        <span className="text-primary/50 shrink-0">•</span>{tip}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="rounded-2xl border border-white/40 dark:border-white/[0.08] overflow-hidden">
        <div
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 230px)' }}
          ref={(el) => { if (el) el.scrollTop = paso4ScrollTop.current }}
          onScroll={(e) => { paso4ScrollTop.current = e.currentTarget.scrollTop }}
        >
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/40 dark:border-white/[0.08] bg-white/50 dark:bg-black/20 backdrop-blur-sm">
                {([
                  { label: 'Semana', tip: 'Click en el nombre para renombrar. Arrastrá para reordenar.' },
                  { label: 'Día', tip: 'Click en el nombre del día para personalizarlo (ej: Empuje, Pierna...)' },
                  { label: 'Bloque', tip: 'Letra del bloque (A, B, C...). Los ejercicios de un mismo bloque se realizan en circuito.' },
                  { label: 'Ejercicio', tip: '' },
                  { label: 'Ser.', tip: 'Series a realizar' },
                  { label: 'Reps', tip: 'Repeticiones por serie' },
                  { label: 'Peso', tip: 'Carga o peso a utilizar' },
                  { label: 'RIR/RPE', tip: 'RIR: repeticiones en reserva antes del fallo. RPE: esfuerzo percibido del 1 al 10.' },
                  { label: 'Nota', tip: 'Indicaciones adicionales para el ejercicio' },
                  { label: '', tip: '' },
                ] as const).map(({ label, tip }, i) => (
                  <th key={`h${i}`} title={tip || undefined} className={`py-2.5 text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest whitespace-nowrap cursor-default ${tip ? 'underline decoration-dotted decoration-gray-400/40' : ''} ${i < 3 ? 'px-3 text-left' : i === 3 ? 'px-4 text-left' : 'px-3 text-center'}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody
              onDragOver={e => {
                e.preventDefault()
                if (!dragSemanaId) return
                let el: Element | null = e.target as Element
                while (el && el.tagName !== 'TR') el = el.parentElement
                const sid = (el as HTMLTableRowElement | null)?.dataset.semId
                if (sid && sid !== dragSemanaId) setDragOverSemanaId(sid)
              }}
              onDrop={e => {
                e.preventDefault()
                let el: Element | null = e.target as Element
                while (el && el.tagName !== 'TR') el = el.parentElement
                const sid = (el as HTMLTableRowElement | null)?.dataset.semId
                if (dragSemanaId && sid && sid !== dragSemanaId) {
                  dispatch({ type: 'REORDER_SEMANAS_W', fromId: dragSemanaId, toId: sid })
                }
                setDragSemanaId(null)
                setDragOverSemanaId(null)
              }}
              onDragEnd={() => { setDragSemanaId(null); setDragOverSemanaId(null) }}
            >
              {state.semanasWizard.flatMap((sem, semIdx): React.ReactNode[] => {
                const semLabel = sem.nombre?.trim() ? sem.nombre : `S${sem.numero}`
                const rows: React.ReactNode[] = []
                let semShown = false

                const semCell = () => {
                  const shown = semShown
                  semShown = true
                  if (shown) return <td key="sc" className={`w-[120px] ${C}`} />

                  const isRenaming = renamingSemanaId === sem._id
                  const isDragOver = dragOverSemanaId === sem._id

                  return (
                    <td key="sc" className={`px-2 py-2.5 w-[120px] align-top ${isDragOver ? 'bg-primary/[0.04]' : ''}`}>
                      <div className="flex items-center gap-0.5 group/sem">
                        {/* Drag handle */}
                        <div
                          draggable
                          onDragStart={e => { e.stopPropagation(); setDragSemanaId(sem._id); e.dataTransfer.effectAllowed = 'move' }}
                          className="cursor-grab active:cursor-grabbing p-1 rounded text-gray-300 dark:text-white/30 hover:text-gray-500 dark:hover:text-white/60 transition-colors shrink-0"
                          title="Arrastrar para reordenar"
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>

                        {isRenaming ? (
                          <form
                            onSubmit={e => { e.preventDefault(); dispatch({ type: 'RENAME_SEMANA_W', semanaId: sem._id, nombre: renameSemanaVal.trim() || `S${sem.numero}` }); setRenamingSemanaId(null) }}
                            className="flex items-center gap-1 flex-1 min-w-0"
                          >
                            <input
                              autoFocus
                              value={renameSemanaVal}
                              onChange={e => setRenameSemanaVal(e.target.value)}
                              onBlur={() => { dispatch({ type: 'RENAME_SEMANA_W', semanaId: sem._id, nombre: renameSemanaVal.trim() || `S${sem.numero}` }); setRenamingSemanaId(null) }}
                              className="w-14 bg-white dark:bg-white/[0.08] border border-primary/40 rounded-md px-1.5 py-0.5 text-[11px] text-gray-900 dark:text-white focus:outline-none"
                            />
                            <button type="submit" className="p-0.5 rounded text-primary shrink-0">
                              <Check className="w-3 h-3" />
                            </button>
                          </form>
                        ) : (
                          <span
                            className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-lg text-primary/90 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-primary/20 transition-colors"
                            title="Click para renombrar"
                            onClick={() => { setRenamingSemanaId(sem._id); setRenameSemanaVal(sem.nombre ?? '') }}
                          >
                            {semLabel}
                          </span>
                        )}

                        {!isRenaming && (
                          <>
                            <button onClick={() => dispatch({ type: 'CLONE_SEMANA_W', semanaId: sem._id })} title="Duplicar" className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-primary opacity-0 group-hover/sem:opacity-100 transition-all shrink-0">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => dispatch({ type: 'DELETE_SEMANA_W', semanaId: sem._id })} title="Eliminar" className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-red-400 opacity-0 group-hover/sem:opacity-100 transition-all shrink-0">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )
                }

                // Semana sin sesiones
                if (sem.sesiones.length === 0) {
                  rows.push(
                    <tr key={`${sem._id}-empty`} data-sem-id={sem._id} className={semIdx > 0 ? 'border-t-2 border-gray-200 dark:border-white/[0.1]' : ''}>
                      {semCell()}
                      <td colSpan={8} className="px-4 py-2.5">
                        <div className="relative flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-white/30">Sin días</span>
                          <button onClick={() => setShowDiaPicker(sem._id)} className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
                            <Plus className="w-3 h-3" /> Agregar día
                          </button>
                          <AnimatePresence>
                            {showDiaPicker === sem._id && (
                              <SesionDayDropdownW existentes={[]} semanaId={sem._id} onSelect={(sId, dia) => { dispatch({ type: 'ADD_SESION_W', semanaId: sId, dia }); setShowDiaPicker(null) }} onClose={() => setShowDiaPicker(null)} />
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                      <td className="w-[60px]" />
                    </tr>
                  )
                  rows.push(
                    <tr key={`${sem._id}-adddia`} data-sem-id={sem._id} className="border-t-2 border-gray-200 dark:border-white/[0.08]">
                      <td className={`w-[120px] ${C}`} />
                      <td colSpan={8} className="px-4 py-2.5" />
                    </tr>
                  )
                  return rows
                }

                sem.sesiones.forEach((ses, sesIdx) => {
                  let diaShown = false

                  const diaCell = () => {
                    const shown = diaShown
                    diaShown = true
                    if (shown) return <td key="dc" className={`w-[110px] ${C}`} />

                    const isRenamingSes = renamingSesionId === ses._id
                    return (
                      <td key="dc" className="px-3 py-2.5 w-[110px] align-top">
                        <div className="flex flex-col gap-0.5 group/dia">
                          {ses.nombre?.trim() && (
                            <span className="text-[10px] text-gray-500 dark:text-white/40 font-medium whitespace-nowrap">{ses.dia}</span>
                          )}
                          {isRenamingSes ? (
                            <form
                              onSubmit={e => { e.preventDefault(); dispatch({ type: 'RENAME_SESION_W', semanaId: sem._id, sesionId: ses._id, nombre: renameSesionVal.trim() }); setRenamingSesionId(null) }}
                              className="flex items-center gap-1"
                            >
                              <input
                                autoFocus
                                value={renameSesionVal}
                                onChange={e => setRenameSesionVal(e.target.value)}
                                placeholder={ses.dia}
                                onBlur={() => { dispatch({ type: 'RENAME_SESION_W', semanaId: sem._id, sesionId: ses._id, nombre: renameSesionVal.trim() }); setRenamingSesionId(null) }}
                                className="w-16 bg-white dark:bg-white/[0.08] border border-primary/40 rounded-md px-1.5 py-0.5 text-[11px] text-gray-900 dark:text-white focus:outline-none"
                              />
                              <button type="submit" className="p-0.5 rounded text-primary shrink-0">
                                <Check className="w-3 h-3" />
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span
                                className="text-sm text-gray-700 dark:text-white/70 font-semibold whitespace-nowrap cursor-pointer hover:text-primary dark:hover:text-primary transition-colors"
                                title="Click para personalizar nombre"
                                onClick={() => { setRenamingSesionId(ses._id); setRenameSesionVal(ses.nombre ?? '') }}
                              >
                                {ses.nombre?.trim() ? ses.nombre : ses.dia}
                              </span>
                              <button onClick={() => dispatch({ type: 'DELETE_SESION_W', semanaId: sem._id, sesionId: ses._id })} className="p-0.5 rounded text-gray-400 dark:text-white/45 hover:text-red-400 opacity-0 group-hover/dia:opacity-100 transition-all">
                                <X className="w-2 h-2" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  }

                  const diaBorder = sesIdx > 0 ? 'border-t border-gray-200 dark:border-white/[0.07]' : semIdx > 0 && sesIdx === 0 ? 'border-t-2 border-gray-200 dark:border-white/[0.1]' : ''

                  if (ses.bloques.length === 0) {
                    rows.push(
                      <tr key={`${ses._id}-empty`} data-sem-id={sem._id} className={diaBorder}>
                        {semCell()}{diaCell()}
                        <td colSpan={7} className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 dark:text-white/30">Sin bloques</span>
                            <button onClick={() => dispatch({ type: 'ADD_BLOQUE_W', sesionId: ses._id })} className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
                              <Plus className="w-3 h-3" /> Agregar bloque
                            </button>
                          </div>
                        </td>
                        <td className="w-[60px]" />
                      </tr>
                    )
                    semShown = true
                    return
                  }

                  ses.bloques.forEach((bl, blqIdx) => {
                    let blShown = false

                    const blCell = () => {
                      const shown = blShown
                      blShown = true
                      if (shown) return <td key="bc" className={`w-[76px] ${C}`} />

                      // Total ejercicios de todos los slots de esta letra
                      const totalEjLetra = ses.bloques
                        .filter(b => b.letra === bl.letra)
                        .reduce((sum, b) => sum + Math.max(b.ejercicios.length, 1), 0)

                      // Patrones de cada slot de esta letra (en orden, multi-patron)
                      const patronesLetra = ses.bloques
                        .filter(b => b.letra === bl.letra)
                        .flatMap(b => b.patrones.map(p => p.patronMovimiento))
                        .filter((p): p is string => p != null)

                      return (
                        <td key="bc" className="px-2 py-2 w-[76px] text-center align-top">
                          <div className="flex flex-col items-center gap-1 group/bl">
                            <div className="flex items-center gap-0.5">
                              <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center">{bl.letra}</span>
                              <button onClick={() => dispatch({ type: 'DELETE_BLOQUE_W', sesionId: ses._id, bloqueId: bl._id })} className="p-1 rounded text-gray-400 dark:text-white/45 hover:text-red-400 opacity-0 group-hover/bl:opacity-100 transition-all">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            {/* Cantidad de ejercicios esperados */}
                            <span className="text-[9px] font-semibold text-gray-400 dark:text-white/35 tabular-nums">
                              {totalEjLetra} ej.
                            </span>
                            {/* Patrones del bloque */}
                            {patronesLetra.length > 0 && (
                              <div className="space-y-[2px] max-w-[72px]">
                                {patronesLetra.map((p, pi) => (
                                  <span key={pi} className="block text-[8px] text-gray-400 dark:text-white/25 leading-tight">
                                    {patrones.find(pat => pat.clave === p)?.label ?? p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    }

                    const blBorder = blqIdx > 0 ? 'border-t border-gray-200 dark:border-white/[0.05]' : ''

                    if (bl.ejercicios.length === 0) {
                      const bt = sesIdx === 0 && blqIdx === 0 ? diaBorder : blBorder
                      rows.push(
                        <tr key={`${bl._id}-empty`} data-sem-id={sem._id} className={bt}>
                          {semCell()}{diaCell()}{blCell()}
                          <td colSpan={6} className="px-4 py-2">
                            <button onClick={() => dispatch({ type: 'ADD_EJ_W', bloqueId: bl._id, nombre: '' })} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40 hover:text-primary transition-colors py-0.5">
                              <Plus className="w-3 h-3" /> Agregar ejercicio
                            </button>
                          </td>
                          <td className="w-[60px]" />
                        </tr>
                      )
                      semShown = true
                      return
                    }

                    bl.ejercicios.forEach((ej, ejIdx) => {
                      const isEditing = editingEjId === ej._id
                      const isAssigning = assigningEjId === ej._id
                      let bt: string
                      if (ejIdx === 0 && blqIdx === 0 && sesIdx === 0) bt = diaBorder
                      else if (ejIdx === 0 && blqIdx === 0) bt = diaBorder
                      else if (ejIdx === 0) bt = blBorder
                      else bt = 'border-t border-gray-100 dark:border-white/[0.03]'

                      rows.push(
                        <Fragment key={ej._id}>
                          <tr data-sem-id={sem._id} className={`transition-colors ${isEditing ? 'bg-primary/[0.02] ring-1 ring-inset ring-primary/10' : 'group/ejrow hover:bg-white/[0.03]'} ${bt}`}>
                            {semCell()}{diaCell()}{blCell()}

                            {isEditing ? (
                              <EjWizardInlineCells
                                ej={ej}
                                onUpdate={changes => {
                                  dispatch({ type: 'UPDATE_EJ_W', sesionId: ses._id, bloqueId: bl._id, ejId: ej._id, changes })
                                  setEditingEjId(null)
                                }}
                                onCancel={() => setEditingEjId(null)}
                                onAssign={() => { setEditingEjId(null); setAssigningEjId(ej._id) }}
                              />
                            ) : isAssigning ? (
                              <td colSpan={7} className="px-3 py-2">
                                <SearchableExerciseSelector
                                  patronHint={bl.patrones[0]?.patronMovimiento ?? null}
                                  patrones={patrones}
                                  onSelect={catalogo => {
                                    dispatch({ type: 'UPDATE_EJ_W', sesionId: ses._id, bloqueId: bl._id, ejId: ej._id, changes: { catalogoId: catalogo.id, nombre: catalogo.nombre, _esReferencia: false } })
                                    setAssigningEjId(null)
                                  }}
                                  onCancel={() => setAssigningEjId(null)}
                                />
                              </td>
                            ) : (
                              <>
                                {/* Nombre ejercicio */}
                                <td className="px-4 py-2.5">
                                  {ej._esReferencia ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-white/[0.06] px-1.5 py-0.5 rounded-md shrink-0">anterior</span>
                                      <span className="text-xs text-gray-400 truncate">{ej._referenciaData?.nombre ?? ej.nombre}</span>
                                      <button type="button" onClick={() => setAssigningEjId(ej._id)}
                                        className="text-[10px] text-primary hover:text-primary/80 transition-colors shrink-0 ml-auto">
                                        asignar nuevo
                                      </button>
                                    </div>
                                  ) : ej.nombre ? (
                                    <span className="text-sm text-gray-900 dark:text-white/90 font-medium block">{ej.nombre}</span>
                                  ) : (
                                    <button type="button" onClick={() => setAssigningEjId(ej._id)}
                                      className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 hover:text-primary transition-colors">
                                      <Search size={11} />
                                      Buscar ejercicio...
                                    </button>
                                  )}
                                </td>
                                {/* Series */}
                                <td className="px-3 py-2.5 text-center">
                                  {(() => {
                                    const v = ej._esReferencia ? ej._referenciaData?.series : ej.series
                                    return v != null
                                      ? <span className="text-xs tabular-nums bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md text-gray-600 dark:text-white/60 font-medium">{v}×</span>
                                      : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>
                                  })()}
                                </td>
                                {/* Reps */}
                                <td className="px-3 py-2.5 text-center">
                                  {(() => {
                                    const v = ej._esReferencia ? ej._referenciaData?.repeticiones : ej.repeticiones
                                    return v
                                      ? <span className="text-xs text-gray-500 dark:text-white/55">{v}</span>
                                      : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>
                                  })()}
                                </td>
                                {/* Peso */}
                                <td className="px-3 py-2.5 text-center">
                                  {(() => {
                                    const v = ej._esReferencia ? ej._referenciaData?.peso : ej.peso
                                    return v
                                      ? <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary/80 rounded-md font-medium">{v}</span>
                                      : <span className="text-gray-300 dark:text-white/15 text-xs">—</span>
                                  })()}
                                </td>
                                {/* RIR/RPE */}
                                <td className="px-3 py-2.5 text-center">
                                  {(() => {
                                    const rir = ej._esReferencia ? ej._referenciaData?.rir : ej.rir
                                    const rpe = ej.rpe
                                    return (
                                      <div className="flex items-center justify-center gap-1 text-[11px]">
                                        {rir != null && <span className="text-gray-400 dark:text-white/40">RIR <span className="font-semibold text-gray-600 dark:text-white/65">{rir}</span></span>}
                                        {rpe != null && <span className="text-gray-400 dark:text-white/40">RPE <span className="font-semibold text-gray-600 dark:text-white/65">{rpe}</span></span>}
                                        {rir == null && rpe == null && <span className="text-gray-300 dark:text-white/15 text-xs">—</span>}
                                      </div>
                                    )
                                  })()}
                                </td>
                                {/* Nota */}
                                <td className="px-3 py-2.5">
                                  {ej.notas
                                    ? <span className="text-xs text-gray-400 dark:text-white/35 italic">{ej.notas}</span>
                                    : <span className="text-gray-300 dark:text-white/10 text-xs">—</span>}
                                </td>
                                {/* Acciones */}
                                <td className="px-2 py-2.5 text-center w-[56px]">
                                  <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover/ejrow:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => setEditingEjId(ej._id)}
                                      className="p-1.5 rounded-lg text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-white/[0.08] transition-colors">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button type="button" onClick={() => dispatch({ type: 'DELETE_EJ_W', sesionId: ses._id, bloqueId: bl._id, ejId: ej._id })}
                                      className="p-1.5 rounded-lg text-gray-500 dark:text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>

                        </Fragment>
                      )
                      semShown = true
                    })

                    // Fila agregar ejercicio al bloque
                    rows.push(
                      <tr key={`${bl._id}-addej`} data-sem-id={sem._id}>
                        <td className={`w-[120px] ${C}`} /><td className={`w-[90px] ${C}`} /><td className={`w-[60px] ${C}`} />
                        <td colSpan={6} className="px-4 py-1.5">
                          <button onClick={() => dispatch({ type: 'ADD_EJ_W', bloqueId: bl._id, nombre: '' })}
                            className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/40 hover:text-primary transition-colors py-0.5">
                            <Plus className="w-3 h-3" /> ej. en bloque {bl.letra}
                          </button>
                        </td>
                        <td className="w-[56px]" />
                      </tr>
                    )
                  })

                  // Fila agregar bloque a la sesión
                  rows.push(
                    <tr key={`${ses._id}-addbl`} data-sem-id={sem._id} className="border-t border-gray-100 dark:border-white/[0.06]">
                      <td className={`w-[120px] ${C}`} /><td className={`w-[90px] ${C}`} />
                      <td colSpan={7} className="px-4 py-2">
                        <button onClick={() => dispatch({ type: 'ADD_BLOQUE_W', sesionId: ses._id })}
                          className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/40 hover:text-primary transition-colors">
                          <Plus className="w-3.5 h-3.5" /> bloque en {ses.dia}
                        </button>
                      </td>
                      <td className="w-[56px]" />
                    </tr>
                  )
                })

                // Fila agregar día a la semana
                rows.push(
                  <tr key={`${sem._id}-adddia`} data-sem-id={sem._id} className="border-t-2 border-gray-200 dark:border-white/[0.08]">
                    <td className={`w-[120px] ${C}`} />
                    <td colSpan={8} className="px-4 py-2.5 relative">
                      <button onClick={() => setShowDiaPicker(v => v === sem._id ? null : sem._id)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40 hover:text-primary transition-colors">
                        <Plus className="w-3.5 h-3.5" /> día en {semLabel}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <AnimatePresence>
                        {showDiaPicker === sem._id && (
                          <SesionDayDropdownW
                            existentes={sem.sesiones.map(s => s.dia)}
                            semanaId={sem._id}
                            onSelect={(sId, dia) => { dispatch({ type: 'ADD_SESION_W', semanaId: sId, dia }); setShowDiaPicker(null) }}
                            onClose={() => setShowDiaPicker(null)}
                          />
                        )}
                      </AnimatePresence>
                    </td>
                    <td className="w-[56px]" />
                  </tr>
                )

                return rows
              })}

              {/* Fila agregar semana */}
              <tr className="border-t-2 border-gray-200 dark:border-white/[0.1]">
                <td colSpan={9} className="px-4 py-3">
                  <button onClick={() => dispatch({ type: 'ADD_SEMANA_W' })}
                    className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30 hover:text-primary transition-colors">
                    <Plus className="w-3.5 h-3.5" /> nueva semana
                  </button>
                </td>
              </tr>

              {state.semanasWizard.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-500 dark:text-white/40">Sin semanas todavía</p>
                      <p className="text-xs text-gray-400 dark:text-white/25">
                        Presioná <span className="font-semibold text-primary/70">"+ nueva semana"</span> para agregar la primera, o avanzá al paso siguiente si ya configuraste la estructura antes.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    )
  }

  // ── Paso 6 — Configuración ─────────────────────────────────────────────────

  const configSchema = z.object({
    nombre:      z.string().min(1, 'El nombre es requerido'),
    fechaInicio: z.string().min(1, 'La fecha es requerida'),
    periodo:     z.enum(['CARGA', 'IMPACTO', 'DESCARGA', 'MANTENIMIENTO']).optional(),
    descripcion: z.string().optional(),
  })
  type ConfigForm = z.infer<typeof configSchema>

  function Paso6() {
    const sugerencia = state.nombre || (() => {
      if (state.cliente) return `Rutina — ${state.cliente.nombre} ${state.cliente.apellido}`
      return ''
    })()

    const semanasSugeridas = state.semanasWizard.length > 0 ? state.semanasWizard.length : 1

    const [profesores, setProfesores] = useState<Array<{ id: string; nombre: string }>>([])
    const [selectedProfesorId, setSelectedProfesorId] = useState<string>(state.profesorId ?? '')

    useEffect(() => {
      usuariosApi.getAll()
        .then(users => {
          const profs = users
            .filter(u => u.rol === 'PROFESOR' && u.activo && u.profesor)
            .map(u => ({ id: u.profesor!.id, nombre: u.nombre }))
          setProfesores(profs)
        })
        .catch(() => setProfesores([]))
    }, [])

    const { register, handleSubmit, watch, formState: { errors } } = useForm<ConfigForm>({
      resolver: zodResolver(configSchema),
      defaultValues: {
        nombre:      sugerencia,
        fechaInicio: state.fechaInicio,
        periodo:     state.periodo ?? undefined,
        descripcion: state.descripcion,
      },
    })

    function onValid(data: ConfigForm) {
      dispatch({
        type: 'SET_CONFIG',
        nombre: data.nombre,
        cantidadSemanas: semanasSugeridas,
        fechaInicio: data.fechaInicio,
        periodo: (data.periodo as PeriodoEntrenamiento) ?? null,
        descripcion: data.descripcion ?? '',
        profesorId: selectedProfesorId || null,
      })
      dispatch({ type: 'SET_PASO', paso: 6 })
    }

    return (
      <form id="form-paso6" onSubmit={handleSubmit(onValid)} className="space-y-5">
        <div>
          <label className={labelCls}>Nombre de la rutina *</label>
          <input {...register('nombre')} className={inputCls} placeholder="Meso 1 — Full Body" />
          {errors.nombre && <p className="mt-1 text-xs text-red-400">{errors.nombre.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Duración (semanas)</label>
            <div className={inputCls + ' flex items-center gap-2 cursor-default select-none opacity-60'}>
              <span className="font-semibold">{semanasSugeridas}</span>
              <span className="text-xs text-gray-400 dark:text-white/30">
                {semanasSugeridas === 1 ? 'semana' : 'semanas'} definidas en la estructura
              </span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Fecha de inicio</label>
            <input type="date" {...register('fechaInicio')} className={inputCls} />
            {errors.fechaInicio && <p className="mt-1 text-xs text-red-400">{errors.fechaInicio.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>Profesor (opcional)</label>
          <select
            value={selectedProfesorId}
            onChange={e => setSelectedProfesorId(e.target.value)}
            className={inputCls + ' cursor-pointer'}
          >
            <option value="">— Sin asignar —</option>
            {profesores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {profesores.length === 0 && (
            <p className="mt-1 text-[10px] text-gray-400 dark:text-white/30">No hay profesores registrados en el sistema</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Período de entrenamiento (opcional)</label>
          <select {...register('periodo')} className={inputCls}>
            <option value="">— Sin especificar —</option>
            {(Object.keys(PERIODO_LABELS) as PeriodoEntrenamiento[]).map(p => (
              <option key={p} value={p}>{PERIODO_LABELS[p]}</option>
            ))}
          </select>
          {watch('periodo') && (
            <p className="mt-1 text-[10px] text-gray-400 dark:text-white/35 leading-snug pl-0.5">
              {PERIODO_DESCS[watch('periodo')!]}
            </p>
          )}
        </div>

        <div>
          <label className={labelCls}>Descripción (opcional)</label>
          <textarea
            {...register('descripcion')}
            rows={3}
            className={inputCls + ' resize-none'}
            placeholder="Objetivos, notas para el cliente, etc."
          />
        </div>
      </form>
    )
  }

  // ── Paso 7 — Confirmar y guardar ───────────────────────────────────────────

  function Paso7() {
    const totalBloques = state.semanasWizard.length > 0
      ? state.semanasWizard.reduce((sum, sem) =>
          sum + sem.sesiones.reduce((ss, ses) => ss + ses.bloques.length, 0), 0)
      : state.sesiones.reduce((sum, s) => sum + s.bloques.length, 0)

    const totalEjercicios = state.semanasWizard.length > 0
      ? state.semanasWizard.reduce((sum, sem) =>
          sum + sem.sesiones.reduce((ss, ses) =>
            ss + ses.bloques.reduce((bs, b) => bs + b.ejercicios.filter(e => e.nombre && !e._esReferencia).length, 0), 0), 0)
      : state.sesiones.reduce((sum, s) =>
          sum + s.bloques.reduce((bs, b) => bs + b.ejercicios.filter(e => e.nombre).length, 0), 0)

    const totalSesiones = state.semanasWizard.length > 0
      ? state.semanasWizard.reduce((sum, sem) => sum + sem.sesiones.length, 0)
      : state.sesiones.length

    const resumen = [
      {
        icon: User,
        label: 'Cliente',
        value: state.cliente ? `${state.cliente.nombre} ${state.cliente.apellido}` : '—',
        sub: state.cliente?.planActivo ?? undefined,
      },
      {
        icon: Layers,
        label: 'Plantilla',
        value: state.sinPlantilla ? 'Armado manualmente' : (state.plantillaId ? 'Plantilla seleccionada' : '—'),
      },
      {
        icon: ClipboardList,
        label: 'Estructura',
        value: `${totalSesiones} sesiones · ${totalBloques} bloques en total`,
      },
      {
        icon: Dumbbell,
        label: 'Ejercicios',
        value: `${totalEjercicios} ejercicio${totalEjercicios !== 1 ? 's' : ''} asignados`,
      },
      {
        icon: Settings2,
        label: 'Configuración',
        value: state.nombre || '—',
        sub: `${state.cantidadSemanas} semanas · desde ${state.fechaInicio}${state.periodo ? ` · ${PERIODO_LABELS[state.periodo]}` : ''}`,
      },
    ]

    return (
      <div className="space-y-3">
        {resumen.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <item.icon size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{item.value}</p>
              {item.sub && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
            </div>
          </motion.div>
        ))}

        {state.modo === 'mesociclo' && state.rutinaBaseId && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 mt-2">
            <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Al guardar, la rutina anterior quedará inactiva y esta pasará a ser la rutina activa del cliente.
            </p>
          </div>
        )}
      </div>
    )
  }

  // ── Lógica de navegación ───────────────────────────────────────────────────

  function canGoNext(): boolean {
    switch (state.paso) {
      case 1: return state.cliente !== null && (!showBasePhase || baseDecidida)
      case 2: return state.sesionesSemanales !== null
      case 3: return state.sinPlantilla || state.plantillaId !== null
      case 4: return true
      case 5: return false // Controlado por el form submit
      case 6: return false // Controlado por el botón guardar
      default: return false
    }
  }

  async function handleNext() {
    if (state.paso === 1) {
      if (showBasePhase && state.rutinaBaseId) {
        dispatch({ type: 'INIT_WIZARD_SEMANAS' })
        dispatch({ type: 'SET_PASO', paso: 4 })
      } else {
        dispatch({ type: 'SET_PASO', paso: 2 })
      }
      return
    }
    if (state.paso === 2 && state.modo === 'mesociclo') {
      if (state.rutinaBaseId) {
        try {
          const rutina = await rutinasApi.getById(state.rutinaBaseId)
          const primerasSemanas = rutina.semanas[0]
          if (primerasSemanas) {
            const sesionesDraft: SesionDraft[] = primerasSemanas.sesiones.map((s, si) => ({
              _id: uid(),
              numero: si + 1,
              bloques: s.bloques.map((b, bi) => ({
                _id: uid(),
                letra: LETRAS[bi] ?? String.fromCharCode(65 + bi),
                orden: bi,
                patrones: [],
                ejercicios: b.ejerciciosPlan.map(e => ({
                  _id: uid(),
                  nombre: '',
                  _esReferencia: true,
                  _referenciaData: {
                    nombre: e.nombre,
                    series: e.series,
                    repeticiones: e.repeticiones ?? undefined,
                    peso: e.peso ?? undefined,
                    rir: e.rir ?? undefined,
                  },
                })),
              })),
            }))
            dispatch({ type: 'INIT_MESOCICLO', sesiones: sesionesDraft, rutinaBaseId: state.rutinaBaseId })
          }
        } catch {
          addToast('No se pudo cargar la rutina base', 'error')
        }
      }
      dispatch({ type: 'INIT_WIZARD_SEMANAS' })
      dispatch({ type: 'SET_PASO', paso: 4 })
      return
    }
    // Al pasar de Paso 3 a Paso 4 (ejercicios) inicializar semanasWizard desde state.sesiones
    if (state.paso === 3 && !state.sinPlantilla) {
      dispatch({ type: 'INIT_WIZARD_SEMANAS' })
    }
    if (state.paso < 6) {
      dispatch({ type: 'SET_PASO', paso: state.paso + 1 })
    }
  }

  function handleBack() {
    if (state.paso <= 1) {
      if (showBasePhase) {
        setShowBasePhase(false)
        setBaseDecidida(false)
        setClienteRutinas([])
        dispatch({ type: 'RESET_PASO1' })
        return
      }
      navigate(-1)
      return
    }
    if (state.paso === 2 && clienteIdFromUrl) {
      if (clienteRutinas.length === 0) {
        navigate(`/clients/${clienteIdFromUrl}`)
      } else {
        navigate(`/clients/${clienteIdFromUrl}/rutina`)
      }
      return
    }
    if (state.paso === 4 && state.modo === 'mesociclo') {
      dispatch({ type: 'SET_PASO', paso: 2 })
      return
    }
    if (state.paso === 4 && state.sinPlantilla && state.rutinaBaseId && state.modo === 'nueva') {
      dispatch({ type: 'SET_PASO', paso: 1 })
      return
    }
    if (state.paso === 4 && state.sinPlantilla) {
      dispatch({ type: 'SET_PASO', paso: 3 })
      return
    }
    dispatch({ type: 'SET_PASO', paso: state.paso - 1 })
  }

  async function handleGuardar() {
    if (!state.cliente) return
    setIsSaving(true)
    try {
      // Usar semanasWizard si está poblado, sino fallback a sesiones (compatibilidad)
      const sesionesPayload: CrearCompletaPayload['sesiones'] = state.semanasWizard.length > 0
        ? state.semanasWizard.flatMap(sem =>
            sem.sesiones.map((ses, sesIdx) => ({
              numero: sesIdx + 1,
              nombre: ses.nombre?.trim() || ses.dia,
              bloques: ses.bloques.map((b, bi) => ({
                letra: b.letra,
                orden: bi,
                patronMovimiento: b.patrones[0]?.patronMovimiento ?? undefined,
                ejercicios: b.ejercicios
                  .filter(e => e.nombre && !e._esReferencia)
                  .map((e, ei) => ({
                    catalogoId: e.catalogoId,
                    nombre: e.nombre,
                    series: e.series,
                    repeticiones: e.repeticiones,
                    peso: e.peso,
                    rir: e.rir,
                    rpe: e.rpe,
                    metodo: e.metodo,
                    notas: e.notas,
                    orden: ei,
                  })),
              })),
            }))
          )
        : state.sesiones.map((s, si) => ({
            numero: si + 1,
            nombre: s.nombre,
            bloques: s.bloques.map((b, bi) => ({
              letra: b.letra,
              orden: bi,
              patronMovimiento: b.patronMovimiento ?? undefined,
              ejercicios: b.ejercicios
                .filter(e => e.nombre && !e._esReferencia)
                .map((e, ei) => ({
                  catalogoId: e.catalogoId,
                  nombre: e.nombre,
                  series: e.series,
                  repeticiones: e.repeticiones,
                  peso: e.peso,
                  rir: e.rir,
                  rpe: e.rpe,
                  metodo: e.metodo,
                  notas: e.notas,
                  orden: ei,
                })),
            })),
          }))

      const payload: CrearCompletaPayload = {
        clienteId: state.cliente.id,
        nombre: state.nombre,
        descripcion: state.descripcion || undefined,
        cantidadSemanas: state.cantidadSemanas,
        fechaInicio: state.fechaInicio || undefined,
        periodo: state.periodo ?? undefined,
        plantillaId: state.plantillaId ?? undefined,
        rutinaBaseId: state.rutinaBaseId ?? undefined,
        profesorId: state.profesorId ?? undefined,
        sesiones: sesionesPayload,
      }
      await rutinasApi.crearCompleta(payload)
      addToast('Rutina creada correctamente', 'success')
      navigate(`/clients/${state.cliente.id}/rutina`)
    } catch {
      addToast('Error al crear la rutina. Intentá de nuevo.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Step header info ───────────────────────────────────────────────────────

  const STEP_META_LOCAL: Record<number, { Icon: typeof User; title: string; desc: string }> = {
    1: { Icon: User,         title: 'Seleccionar cliente',    desc: 'Buscá al cliente al que le vas a crear la rutina' },
    2: { Icon: ClipboardList,title: 'Sesiones semanales',      desc: 'Elegí cuántas veces por semana va a entrenar' },
    3: { Icon: Layers,       title: 'Plantilla',               desc: 'Elegí una estructura base o armá la rutina manualmente' },
    4: { Icon: Dumbbell,     title: 'Asignar ejercicios',      desc: 'Seleccioná y configurá los ejercicios de cada bloque' },
    5: { Icon: Settings2,    title: 'Configuración',           desc: 'Nombre, duración y período de la rutina' },
    6: { Icon: Eye,          title: 'Confirmar y guardar',     desc: 'Revisá el resumen antes de crear la rutina' },
  }

  const stepMeta = (state.paso === 1 && showBasePhase)
    ? { Icon: Layers, title: 'Base de la rutina', desc: '¿Crear desde cero o usar una rutina existente como referencia?' }
    : STEP_META_LOCAL[state.paso]

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingClienteInit) {
    return (
      <div className="space-y-6">
        {/* Back button — siempre interactivo */}
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Volver</span>
        </button>

        {/* Título */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Wizard card — misma clase glass que el real */}
        <div className={`${glass} overflow-hidden`}>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="p-6 md:p-8">

            {/* Stepper: 6 círculos con conectores + etiquetas */}
            <div className="flex items-start mb-8">
              {[1,2,3,4,5,6].map((step, idx) => (
                <div key={step} className="flex-1 flex flex-col items-center gap-2 relative">
                  {idx > 0 && (
                    <div className="absolute h-px top-[18px] -translate-y-1/2" style={{ left: 0, right: '50%', background: 'var(--sk-fill)' }} />
                  )}
                  {idx < 5 && (
                    <div className="absolute h-px top-[18px] -translate-y-1/2" style={{ left: '50%', right: 0, background: 'var(--sk-fill)' }} />
                  )}
                  <Skeleton className="relative z-10 h-9 w-9 rounded-xl" />
                  <Skeleton className="h-2.5 w-10" />
                </div>
              ))}
            </div>

            {/* Header del paso: icono + título + descripción + badge */}
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
              <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-14 shrink-0" />
            </div>

            {/* Área de contenido del paso */}
            <div className="min-h-[280px] space-y-3">
              <Skeleton className="h-11 w-full rounded-xl" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl border border-white/30 dark:border-white/[0.06]">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className={`h-4 ${i === 1 ? 'w-40' : i === 2 ? 'w-32' : 'w-48'}`} />
                    <Skeleton className={`h-3 ${i === 1 ? 'w-56' : i === 2 ? 'w-44' : 'w-36'}`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer de navegación */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-6 min-h-screen"
    >
      {/* Breadcrumb */}
      <button
        onClick={handleBack}
        className="group flex items-center gap-2 text-sm text-gray-400 dark:text-[#5A5A6A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        {(state.paso === 1 && !showBasePhase) || (state.paso === 2 && !!clienteIdFromUrl) ? 'Volver' : 'Paso anterior'}
      </button>

      {/* Título de página */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
          {state.modo === 'mesociclo' ? 'Nuevo mesociclo' : 'Crear rutina'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#6A6A7A] mt-2">
          {state.cliente
            ? `Cliente: ${state.cliente.nombre} ${state.cliente.apellido}`
            : 'Wizard de creación de rutinas en 6 pasos'}
        </p>
      </div>

      {/* Wizard card */}
      <div className={`${glass} overflow-hidden`}>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="p-6 md:p-8">
          <StepperHeader currentStep={state.paso} modo={state.modo} />

          {/* Step header */}
          {stepMeta && (
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100 dark:border-white/[0.05]">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 dark:from-primary/10 dark:to-primary/[0.03] flex items-center justify-center border border-primary/20">
                <stepMeta.Icon size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{stepMeta.title}</h2>
                <p className="text-xs text-gray-500 dark:text-[#6A6A7A] mt-0.5">{stepMeta.desc}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-[#3A3A4A]">
                Paso {state.paso}/6
              </span>
            </div>
          )}

          {/* Contenido del paso actual */}
          <AnimatePresence mode="wait">
            <motion.div
              key={state.paso}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="min-h-[280px]"
            >
              {state.paso === 1 && <Paso1 />}
              {state.paso === 2 && <Paso2 />}
              {state.paso === 3 && Paso3()}
              {state.paso === 4 && <Paso5 />}
              {state.paso === 5 && <Paso6 />}
              {state.paso === 6 && <Paso7 />}
            </motion.div>
          </AnimatePresence>

          {/* Navegación */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-white/[0.05]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 dark:text-[#5A5A6A] hover:text-gray-700 dark:hover:text-white transition-colors px-3 py-2"
            >
              <ArrowLeft size={14} />
              {state.paso === 1 && !showBasePhase ? 'Cancelar' : 'Atrás'}
            </button>

            <div className="flex items-center gap-2">
              {/* Pasos 1-4: botón Siguiente */}
              {state.paso >= 1 && state.paso <= 4 && (
                <button
                  type="button"
                  disabled={!canGoNext()}
                  onClick={() => void handleNext()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-black hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              )}

              {/* Paso 5: submit del form */}
              {state.paso === 5 && (
                <button
                  type="submit"
                  form="form-paso6"
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-black hover:bg-primary/90 transition-colors"
                >
                  Revisar resumen
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              )}

              {/* Paso 6: guardar */}
              {state.paso === 6 && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleGuardar()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-black hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Crear rutina
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        :root { --line-inactive: rgba(0,0,0,0.08); }
        .dark { --line-inactive: rgba(255,255,255,0.06); }
      `}</style>
    </motion.div>
  )
}
