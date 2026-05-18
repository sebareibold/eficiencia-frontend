export interface Ejercicio {
  id: string
  rutinaId: string
  nombre: string
  series: number
  repeticiones: string
  peso?: string
  notas?: string
  orden: number
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
  ejercicios: Ejercicio[]
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

export interface CreateEjercicioPayload {
  nombre: string
  series: number
  repeticiones: string
  peso?: string
  notas?: string
  orden?: number
  catalogoId?: string
}

export interface UpdateEjercicioPayload {
  nombre?: string
  series?: number
  repeticiones?: string
  peso?: string
  notas?: string
  orden?: number
}
