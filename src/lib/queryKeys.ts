// Claves de queries centralizadas — facilita invalidación cruzada y evita typos

export const QK = {
  clients: {
    all:    (p?: object) => ['clients', p]    as const,
    detail: (id: string) => ['clients', id]   as const,
  },
  payments: {
    all:     (p?: object) => ['payments', p]                    as const,
    detail:  (id: string | number) => ['payments', 'detail', String(id)] as const,
    summary: (p?: object) => ['payments', 'summary', p]         as const,
  },
  shifts: {
    all:    ()           => ['shifts']        as const,
    detail: (id: string) => ['shifts', id]    as const,
  },
  plans: {
    all:    ()           => ['plans']         as const,
  },
  expenses: {
    all:    (p?: object) => ['expenses', p]   as const,
  },
  listaEspera: {
    byTurno: (turnoId: string | null) => ['lista-espera', turnoId] as const,
  },
  rutinas: {
    byCliente: (clienteId: string | undefined) => ['rutinas', clienteId] as const,
  },
  attendance: {
    byShiftDate: (shiftId: string, date: string) => ['attendance', shiftId, date] as const,
  },
  dashboard: {
    alertas:     ()           => ['dashboard', 'alertas']              as const,
    financiero:  (p?: object) => ['dashboard', 'financiero', p]        as const,
    clientes:    ()           => ['dashboard', 'clientes']             as const,
    facturacion: (p?: object) => ['dashboard', 'facturacion', p]       as const,
    historico:   (meses: number) => ['dashboard', 'historico', meses]  as const,
  },
} as const
