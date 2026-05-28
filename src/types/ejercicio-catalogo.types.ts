export type Dificultad = 'FACIL' | 'INTERMEDIO' | 'AVANZADO'

export const DIFICULTAD_LABELS: Record<Dificultad, string> = {
  FACIL: 'Fácil',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
}

export interface EjercicioCatalogo {
  id: string
  nombre: string
  descripcion?: string
  videoUrl?: string
  patronMovimiento?: string
  dificultad: Dificultad
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateEjercicioCatalogoPayload {
  nombre: string
  descripcion?: string
  videoUrl?: string
  patronMovimiento?: string
  dificultad?: Dificultad
}

export interface UpdateEjercicioCatalogoPayload {
  nombre?: string
  descripcion?: string
  videoUrl?: string
  patronMovimiento?: string
  dificultad?: Dificultad
}

export interface EjerciciosCatalogoFilters {
  nombre?: string
  dificultad?: Dificultad
  patronMovimiento?: string
}
