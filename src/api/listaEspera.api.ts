import api from './axiosInstance'
import type { EstadoEspera, TipoEspera, ListaEsperaEntry } from '../types/listaEspera.types'

function mapEntry(e: any): ListaEsperaEntry {
  return {
    id: String(e.id),
    clienteId: String(e.clienteId),
    turnoId: String(e.turnoId),
    tipo: e.tipo,
    fechaSolicitud: e.fechaSolicitud,
    estado: e.estado,
    clienteNombre: e.cliente
      ? `${e.cliente.nombre} ${e.cliente.apellido}`
      : (e.clienteNombre ?? 'Cliente desconocido'),
  }
}

export const listaEsperaApi = {
  // Retorna TODOS los estados cuando se filtra por turnoId (para la vista de gestión)
  getByTurno: (turnoId: string): Promise<ListaEsperaEntry[]> =>
    api.get('/lista-espera', { params: { turnoId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapEntry)
    ),

  create: (clienteId: string, turnoId: string, tipo: TipoEspera): Promise<ListaEsperaEntry> =>
    api.post('/lista-espera', { clienteId, turnoId, tipo }).then(r => mapEntry(r.data)),

  updateEstado: (id: string, estado: EstadoEspera): Promise<ListaEsperaEntry> =>
    api.patch(`/lista-espera/${id}`, { estado }).then(r => mapEntry(r.data)),

  remove: (id: string): Promise<void> =>
    api.delete(`/lista-espera/${id}`),
}
