import api from './axiosInstance'

export type InscripcionEntry = {
  id: string
  clienteId: string
  clienteNombre: string
  fechaDesde: string
  estado: 'ACTIVA' | 'BAJA'
}

function mapInscripcion(i: any): InscripcionEntry {
  return {
    id: String(i.id),
    clienteId: String(i.clienteId),
    clienteNombre: i.cliente ? `${i.cliente.nombre} ${i.cliente.apellido}` : 'Cliente desconocido',
    fechaDesde: i.fechaDesde,
    estado: i.estado,
  }
}

export const inscripcionesApi = {
  getByTurno: (turnoId: string): Promise<InscripcionEntry[]> =>
    api.get('/inscripciones', { params: { turnoId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapInscripcion)
    ),

  enroll: (clienteId: string, turnoId: string): Promise<{ enListaEspera: boolean }> =>
    api.post('/inscripciones', { clienteId, turnoId }).then(r => ({
      enListaEspera: r.data?.enListaEspera === true,
    })),

  darDeBaja: (id: string): Promise<void> =>
    api.patch(`/inscripciones/${id}/baja`),
}
