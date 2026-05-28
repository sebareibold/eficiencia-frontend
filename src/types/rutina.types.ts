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
