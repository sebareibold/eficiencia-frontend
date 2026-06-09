// Gestión de Membresías de clientes (/membresias)
import api from './axiosInstance'
import type { MembresiaCliente, CreateMembresiaClienteDto } from '../types/membership.types'

function mapMembresia(m: any): MembresiaCliente {
  return {
    id: m.id,
    clienteId: m.clienteId,
    planId: m.planId,
    modalidad: m.modalidad,
    precio: Number(m.precio),
    fechaInicio: m.fechaInicio,
    fechaVencimiento: m.fechaVencimiento,
    estado: m.estado,
    plan: {
      nombre: m.plan?.nombre ?? '',
      frecuenciaSemanal: m.plan?.frecuenciaSemanal ?? 0,
    },
  }
}

export const membresiasClienteApi = {
  getAll: (clienteId?: string): Promise<MembresiaCliente[]> =>
    api
      .get('/membresias', { params: clienteId ? { clienteId } : undefined })
      .then((r) => (Array.isArray(r.data) ? r.data : []).map(mapMembresia)),

  create: (dto: CreateMembresiaClienteDto): Promise<MembresiaCliente> =>
    api
      .post('/membresias', {
        clienteId: dto.clienteId,
        planId: dto.planId,
        modalidad: dto.modalidad,
        ...(dto.precio !== undefined && { precio: dto.precio }),
        ...(dto.fechaInicio !== undefined && { fechaInicio: dto.fechaInicio }),
      })
      .then((r) => mapMembresia(r.data)),

  renovar: (membresiaId: string): Promise<MembresiaCliente> =>
    api.post(`/membresias/${membresiaId}/renovar`).then((r) => mapMembresia(r.data)),

  cancelar: (membresiaId: string): Promise<MembresiaCliente> =>
    api.post(`/membresias/${membresiaId}/cancelar`).then((r) => mapMembresia(r.data)),

  remove: (membresiaId: string): Promise<void> =>
    api.delete(`/membresias/${membresiaId}`),
}
