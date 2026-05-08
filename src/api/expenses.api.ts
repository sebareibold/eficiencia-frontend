import api from './axiosInstance'
import type { Expense, CreateExpenseDto, UpdateExpenseDto } from '../types/expense.types'

function mapGasto(g: any): Expense {
  return {
    id: g.id,
    description: g.descripcion,
    amount: Number(g.monto),
    category: g.categoria,
    date: g.fecha,
    createdAt: g.createdAt,
  }
}

export const expensesApi = {
  getAll: (params?: { month?: string; category?: string }): Promise<Expense[]> =>
    api.get('/gastos', {
      params: {
        ...(params?.month && { mes: params.month }),
        ...(params?.category && params.category !== 'all' && { categoria: params.category }),
      },
    }).then((r) => (Array.isArray(r.data) ? r.data : []).map(mapGasto)),

  create: (dto: CreateExpenseDto): Promise<Expense> =>
    api.post('/gastos', {
      descripcion: dto.description,
      monto: dto.amount,
      categoria: dto.category,
      fecha: dto.date,
    }).then((r) => mapGasto(r.data)),

  update: (id: string | number, dto: UpdateExpenseDto): Promise<Expense> =>
    api.patch(`/gastos/${id}`, {
      ...(dto.description !== undefined && { descripcion: dto.description }),
      ...(dto.amount !== undefined && { monto: dto.amount }),
      ...(dto.category !== undefined && { categoria: dto.category }),
      ...(dto.date !== undefined && { fecha: dto.date }),
    }).then((r) => mapGasto(r.data)),

  remove: (id: string | number) => api.delete(`/gastos/${id}`),
}
