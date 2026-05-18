import api from './axiosInstance'
import type {
  ConfiguracionNotificacion,
  PlantillaNotificacion,
  LogNotificacion,
  VariablesDisparador,
  CreateConfiguracionNotificacionPayload,
  UpdateConfiguracionNotificacionPayload,
  CreatePlantillaPayload,
  UpdatePlantillaPayload,
  TipoDisparador,
} from '../types/notificacion.types'

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapConfiguracion(r: any): ConfiguracionNotificacion {
  return {
    id:              String(r.id),
    nombre:          r.nombre,
    descripcion:     r.descripcion ?? undefined,
    activa:          r.activa,
    disparador:      r.disparador,
    criterios:       r.criterios ?? {},
    frecuencia:      r.frecuencia,
    canal:           r.canal,
    destinatario:    r.destinatario,
    plantillaId:     r.plantillaId ?? undefined,
    plantilla:       r.plantilla ? mapPlantilla(r.plantilla) : undefined,
    ultimaEjecucion: r.ultimaEjecucion ?? undefined,
    createdAt:       r.createdAt,
    updatedAt:       r.updatedAt,
    logs:            r.logs ? r.logs.map(mapLog) : undefined,
  }
}

function mapPlantilla(r: any): PlantillaNotificacion {
  return {
    id:        String(r.id),
    nombre:    r.nombre,
    asunto:    r.asunto,
    cuerpo:    r.cuerpo,
    canal:     r.canal,
    variables: r.variables ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function mapLog(r: any): LogNotificacion {
  return {
    id:                String(r.id),
    configuracionId:   String(r.configuracionId),
    canal:             r.canal,
    destinatarioEmail: r.destinatarioEmail ?? undefined,
    asunto:            r.asunto ?? undefined,
    exitoso:           r.exitoso,
    error:             r.error ?? undefined,
    totalEnviados:     r.totalEnviados,
    ejecutadoEn:       r.ejecutadoEn,
    configuracion:     r.configuracion,
  }
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const notificacionesApi = {
  // Configuraciones
  getConfiguraciones: (): Promise<ConfiguracionNotificacion[]> =>
    api.get('/notificaciones/configuraciones').then(r =>
      (Array.isArray(r.data) ? r.data : r.data?.data ?? []).map(mapConfiguracion)
    ),

  getConfiguracion: (id: string): Promise<ConfiguracionNotificacion> =>
    api.get(`/notificaciones/configuraciones/${id}`).then(r =>
      mapConfiguracion(r.data?.data ?? r.data)
    ),

  createConfiguracion: (payload: CreateConfiguracionNotificacionPayload): Promise<ConfiguracionNotificacion> =>
    api.post('/notificaciones/configuraciones', payload).then(r =>
      mapConfiguracion(r.data?.data ?? r.data)
    ),

  updateConfiguracion: (id: string, payload: UpdateConfiguracionNotificacionPayload): Promise<ConfiguracionNotificacion> =>
    api.patch(`/notificaciones/configuraciones/${id}`, payload).then(r =>
      mapConfiguracion(r.data?.data ?? r.data)
    ),

  deleteConfiguracion: (id: string): Promise<void> =>
    api.delete(`/notificaciones/configuraciones/${id}`).then(() => undefined),

  ejecutar: (id: string): Promise<LogNotificacion | null> =>
    api.post(`/notificaciones/configuraciones/${id}/ejecutar`).then(r =>
      r.data?.data ? mapLog(r.data.data) : null
    ),

  // Plantillas
  getPlantillas: (): Promise<PlantillaNotificacion[]> =>
    api.get('/notificaciones/plantillas').then(r =>
      (Array.isArray(r.data) ? r.data : r.data?.data ?? []).map(mapPlantilla)
    ),

  getPlantilla: (id: string): Promise<PlantillaNotificacion> =>
    api.get(`/notificaciones/plantillas/${id}`).then(r =>
      mapPlantilla(r.data?.data ?? r.data)
    ),

  createPlantilla: (payload: CreatePlantillaPayload): Promise<PlantillaNotificacion> =>
    api.post('/notificaciones/plantillas', payload).then(r =>
      mapPlantilla(r.data?.data ?? r.data)
    ),

  updatePlantilla: (id: string, payload: UpdatePlantillaPayload): Promise<PlantillaNotificacion> =>
    api.patch(`/notificaciones/plantillas/${id}`, payload).then(r =>
      mapPlantilla(r.data?.data ?? r.data)
    ),

  deletePlantilla: (id: string): Promise<void> =>
    api.delete(`/notificaciones/plantillas/${id}`).then(() => undefined),

  getPlantillaDefault: (disparador: TipoDisparador): Promise<{ asunto: string; cuerpo: string }> =>
    api.get(`/notificaciones/plantillas/default/${disparador}`).then(r =>
      r.data?.data ?? r.data
    ),

  // Logs
  getLogs: (configuracionId?: string): Promise<LogNotificacion[]> =>
    api.get('/notificaciones/logs', {
      params: configuracionId ? { configuracionId } : undefined,
    }).then(r =>
      (Array.isArray(r.data) ? r.data : r.data?.data ?? []).map(mapLog)
    ),

  // Variables de plantilla
  getVariables: (): Promise<VariablesDisparador[]> =>
    api.get('/notificaciones/variables').then(r =>
      r.data?.data ?? r.data
    ),

  getVariablesPorDisparador: (disparador: TipoDisparador): Promise<VariablesDisparador> =>
    api.get(`/notificaciones/variables/${disparador}`).then(r =>
      r.data?.data ?? r.data
    ),
}
