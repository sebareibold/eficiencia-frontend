import api from './axiosInstance'

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'

export interface SolicitudEntry {
  id: string
  nombre: string
  email: string
  rolSolicitado: 'ADMINISTRADOR' | 'STAFF' | 'PROFESOR'
  estado: EstadoSolicitud
  createdAt: string
  revisadaAt: string | null
  revisadaPor: string | null
}

export const solicitudesApi = {
  create: (data: {
    nombre: string
    email: string
    password?: string
    rolSolicitado: string
  }): Promise<SolicitudEntry> =>
    api.post('/solicitudes', data).then(r => r.data),

  getAll: (): Promise<SolicitudEntry[]> =>
    api.get('/solicitudes').then(r => (Array.isArray(r.data) ? r.data : [])),

  aprobar: (id: string): Promise<SolicitudEntry> =>
    api.patch(`/solicitudes/${id}/aprobar`).then(r => r.data),

  rechazar: (id: string): Promise<SolicitudEntry> =>
    api.patch(`/solicitudes/${id}/rechazar`).then(r => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/solicitudes/${id}`).then(() => undefined),
}
