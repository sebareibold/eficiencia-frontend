export type ExpenseCategory = 'SUELDO' | 'FIJO' | 'VARIABLE'

export interface Expense {
  id: number | string
  description: string
  amount: number
  category: ExpenseCategory
  date: string
  createdAt: string
}

export interface CreateExpenseDto {
  description: string
  amount: number
  category: ExpenseCategory
  date: string
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> {}
