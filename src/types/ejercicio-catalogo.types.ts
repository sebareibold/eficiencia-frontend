export type Dificultad = 'FACIL' | 'DIFICIL' | 'AVANZADO'

export const DIFICULTAD_LABELS: Record<Dificultad, string> = {
  FACIL: 'Fácil',
  DIFICIL: 'Difícil',
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
  startsWith?: boolean
}
