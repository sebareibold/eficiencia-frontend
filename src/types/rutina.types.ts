export interface EjecucionCliente {
  id: string
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
  fecha: string
  createdAt: string
}

export interface EjercicioPlan {
  id: string
  bloqueId: string
  catalogoId?: string
  nombre: string
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
  orden: number
  ejecuciones: EjecucionCliente[]
  catalogo?: { nombre: string; patronMovimiento?: string; videoUrl?: string }
}

export interface Bloque {
  id: string
  sesionId: string
  letra: string
  orden: number
  ejerciciosPlan: EjercicioPlan[]
}

export interface Sesion {
  id: string
  semanaId: string
  dia: string
  orden: number
  bloques: Bloque[]
}

export interface Semana {
  id: string
  rutinaId: string
  numero: number
  nombre?: string
  sesiones: Sesion[]
}

export interface Rutina {
  id: string
  clienteId: string
  profesorId: string
  nombre: string
  descripcion?: string
  activa: boolean
  createdAt: string
  updatedAt: string
  semanas: Semana[]
  cliente?: { nombre: string; apellido: string }
  profesor?: { usuario: { nombre: string } }
}

export interface CreateRutinaPayload {
  clienteId: string
  profesorId: string
  nombre: string
  descripcion?: string
}

export interface UpdateRutinaPayload {
  nombre?: string
  descripcion?: string
  activa?: boolean
}

export interface CreateEjercicioPlanPayload {
  nombre: string
  catalogoId?: string
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
  orden?: number
}

export interface UpdateEjercicioPlanPayload {
  nombre?: string
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
}

export interface CreateEjecucionPayload {
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
}

// ─── Nuevos tipos para el módulo de rutinas con plantillas ───────────────────

export type PatronMovimientoEnum =
  | 'RODILLA_DOMINANTE'
  | 'CADERA_DOMINANTE'
  | 'EMPUJE'
  | 'TRACCION'
  | 'HIBRIDO'
  | 'HOMBROS'
  | 'ACCESORIO'
  | 'OTROS'

export type TipoDistribucion = 'FULL_BODY' | 'ARM_LEG' | 'PUSH_PULL' | 'CUSTOM'

export type PeriodoEntrenamiento = 'CARGA' | 'IMPACTO' | 'DESCARGA' | 'MANTENIMIENTO'

export interface PlantillaBloqueData {
  id: string
  letra: string
  orden: number
  patronMovimiento: PatronMovimientoEnum
  cantidadEjercicios: number
}

export interface PlantillaSesionData {
  id: string
  numero: number
  nombre?: string
  bloques: PlantillaBloqueData[]
}

export interface PlantillaRutinaData {
  id: string
  nombre: string
  tipo: TipoDistribucion
  cantidadSesiones: number
  activa: boolean
  sesiones: PlantillaSesionData[]
}

// ─── Tipos del wizard de creación ────────────────────────────────────────────

export interface EjercicioCatalogoItem {
  id: string
  nombre: string
  patronMovimiento?: PatronMovimientoEnum
  dificultad: 'FACIL' | 'DIFICIL' | 'AVANZADO'
  puntaje?: number
  videoUrl?: string
  activo: boolean
}

export interface EjercicioDraft {
  _id: string
  catalogoId?: string
  nombre: string
  series?: number
  repeticiones?: string
  peso?: string
  rir?: number
  rpe?: number
  metodo?: string
  notas?: string
  _esReferencia?: boolean
  _referenciaData?: {
    nombre: string
    series?: number
    repeticiones?: string
    peso?: string
    rir?: number
  }
}

export interface BloqueDraft {
  _id: string
  letra: string
  orden: number
  patronMovimiento: PatronMovimientoEnum | null
  cantidadEjercicios: number
  ejercicios: EjercicioDraft[]
}

export interface SesionDraft {
  _id: string
  numero: number
  nombre?: string
  bloques: BloqueDraft[]
}

export type WizardModo = 'nueva' | 'mesociclo'

export interface ClienteResumen {
  id: string
  nombre: string
  apellido: string
  planActivo: string | null
  frecuenciaSemanal: number | null
  membresiaVigente: boolean
  rutinaActivaId: string | null
  rutinaActivaNombre: string | null
}

export interface WizardState {
  paso: number
  modo: WizardModo

  // Paso 1
  cliente: ClienteResumen | null

  // Paso 2
  sesionesSemanales: number | null

  // Paso 3
  plantillaId: string | null
  sinPlantilla: boolean

  // Pasos 4-5
  sesiones: SesionDraft[]

  // Paso 6
  nombre: string
  cantidadSemanas: number
  fechaInicio: string
  periodo: PeriodoEntrenamiento | null
  descripcion: string

  // Para mesociclo
  rutinaBaseId: string | null
  rutinaBaseSesiones: SesionDraft[]
}

export interface CrearCompletaPayload {
  clienteId: string
  nombre: string
  descripcion?: string
  cantidadSemanas: number
  fechaInicio?: string
  periodo?: PeriodoEntrenamiento
  plantillaId?: string
  rutinaBaseId?: string
  sesiones: {
    numero: number
    nombre?: string
    bloques: {
      letra: string
      orden: number
      patronMovimiento?: PatronMovimientoEnum
      ejercicios: {
        catalogoId?: string
        nombre: string
        series?: number
        repeticiones?: string
        peso?: string
        rir?: number
        rpe?: number
        metodo?: string
        notas?: string
        orden?: number
      }[]
    }[]
  }[]
}
