export type ExpenseCategory = 'rent' | 'utilities' | 'equipment' | 'salaries' | 'maintenance' | 'other'

export interface Expense {
  id: number
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
