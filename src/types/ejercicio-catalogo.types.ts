export type Dificultad = 'FACIL' | 'DIFICIL' | 'AVANZADO'

export const DIFICULTAD_LABELS: Record<string, string> = {
  FACIL: 'Fácil',
  DIFICIL: 'Difícil',
  AVANZADO: 'Avanzado',
}

export interface CategoriaEjercicioBasic {
  id: string
  nombre: string
}

export interface EjercicioCatalogo {
  id: string
  nombre: string
  descripcion?: string
  videoUrl?: string
  patronMovimiento?: string
  dificultad?: Dificultad    // legacy
  categoriaId?: string
  categoria?: CategoriaEjercicioBasic
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
  categoriaId?: string
}

export interface UpdateEjercicioCatalogoPayload {
  nombre?: string
  descripcion?: string
  videoUrl?: string
  patronMovimiento?: string
  dificultad?: Dificultad
  categoriaId?: string
}

export interface EjerciciosCatalogoFilters {
  nombre?: string
  categoriaId?: string
  patronMovimiento?: string
  startsWith?: boolean
}
