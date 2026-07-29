import api from './axiosInstance'

export interface ConfiguracionData {
  tema: string
  accentColor: string
  density?: string
  notifEmail?: string
  notifCanal?: string
  notifVencimientos?: boolean
  notifDiasAnticipacion?: number
  notifDeudas?: boolean
  notifNuevosClientes?: boolean
  notifNuevosUsuarios?: boolean
  emailAlAprobarSolicitudes?: boolean
  notifBajaAutomatica?: boolean
  notifSolicitudAcceso?: boolean
  notifResetPassword?: boolean
  notifSolicitudTurno?: boolean
  notifPagoRegistrado?: boolean
}

export const configuracionApi = {
  get: (): Promise<ConfiguracionData> =>
    api.get('/configuracion').then(r => r.data),

  update: (data: Partial<ConfiguracionData>): Promise<ConfiguracionData> =>
    api.patch('/configuracion', data).then(r => r.data),

  getWidgetKpisPagos: (): Promise<{ kpis: string[]; cols: number }> =>
    api.get('/configuracion/widget-kpis-pagos').then(r => r.data),

  updateWidgetKpisPagos: (kpis: string[], cols: number): Promise<{ kpis: string[]; cols: number }> =>
    api.patch('/configuracion/widget-kpis-pagos', { kpis, cols }).then(r => r.data),
}
