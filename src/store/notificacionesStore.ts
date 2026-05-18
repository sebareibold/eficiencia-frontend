import { create } from 'zustand'
import { notificacionesApi } from '../api/notificaciones.api'
import type {
  ConfiguracionNotificacion,
  PlantillaNotificacion,
  LogNotificacion,
  CreateConfiguracionNotificacionPayload,
  UpdateConfiguracionNotificacionPayload,
  CreatePlantillaPayload,
  UpdatePlantillaPayload,
  TipoDisparador,
} from '../types/notificacion.types'

interface NotificacionesState {
  // ── Configuraciones ──
  configuraciones:       ConfiguracionNotificacion[]
  loadingConfiguraciones: boolean
  errorConfiguraciones:   string | null

  // ── Plantillas ──
  plantillas:       PlantillaNotificacion[]
  loadingPlantillas: boolean

  // ── Logs ──
  logs:       LogNotificacion[]
  loadingLogs: boolean

  // ── Ejecución ──
  ejecutandoId: string | null

  // ── Acciones: Configuraciones ──
  fetchConfiguraciones: () => Promise<void>
  createConfiguracion:  (p: CreateConfiguracionNotificacionPayload) => Promise<ConfiguracionNotificacion>
  updateConfiguracion:  (id: string, p: UpdateConfiguracionNotificacionPayload) => Promise<void>
  deleteConfiguracion:  (id: string) => Promise<void>
  ejecutarNotificacion: (id: string) => Promise<LogNotificacion | null>

  // ── Acciones: Plantillas ──
  fetchPlantillas:  () => Promise<void>
  createPlantilla:  (p: CreatePlantillaPayload) => Promise<PlantillaNotificacion>
  updatePlantilla:  (id: string, p: UpdatePlantillaPayload) => Promise<void>
  deletePlantilla:  (id: string) => Promise<void>
  getPlantillaDefault: (d: TipoDisparador) => Promise<{ asunto: string; cuerpo: string }>

  // ── Acciones: Logs ──
  fetchLogs: (configuracionId?: string) => Promise<void>
}

export const useNotificacionesStore = create<NotificacionesState>((set, get) => ({
  configuraciones:        [],
  loadingConfiguraciones: false,
  errorConfiguraciones:   null,
  plantillas:             [],
  loadingPlantillas:      false,
  logs:                   [],
  loadingLogs:            false,
  ejecutandoId:           null,

  // ─── Configuraciones ────────────────────────────────────────────────────────

  fetchConfiguraciones: async () => {
    set({ loadingConfiguraciones: true, errorConfiguraciones: null })
    try {
      const configuraciones = await notificacionesApi.getConfiguraciones()
      set({ configuraciones })
    } catch {
      set({ errorConfiguraciones: 'Error al cargar las configuraciones' })
    } finally {
      set({ loadingConfiguraciones: false })
    }
  },

  createConfiguracion: async (payload) => {
    const nueva = await notificacionesApi.createConfiguracion(payload)
    set(s => ({ configuraciones: [nueva, ...s.configuraciones] }))
    return nueva
  },

  updateConfiguracion: async (id, payload) => {
    const actualizada = await notificacionesApi.updateConfiguracion(id, payload)
    set(s => ({
      configuraciones: s.configuraciones.map(c => c.id === id ? actualizada : c),
    }))
  },

  deleteConfiguracion: async (id) => {
    await notificacionesApi.deleteConfiguracion(id)
    set(s => ({
      configuraciones: s.configuraciones.filter(c => c.id !== id),
    }))
  },

  ejecutarNotificacion: async (id) => {
    set({ ejecutandoId: id })
    try {
      const log = await notificacionesApi.ejecutar(id)
      // Actualizar ultimaEjecucion en la config local
      set(s => ({
        configuraciones: s.configuraciones.map(c =>
          c.id === id ? { ...c, ultimaEjecucion: new Date().toISOString() } : c
        ),
        logs: log ? [log, ...s.logs] : s.logs,
      }))
      return log
    } finally {
      set({ ejecutandoId: null })
    }
  },

  // ─── Plantillas ─────────────────────────────────────────────────────────────

  fetchPlantillas: async () => {
    set({ loadingPlantillas: true })
    try {
      const plantillas = await notificacionesApi.getPlantillas()
      set({ plantillas })
    } finally {
      set({ loadingPlantillas: false })
    }
  },

  createPlantilla: async (payload) => {
    const nueva = await notificacionesApi.createPlantilla(payload)
    set(s => ({ plantillas: [nueva, ...s.plantillas] }))
    return nueva
  },

  updatePlantilla: async (id, payload) => {
    const actualizada = await notificacionesApi.updatePlantilla(id, payload)
    set(s => ({
      plantillas: s.plantillas.map(p => p.id === id ? actualizada : p),
    }))
  },

  deletePlantilla: async (id) => {
    await notificacionesApi.deletePlantilla(id)
    set(s => ({ plantillas: s.plantillas.filter(p => p.id !== id) }))
  },

  getPlantillaDefault: (disparador) =>
    notificacionesApi.getPlantillaDefault(disparador),

  // ─── Logs ───────────────────────────────────────────────────────────────────

  fetchLogs: async (configuracionId) => {
    set({ loadingLogs: true })
    try {
      const logs = await notificacionesApi.getLogs(configuracionId)
      set({ logs })
    } finally {
      set({ loadingLogs: false })
    }
  },
}))
