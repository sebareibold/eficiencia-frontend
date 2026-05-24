// Gestión de TarifaVigente (/tarifas) — precios por plan+modalidad
import api from './axiosInstance'
import type { TarifaVigente, Modalidad } from '../types/membership.types'

export interface MatrizPrecios {
  [planId: string]: {
    [modalidad: string]: { id: string; precio: number; vigenteDesde: string }
  }
}

function mapTarifa(t: any): TarifaVigente {
  return {
    id: t.id,
    planId: t.planId,
    modalidad: t.modalidad as Modalidad,
    precio: Number(t.precio),
    vigenteDesde: t.vigenteDesde,
  }
}

export const tarifasApi = {
  // Lista todas las tarifas vigentes
  getAll: (): Promise<TarifaVigente[]> =>
    api.get('/tarifas').then((r) => (Array.isArray(r.data) ? r.data : []).map(mapTarifa)),

  // Matriz: { planId: { modalidad: { id, precio, vigenteDesde } } }
  getMatriz: (): Promise<MatrizPrecios> =>
    api.get('/tarifas/matriz').then((r) => r.data),

  // Crear tarifa para un combo plan+modalidad (admin)
  create: (planId: string, modalidad: Modalidad, precio: number): Promise<TarifaVigente> =>
    api.post('/tarifas', { planId, modalidad, precio }).then((r) => mapTarifa(r.data)),

  // Actualizar precio de una tarifa vigente (archiva la actual, crea nueva)
  updatePrecio: (tarifaId: string, precio: number): Promise<TarifaVigente> =>
    api.patch(`/tarifas/${tarifaId}`, { precio }).then((r) => mapTarifa(r.data)),
}
