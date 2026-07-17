import api from './axiosInstance'

export interface ConsistenciaReport {
  membresias: {
    marcadasVencidas: number
    activadasDesdePendiente: number
    clientesConDobleActiva: number
  }
  clientes: {
    reactivados: number
    sinMembresia: number
  }
  ejecutadoEn: string
}

export const mantenimientoApi = {
  consistencia: (): Promise<ConsistenciaReport> =>
    api.post('/mantenimiento/consistencia').then(r => r.data),
}
