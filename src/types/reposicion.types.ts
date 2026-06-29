// ─── Módulo Reposición de Clases ────────────────────────────────────────────

export type EstadoReposicion = 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA'

export interface TurnoResumen {
  id: string
  horaInicio: string
  horaFin: string
  diasSemana: string[]
}

export interface AusenciaTurno {
  id: string
  inscripcionId: string
  clienteId: string
  fecha: string // ISO date string (YYYY-MM-DD)
  conAviso: boolean
  notas?: string | null
  createdAt: string
  cliente: { id: string; nombre: string; apellido: string }
  inscripcion: {
    id: string
    turno: TurnoResumen
  }
  recuperacion?: RecuperacionClase | null
}

export interface RecuperacionClase {
  id: string
  ausenciaId: string
  clienteId: string
  turnoDestinoId: string
  fecha: string // ISO date string
  estado: EstadoReposicion
  notas?: string | null
  createdAt: string
  cliente: { id: string; nombre: string; apellido: string }
  turnoDestino: TurnoResumen
  ausencia?: {
    id: string
    fecha: string
    inscripcion: { turno: TurnoResumen }
  }
}

export interface CupoInfo {
  turnoId: string
  fecha: string
  capacidadA: number
  capacidadB: number
  inscriptosA: number
  inscriptosB: number
  recuperacionesPendientes: number
  cupoDisponibleA: number
  cupoDisponibleB: number
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateAusenciaPayload {
  inscripcionId: string
  fecha: string
  conAviso?: boolean
  notas?: string
}

export interface CreateRecuperacionPayload {
  turnoDestinoId: string
  fecha: string
  notas?: string
}

export interface UpdateAusenciaPayload {
  conAviso?: boolean
  notas?: string
}

export interface UpdateRecuperacionPayload {
  turnoDestinoId?: string
  fecha?: string
  estado?: EstadoReposicion
  notas?: string
}
