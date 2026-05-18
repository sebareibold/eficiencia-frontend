// ─── Enums ────────────────────────────────────────────────────────────────────

export type CanalNotificacion   = 'EMAIL' | 'WHATSAPP'
export type TipoDestinatario    = 'ADMIN' | 'CLIENTE' | 'STAFF' | 'PROFESOR'
export type FrecuenciaNotificacion = 'MANUAL' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type TipoDisparador =
  | 'MEMBRESIA_POR_VENCER'
  | 'MEMBRESIA_VENCIDA'
  | 'CLIENTE_EN_DEUDA'
  | 'CLIENTE_INACTIVO'
  | 'ALTA_INASISTENCIA'
  | 'PAGO_REGISTRADO'
  | 'NUEVO_CLIENTE'

// ─── Labels UI ────────────────────────────────────────────────────────────────

export const DISPARADOR_LABELS: Record<TipoDisparador, string> = {
  MEMBRESIA_POR_VENCER: 'Membresías por vencer',
  MEMBRESIA_VENCIDA:    'Membresías vencidas',
  CLIENTE_EN_DEUDA:     'Clientes con deuda',
  CLIENTE_INACTIVO:     'Clientes inactivos',
  ALTA_INASISTENCIA:    'Alta inasistencia',
  PAGO_REGISTRADO:      'Pago registrado',
  NUEVO_CLIENTE:        'Nuevo cliente',
}

export const FRECUENCIA_LABELS: Record<FrecuenciaNotificacion, string> = {
  MANUAL:  'Manual',
  HOURLY:  'Cada hora',
  DAILY:   'Diario (8:00 AM)',
  WEEKLY:  'Semanal (lunes 8:00 AM)',
  MONTHLY: 'Mensual (día 1, 8:00 AM)',
}

export const CANAL_LABELS: Record<CanalNotificacion, string> = {
  EMAIL:     'Email',
  WHATSAPP:  'WhatsApp',
}

export const DESTINATARIO_LABELS: Record<TipoDestinatario, string> = {
  ADMIN:    'Administrador',
  CLIENTE:  'Clientes',
  STAFF:    'Staff',
  PROFESOR: 'Profesores',
}

// ─── Criterios por disparador ────────────────────────────────────────────────

export interface CriteriosMembresiaVencer   { diasParaVencer?: number }
export interface CriteriosClienteInactivo   { diasSinAsistir?: number }
export interface CriteriosAltaInasistencia  { umbralPorcentaje?: number }

export type CriteriosNotificacion =
  | CriteriosMembresiaVencer
  | CriteriosClienteInactivo
  | CriteriosAltaInasistencia
  | Record<string, unknown>

// ─── Modelos ─────────────────────────────────────────────────────────────────

export interface PlantillaNotificacion {
  id:        string
  nombre:    string
  asunto:    string
  cuerpo:    string
  canal:     CanalNotificacion
  variables: string[]
  createdAt: string
  updatedAt: string
}

export interface LogNotificacion {
  id:                string
  configuracionId:   string
  canal:             CanalNotificacion
  destinatarioEmail?: string
  asunto?:           string
  exitoso:           boolean
  error?:            string
  totalEnviados:     number
  ejecutadoEn:       string
  configuracion?:    { nombre: string; disparador: TipoDisparador }
}

export interface ConfiguracionNotificacion {
  id:             string
  nombre:         string
  descripcion?:   string
  activa:         boolean
  disparador:     TipoDisparador
  criterios:      CriteriosNotificacion
  frecuencia:     FrecuenciaNotificacion
  canal:          CanalNotificacion
  destinatario:   TipoDestinatario
  plantillaId?:   string
  plantilla?:     PlantillaNotificacion
  ultimaEjecucion?: string
  createdAt:      string
  updatedAt:      string
  logs?:          LogNotificacion[]
}

// ─── Payloads API ─────────────────────────────────────────────────────────────

export interface CreateConfiguracionNotificacionPayload {
  nombre:        string
  descripcion?:  string
  activa?:       boolean
  disparador:    TipoDisparador
  criterios?:    CriteriosNotificacion
  frecuencia:    FrecuenciaNotificacion
  canal:         CanalNotificacion
  destinatario:  TipoDestinatario
  plantillaId?:  string
}

export type UpdateConfiguracionNotificacionPayload =
  Partial<CreateConfiguracionNotificacionPayload>

export interface CreatePlantillaPayload {
  nombre:    string
  asunto:    string
  cuerpo:    string
  canal?:    CanalNotificacion
  variables?: string[]
}

export type UpdatePlantillaPayload = Partial<CreatePlantillaPayload>

// ─── Variables de plantilla ───────────────────────────────────────────────────

export interface VariableInfo {
  campo:       string
  descripcion: string
  ejemplo:     string
}

export interface VariablesDisparador {
  disparador: TipoDisparador
  variables:  VariableInfo[]
}

// ─── Opciones para UI ─────────────────────────────────────────────────────────

export const DISPARADOR_OPTIONS: { value: TipoDisparador; label: string; descripcion: string }[] = [
  { value: 'MEMBRESIA_POR_VENCER', label: 'Membresías por vencer',     descripcion: 'Clientes cuya membresía vence en N días' },
  { value: 'MEMBRESIA_VENCIDA',    label: 'Membresías vencidas',       descripcion: 'Clientes con membresía actualmente vencida' },
  { value: 'CLIENTE_EN_DEUDA',     label: 'Clientes con deuda',        descripcion: 'Clientes marcados con estado EN_DEUDA' },
  { value: 'CLIENTE_INACTIVO',     label: 'Clientes inactivos',        descripcion: 'Clientes sin asistencias en N días' },
  { value: 'ALTA_INASISTENCIA',    label: 'Alta inasistencia',         descripcion: 'Clientes con % de asistencia por debajo del umbral' },
  { value: 'PAGO_REGISTRADO',      label: 'Pago registrado',           descripcion: 'Se ejecuta manualmente al registrar un pago' },
  { value: 'NUEVO_CLIENTE',        label: 'Nuevo cliente',             descripcion: 'Se ejecuta manualmente al dar de alta un cliente' },
]

export const FRECUENCIA_OPTIONS: { value: FrecuenciaNotificacion; label: string }[] = [
  { value: 'MANUAL',  label: 'Manual (solo bajo demanda)' },
  { value: 'HOURLY',  label: 'Cada hora' },
  { value: 'DAILY',   label: 'Diario — 8:00 AM' },
  { value: 'WEEKLY',  label: 'Semanal — lunes 8:00 AM' },
  { value: 'MONTHLY', label: 'Mensual — día 1, 8:00 AM' },
]

export const CANAL_OPTIONS: { value: CanalNotificacion; label: string; disponible: boolean }[] = [
  { value: 'EMAIL',    label: 'Email',     disponible: true  },
  { value: 'WHATSAPP', label: 'WhatsApp',  disponible: false }, // futuro
]
