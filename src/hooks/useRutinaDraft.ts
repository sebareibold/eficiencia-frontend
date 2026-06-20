import { useReducer, useCallback, useState } from 'react'
import { rutinasApi } from '../api/rutinas.api'
import { useUiStore } from '../store/uiStore'
import type { Rutina, EjercicioPlan } from '../types/rutina.types'

// ─── Tipos del draft ─────────────────────────────────────────────────────────

const mkTempId = () => `temp-${crypto.randomUUID()}`
export const isTemp = (id: string) => id.startsWith('temp-')

export interface UpdateEjData {
  nombre?: string
  catalogoId?: string
  catalogo?: { nombre: string; patronMovimiento?: string; videoUrl?: string }
  series?: number | ''
  repeticiones?: string
  peso?: string
  rir?: number | ''
  rpe?: number | ''
  notas?: string
}

export interface DraftEjercicio extends Omit<EjercicioPlan, 'catalogo'> {
  catalogo?: { nombre: string; patronMovimiento?: string; videoUrl?: string }
  _isNew: boolean
  _changed: boolean
}

export interface DraftBloque {
  id: string
  sesionId: string
  letra: string
  orden: number
  patronMovimiento?: string
  ejerciciosPlan: DraftEjercicio[]
  _isNew: boolean
}

export interface DraftSesion {
  id: string
  semanaId: string
  dia: string
  nombre?: string
  nota?: string
  orden: number
  bloques: DraftBloque[]
  _isNew: boolean
  _renamed: boolean
  _notaChanged: boolean
}

export interface DraftSemana {
  id: string
  rutinaId: string
  numero: number
  nombre?: string
  observaciones?: string
  sesiones: DraftSesion[]
  _isNew: boolean
  _renamed: boolean
  _obsChanged: boolean
}

export interface DraftRutina extends Omit<Rutina, 'semanas'> {
  semanas: DraftSemana[]
  _metaChanged: boolean
}

// ─── Estado del reducer ───────────────────────────────────────────────────────

type DraftState = {
  draft: DraftRutina | null
  original: Rutina | null
  hasChanges: boolean
}

type Action =
  | { type: 'INIT'; rutina: Rutina }
  | { type: 'SET_META'; nombre: string; descripcion: string; activa: boolean }
  | { type: 'ADD_SEMANA' }
  | { type: 'CLONE_SEMANA'; semanaId: string }
  | { type: 'DELETE_SEMANA'; semanaId: string }
  | { type: 'RENAME_SEMANA'; semanaId: string; nombre: string }
  | { type: 'UPDATE_SEMANA_OBS'; semanaId: string; observaciones: string }
  | { type: 'ADD_SESION'; semanaId: string; dia: string }
  | { type: 'RENAME_SESION'; sesionId: string; nombre: string }
  | { type: 'SET_SESION_NOTA'; sesionId: string; nota: string }
  | { type: 'DELETE_SESION'; semanaId: string; sesionId: string }
  | { type: 'ADD_BLOQUE'; sesionId: string }
  | { type: 'DELETE_BLOQUE'; sesionId: string; bloqueId: string }
  | { type: 'ADD_EJERCICIO'; bloqueId: string; nombre: string; catalogoId?: string; catalogo?: DraftEjercicio['catalogo'] }
  | { type: 'UPDATE_EJERCICIO'; ejercicioId: string; data: UpdateEjData }
  | { type: 'DELETE_EJERCICIO'; ejercicioId: string }
  | { type: 'REORDER_SEMANAS'; fromId: string; toId: string }

// ─── Helpers de conversión ────────────────────────────────────────────────────

const toDraft = (r: Rutina): DraftRutina => ({
  ...r,
  _metaChanged: false,
  semanas: r.semanas.map(s => ({
    ...s,
    _isNew: false,
    _renamed: false,
    _obsChanged: false,
    sesiones: s.sesiones.map(ses => ({
      ...ses,
      _isNew: false,
      _renamed: false,
      _notaChanged: false,
      bloques: ses.bloques.map(bl => ({
        ...bl,
        _isNew: false,
        ejerciciosPlan: bl.ejerciciosPlan.map(ej => ({
          ...ej,
          _isNew: false,
          _changed: false,
        })),
      })),
    })),
  })),
})

const nextLetra = (bloques: DraftBloque[]): string => {
  if (bloques.length === 0) return 'A'
  return String.fromCharCode(bloques[bloques.length - 1].letra.charCodeAt(0) + 1)
}

const cloneSemana = (src: DraftSemana, nextNumero: number): DraftSemana => ({
  id: mkTempId(),
  rutinaId: src.rutinaId,
  numero: nextNumero,
  nombre: src.nombre,
  observaciones: src.observaciones,
  _isNew: true,
  _renamed: !!src.nombre,
  _obsChanged: !!src.observaciones,
  sesiones: src.sesiones.map(ses => ({
    id: mkTempId(),
    semanaId: 'temp',
    dia: ses.dia,
    nombre: ses.nombre,
    orden: ses.orden,
    _isNew: true,
    _renamed: !!ses.nombre,
    bloques: ses.bloques.map(bl => ({
      id: mkTempId(),
      sesionId: 'temp',
      letra: bl.letra,
      orden: bl.orden,
      _isNew: true,
      ejerciciosPlan: bl.ejerciciosPlan.map(ej => ({
        ...ej,
        id: mkTempId(),
        bloqueId: 'temp',
        _isNew: true,
        _changed: false,
        ejecuciones: [],
      })),
    })),
  })),
})

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: DraftState, action: Action): DraftState {
  if (action.type === 'INIT') {
    return { draft: toDraft(action.rutina), original: action.rutina, hasChanges: false }
  }
  if (!state.draft) return state
  const d = state.draft

  const save = (draft: DraftRutina): DraftState => ({ ...state, draft, hasChanges: true })

  switch (action.type) {
    case 'SET_META':
      return save({ ...d, nombre: action.nombre, descripcion: action.descripcion, activa: action.activa, _metaChanged: true })

    case 'ADD_SEMANA': {
      const numero = (d.semanas.at(-1)?.numero ?? 0) + 1
      const s: DraftSemana = { id: mkTempId(), rutinaId: d.id, numero, _isNew: true, _renamed: false, _obsChanged: false, sesiones: [] }
      return save({ ...d, semanas: [...d.semanas, s] })
    }

    case 'CLONE_SEMANA': {
      const src = d.semanas.find(s => s.id === action.semanaId)
      if (!src) return state
      const numero = (d.semanas.at(-1)?.numero ?? 0) + 1
      return save({ ...d, semanas: [...d.semanas, cloneSemana(src, numero)] })
    }

    case 'DELETE_SEMANA':
      return save({ ...d, semanas: d.semanas.filter(s => s.id !== action.semanaId) })

    case 'RENAME_SEMANA':
      return save({
        ...d,
        semanas: d.semanas.map(s =>
          s.id === action.semanaId ? { ...s, nombre: action.nombre, _renamed: true } : s,
        ),
      })

    case 'UPDATE_SEMANA_OBS':
      return save({
        ...d,
        semanas: d.semanas.map(s =>
          s.id === action.semanaId ? { ...s, observaciones: action.observaciones, _obsChanged: true } : s,
        ),
      })

    case 'ADD_SESION':
      return save({
        ...d,
        semanas: d.semanas.map(s =>
          s.id === action.semanaId
            ? { ...s, sesiones: [...s.sesiones, { id: mkTempId(), semanaId: s.id, dia: action.dia, nombre: undefined, nota: undefined, orden: s.sesiones.length, _isNew: true, _renamed: false, _notaChanged: false, bloques: [] }] }
            : s,
        ),
      })

    case 'RENAME_SESION':
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses =>
            ses.id === action.sesionId ? { ...ses, nombre: action.nombre, _renamed: true } : ses,
          ),
        })),
      })

    case 'SET_SESION_NOTA':
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses =>
            ses.id === action.sesionId ? { ...ses, nota: action.nota, _notaChanged: true } : ses,
          ),
        })),
      })

    case 'DELETE_SESION':
      return save({
        ...d,
        semanas: d.semanas.map(s =>
          s.id === action.semanaId ? { ...s, sesiones: s.sesiones.filter(ses => ses.id !== action.sesionId) } : s,
        ),
      })

    case 'ADD_BLOQUE':
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses =>
            ses.id === action.sesionId
              ? { ...ses, bloques: [...ses.bloques, { id: mkTempId(), sesionId: ses.id, letra: nextLetra(ses.bloques), orden: ses.bloques.length, _isNew: true, ejerciciosPlan: [] }] }
              : ses,
          ),
        })),
      })

    case 'DELETE_BLOQUE':
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses =>
            ses.id === action.sesionId ? { ...ses, bloques: ses.bloques.filter(b => b.id !== action.bloqueId) } : ses,
          ),
        })),
      })

    case 'ADD_EJERCICIO': {
      const ej: DraftEjercicio = {
        id: mkTempId(), bloqueId: action.bloqueId, catalogoId: action.catalogoId,
        nombre: action.nombre, catalogo: action.catalogo,
        orden: 0, ejecuciones: [], _isNew: true, _changed: false,
      }
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses => ({
            ...ses,
            bloques: ses.bloques.map(bl =>
              bl.id === action.bloqueId ? { ...bl, ejerciciosPlan: [...bl.ejerciciosPlan, ej] } : bl,
            ),
          })),
        })),
      })
    }

    case 'UPDATE_EJERCICIO':
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses => ({
            ...ses,
            bloques: ses.bloques.map(bl => ({
              ...bl,
              ejerciciosPlan: bl.ejerciciosPlan.map(ej =>
                ej.id === action.ejercicioId ? { ...ej, ...action.data, _changed: !ej._isNew } : ej,
              ),
            })),
          })),
        })),
      })

    case 'DELETE_EJERCICIO':
      return save({
        ...d,
        semanas: d.semanas.map(s => ({
          ...s,
          sesiones: s.sesiones.map(ses => ({
            ...ses,
            bloques: ses.bloques.map(bl => ({
              ...bl,
              ejerciciosPlan: bl.ejerciciosPlan.filter(ej => ej.id !== action.ejercicioId),
            })),
          })),
        })),
      })

    case 'REORDER_SEMANAS': {
      const from = d.semanas.findIndex(s => s.id === action.fromId)
      const to   = d.semanas.findIndex(s => s.id === action.toId)
      if (from === -1 || to === -1 || from === to) return state
      const semanas = [...d.semanas]
      const [moved] = semanas.splice(from, 1)
      semanas.splice(to, 0, moved)
      return save({ ...d, semanas })
    }

    default:
      return state
  }
}

// ─── Helpers de sanitización para el payload ─────────────────────────────────
// El backend usa @IsNumber() + @IsOptional() → null y '' son rechazados.
// Solo `undefined` (campo ausente del JSON) pasa la validación como "no enviado".
const toNum = (v: number | '' | null | undefined): number | undefined =>
  typeof v === 'number' ? v : undefined
const toStr = (v: string | null | undefined): string | undefined =>
  v == null || v === '' ? undefined : v

// ─── Lógica de guardado (diff + API calls) ────────────────────────────────────

async function persistDraft(original: Rutina, draft: DraftRutina): Promise<void> {
  const idMap = new Map<string, string>()
  const r = (id: string) => idMap.get(id) ?? id

  if (draft._metaChanged) {
    await rutinasApi.update(draft.id, {
      nombre: draft.nombre,
      descripcion: draft.descripcion || undefined,
      activa: draft.activa,
    })
  }

  // Eliminar semanas removidas
  const draftSemanaIds = new Set(draft.semanas.map(s => s.id))
  for (const s of original.semanas) {
    if (!draftSemanaIds.has(s.id)) await rutinasApi.deleteSemana(draft.id, s.id)
  }

  for (const ds of draft.semanas) {
    let realSemanaId: string
    if (ds._isNew) {
      const created = await rutinasApi.createSemana(draft.id)
      idMap.set(ds.id, created.id)
      realSemanaId = created.id
      if (ds.nombre?.trim() || ds.observaciones !== undefined) {
        await rutinasApi.updateSemana(draft.id, realSemanaId, {
          ...(ds.nombre?.trim() ? { nombre: ds.nombre.trim() } : {}),
          ...(ds.observaciones !== undefined ? { observaciones: ds.observaciones } : {}),
        })
      }
    } else {
      realSemanaId = ds.id
      if (ds._renamed || ds._obsChanged) {
        await rutinasApi.updateSemana(draft.id, realSemanaId, {
          ...(ds._renamed ? { nombre: ds.nombre?.trim() ?? '' } : {}),
          ...(ds._obsChanged ? { observaciones: ds.observaciones ?? '' } : {}),
        })
      }
    }

    const origSemana = ds._isNew ? null : (original.semanas.find(s => s.id === ds.id) ?? null)

    // Eliminar sesiones removidas
    if (origSemana) {
      const draftIds = new Set(ds.sesiones.map(s => s.id))
      for (const ses of origSemana.sesiones) {
        if (!draftIds.has(ses.id)) await rutinasApi.deleteSesion(ses.id)
      }
    }

    for (const dses of ds.sesiones) {
      let realSesionId: string
      if (dses._isNew) {
        const created = await rutinasApi.createSesion(realSemanaId, dses.dia)
        idMap.set(dses.id, created.id)
        realSesionId = created.id
        const newSesionPatch: { nombre?: string; nota?: string } = {}
        if (dses.nombre?.trim()) newSesionPatch.nombre = dses.nombre.trim()
        if (dses.nota?.trim()) newSesionPatch.nota = dses.nota.trim()
        if (Object.keys(newSesionPatch).length > 0) {
          await rutinasApi.updateSesion(realSesionId, newSesionPatch)
        }
      } else {
        realSesionId = dses.id
        const patch: { nombre?: string; nota?: string } = {}
        if (dses._renamed) patch.nombre = dses.nombre?.trim() ?? ''
        if (dses._notaChanged) patch.nota = dses.nota?.trim() ?? ''
        if (Object.keys(patch).length > 0) {
          await rutinasApi.updateSesion(realSesionId, patch)
        }
      }

      const origSesion = origSemana?.sesiones.find(s => s.id === dses.id) ?? null

      // Eliminar bloques removidos
      if (origSesion) {
        const draftIds = new Set(dses.bloques.map(b => b.id))
        for (const bl of origSesion.bloques) {
          if (!draftIds.has(bl.id)) await rutinasApi.deleteBloque(bl.id)
        }
      }

      for (const dbl of dses.bloques) {
        let realBloqueId: string
        if (dbl._isNew) {
          const created = await rutinasApi.createBloque(realSesionId, dbl.letra)
          idMap.set(dbl.id, created.id)
          realBloqueId = created.id
        } else {
          realBloqueId = dbl.id
        }

        const origBloque = origSesion?.bloques.find(b => b.id === dbl.id) ?? null

        // Eliminar ejercicios removidos
        if (origBloque) {
          const draftIds = new Set(dbl.ejerciciosPlan.map(e => e.id))
          for (const ej of origBloque.ejerciciosPlan) {
            if (!draftIds.has(ej.id)) await rutinasApi.deleteEjercicio(ej.id)
          }
        }

        for (const dej of dbl.ejerciciosPlan) {
          if (dej._isNew) {
            await rutinasApi.addEjercicio(realBloqueId, {
              nombre: dej.nombre,
              catalogoId: dej.catalogoId || undefined,
              series: toNum(dej.series),
              repeticiones: toStr(dej.repeticiones),
              peso: toStr(dej.peso),
              rir: toNum(dej.rir),
              rpe: toNum(dej.rpe),
            })
          } else if (dej._changed) {
            await rutinasApi.updateEjercicio(dej.id, {
              nombre: dej.nombre,
              catalogoId: dej.catalogoId || undefined,
              series: toNum(dej.series),
              repeticiones: toStr(dej.repeticiones),
              peso: toStr(dej.peso),
              rir: toNum(dej.rir),
              rpe: toNum(dej.rpe),
            })
          }
        }
      }
    }
  }

  // El idMap no se usa fuera de esta función — solo sirve para
  // resolver temp IDs durante la cadena de creaciones anidadas
  void r
}

// ─── Hook público ─────────────────────────────────────────────────────────────

export function useRutinaDraft() {
  const [state, dispatch] = useReducer(reducer, { draft: null, original: null, hasChanges: false })
  const addToast = useUiStore(s => s.addToast)
  const [saving, setSaving] = useState(false)

  const initDraft = useCallback((rutina: Rutina) => {
    dispatch({ type: 'INIT', rutina })
  }, [])

  const saveDraft = useCallback(async (onSuccess: () => void) => {
    if (!state.draft || !state.original) return
    setSaving(true)
    try {
      await persistDraft(state.original, state.draft)
      addToast({ type: 'success', message: 'Rutina guardada correctamente' })
      onSuccess()
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useRutinaDraft] Error al guardar:', err)
      addToast({ type: 'error', message: 'Error al guardar. Intentá de nuevo.' })
    } finally {
      setSaving(false)
    }
  }, [state.draft, state.original, addToast])

  return {
    draft: state.draft,
    hasChanges: state.hasChanges,
    saving,
    initDraft,
    saveDraft,
    setMeta: (nombre: string, descripcion: string, activa: boolean) =>
      dispatch({ type: 'SET_META', nombre, descripcion, activa }),
    addSemana: () => dispatch({ type: 'ADD_SEMANA' }),
    cloneSemana: (semanaId: string) => dispatch({ type: 'CLONE_SEMANA', semanaId }),
    deleteSemana: (semanaId: string) => dispatch({ type: 'DELETE_SEMANA', semanaId }),
    renameSemana: (semanaId: string, nombre: string) =>
      dispatch({ type: 'RENAME_SEMANA', semanaId, nombre }),
    updateSemanaObs: (semanaId: string, observaciones: string) =>
      dispatch({ type: 'UPDATE_SEMANA_OBS', semanaId, observaciones }),
    addSesion: (semanaId: string, dia: string) =>
      dispatch({ type: 'ADD_SESION', semanaId, dia }),
    renameSesion: (sesionId: string, nombre: string) =>
      dispatch({ type: 'RENAME_SESION', sesionId, nombre }),
    setSesionNota: (sesionId: string, nota: string) =>
      dispatch({ type: 'SET_SESION_NOTA', sesionId, nota }),
    deleteSesion: (semanaId: string, sesionId: string) =>
      dispatch({ type: 'DELETE_SESION', semanaId, sesionId }),
    addBloque: (sesionId: string) => dispatch({ type: 'ADD_BLOQUE', sesionId }),
    deleteBloque: (sesionId: string, bloqueId: string) =>
      dispatch({ type: 'DELETE_BLOQUE', sesionId, bloqueId }),
    addEjercicio: (bloqueId: string, nombre: string, catalogoId?: string, catalogo?: DraftEjercicio['catalogo']) =>
      dispatch({ type: 'ADD_EJERCICIO', bloqueId, nombre, catalogoId, catalogo }),
    updateEjercicio: (ejercicioId: string, data: UpdateEjData) =>
      dispatch({ type: 'UPDATE_EJERCICIO', ejercicioId, data }),
    deleteEjercicio: (ejercicioId: string) =>
      dispatch({ type: 'DELETE_EJERCICIO', ejercicioId }),
    reorderSemanas: (fromId: string, toId: string) =>
      dispatch({ type: 'REORDER_SEMANAS', fromId, toId }),
  }
}
