import api from './axiosInstance'
import type { DiaEspecial, TipoDiaEspecial, TurnoPreviewWizard, WizardResult, DeleteDiaEspecialResult } from '../types/dias-especiales.types'

export const diasEspecialesApi = {
  getAll: (mes?: string): Promise<DiaEspecial[]> =>
    api.get('/dias-especiales', { params: mes ? { mes } : undefined })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  create: (data: {
    fecha: string
    tipo: TipoDiaEspecial
    motivo?: string
    horaDesde?: string
    horaHasta?: string
  }): Promise<DiaEspecial> =>
    api.post('/dias-especiales', data).then((r) => r.data),

  update: (id: string, data: {
    fecha?: string
    tipo?: TipoDiaEspecial
    motivo?: string
    horaDesde?: string
    horaHasta?: string
  }): Promise<DiaEspecial> =>
    api.patch(`/dias-especiales/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<DeleteDiaEspecialResult> =>
    api.delete(`/dias-especiales/${id}`).then((r) => r.data ?? { turnosEliminados: 0, cancelacionesRevertidas: 0, excepcionesEliminadas: 0 }),

  preview: (fecha: string, horaDesde?: string, horaHasta?: string): Promise<TurnoPreviewWizard[]> =>
    api.get('/dias-especiales/preview', { params: { fecha, horaDesde, horaHasta } })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  configurar: (data: {
    fecha: string
    tipo: TipoDiaEspecial
    motivo?: string
    horaDesde?: string
    horaHasta?: string
    autoCrearExcepciones?: boolean
    crearTurnosPuntuales?: boolean
    cupoSalaA?: number
    cupoSalaB?: number
    profesorSalaAId?: string
    profesorSalaBId?: string
  }): Promise<WizardResult> =>
    api.post('/dias-especiales/configurar', data).then((r) => r.data),
}
