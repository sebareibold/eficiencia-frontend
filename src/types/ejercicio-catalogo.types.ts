export type Dificultad = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO'

export interface EjercicioCatalogo {
  id: string
  nombre: string
  descripcion?: string
  videoUrl?: string
  gruposMusculares: string[]
  dificultad: Dificultad
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateEjercicioCatalogoPayload {
  nombre: string
  descripcion?: string
  videoUrl?: string
  gruposMusculares?: string[]
  dificultad?: Dificultad
}

export interface UpdateEjercicioCatalogoPayload {
  nombre?: string
  descripcion?: string
  videoUrl?: string
  gruposMusculares?: string[]
  dificultad?: Dificultad
}

export interface EjerciciosCatalogoFilters {
  nombre?: string
  dificultad?: Dificultad
  grupoMuscular?: string
}
