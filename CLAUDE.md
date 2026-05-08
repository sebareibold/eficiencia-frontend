# CLAUDE.md — eficiencia-frontend

> Hablá siempre en español. Leé esto antes de tocar cualquier archivo del frontend.

---

## Contexto del Proyecto

App web para la gestión integral del gimnasio **Eficiencia** (cliente: Gonzalo, dueño del gimnasio).
El frontend consume la API REST del repo `eficiencia-backend`.

- **Entrega:** 28/05/2026
- **Deploy destino:** Vercel
- **Backend local:** `http://localhost:3000`
- **Backend prod:** Railway (pendiente deploy)
- **Estado:** Frontend 100% implementado — todas las páginas funcionando con mock/fallback data

> La app **registra** pagos (quién pagó, cuánto, cómo). No procesa cobros online. Sin MercadoPago ni Stripe.

---

## Stack

| Herramienta | Versión | Uso |
|---|---|---|
| React | 18 | Framework principal |
| Vite | latest | Bundler + dev server |
| TailwindCSS | 3 | Estilos (darkMode: 'class') |
| React Router | v6 | Ruteo con guards |
| Zustand | latest | Estado global (auth, UI, settings) |
| Axios | latest | HTTP client + interceptores JWT |
| React Hook Form + Zod | 7 / latest | Formularios + validación |
| Recharts | 2 | Gráficos del Dashboard |
| Framer Motion | 12 | Animaciones de entrada/transición |
| Lucide React | latest | Íconos |
| date-fns | 4 | Manipulación de fechas |

---

## Estructura de Carpetas

```
src/
├── api/
│   ├── axiosInstance.ts       # baseURL, interceptor request (JWT), interceptor response (401→refresh)
│   ├── auth.api.ts            # login(), logout()
│   ├── clients.api.ts         # getAll(), getById(), create(), update(), delete()
│   ├── payments.api.ts        # getAll(), create(), update(), delete(), toggleInvoiced()
│   ├── shifts.api.ts          # getAll(), getById(), create(), update(), delete()
│   ├── attendance.api.ts      # mark(), fetchByShiftAndDate()
│   ├── expenses.api.ts        # getAll(), create(), update(), delete()
│   └── dashboard.api.ts       # getSummary()
├── components/
│   ├── ui/
│   │   ├── Button.tsx         # variant: primary|secondary|danger|ghost; prop isLoading
│   │   ├── Input.tsx          # con label y error, compatible con RHF register()
│   │   ├── Select.tsx         # con label y error, compatible con RHF register()
│   │   ├── Modal.tsx          # createPortal, cierra con Escape o click overlay
│   │   ├── Table.tsx          # columns config, isLoading→Skeleton, sortKey/sortDir/onSort
│   │   ├── Badge.tsx          # recibe status: ClientStatus → renderiza color correcto
│   │   ├── Card.tsx           # wrapper genérico
│   │   ├── Spinner.tsx        # loader inline
│   │   ├── Skeleton.tsx       # placeholder de carga
│   │   └── Toast.tsx          # notificación auto-dismiss
│   └── layout/
│       ├── Layout.tsx         # Navbar + Outlet + SettingsDrawer + ToastContainer
│       ├── Navbar.tsx         # Pill nav responsive con ResizeObserver, user badge, logout
│       └── SettingsDrawer.tsx # Appearance, Dashboard, System, Account, Security
├── pages/
│   ├── LoginPage.tsx          # Form con Zod, login real via API
│   ├── ClientsPage.tsx        # Tabla + búsqueda + filtros por estado + modal crear cliente
│   ├── ClientProfilePage.tsx  # Perfil con tabs Pagos/Asistencia, editar en modal
│   ├── PaymentsPage.tsx       # Resumen mensual, tabla filtrable, registrar pago
│   ├── ShiftsPage.tsx         # Grid de cards, filtros sala/día, crear turno
│   ├── AttendancePage.tsx     # Selector turno+fecha, checklist presentes, bulk save
│   ├── CalendarPage.tsx       # Vista semanal Lun–Sáb, navegación, modal detalle turno
│   ├── ExpensesPage.tsx       # Resumen mensual, tabla CRUD, filtros categoría
│   └── DashboardPage.tsx      # KPIs con comparativa, BarChart métodos pago, LineChart histórico
├── store/
│   ├── authStore.ts           # user, accessToken, refreshToken — persistido en localStorage
│   ├── uiStore.ts             # toasts con addToast/removeToast, auto-dismiss 4s
│   └── settingsStore.ts       # appearance (theme/accentColor/density), notificaciones, sistema
├── hooks/
│   ├── useClients.ts          # fetch clientes con loading/error/refetch
│   ├── usePayments.ts         # fetch pagos, acepta params {month?, clientId?}
│   ├── useShifts.ts           # fetch turnos
│   ├── useAttendance.ts       # fetchByShiftAndDate(shiftId, date)
│   ├── useExpenses.ts         # fetch gastos, acepta params {month?, category?}
│   ├── useDashboard.ts        # fetch stats — tiene FALLBACK A MOCK DATA si API falla
│   └── useThemeApplier.ts     # aplica dark/light class en <html>, accentColor via CSS vars
├── guards/
│   ├── PrivateRoute.tsx       # Redirige a /login si no hay accessToken
│   └── RoleGuard.tsx          # Redirige a /clients si role !== 'admin'
├── types/
│   ├── auth.types.ts          # User { id, name, lastName, email, role: 'admin'|'staff' }
│   ├── client.types.ts        # Client { id, name, lastName, email, phone, dni, status, membershipExpiresAt }
│   ├── payment.types.ts       # Payment { id, clientId, clientName, amount, method, invoiced, paidAt }
│   ├── shift.types.ts         # Shift { id, name, room, day: WeekDay, startTime, endTime, capacity, enrolled }
│   ├── attendance.types.ts    # AttendanceRecord { id, clientId, clientName, shiftId, date, present }
│   └── expense.types.ts       # Expense { id, description, amount, category, date }
├── utils/
│   ├── formatCurrency.ts      # ARS con Intl.NumberFormat
│   ├── formatDate.ts          # formatDate(d, pattern?) y formatDateTime(d)
│   └── getStatusColor.ts      # Tailwind class por ClientStatus + getStatusLabel()
├── constants/
│   ├── clientStatus.ts        # 'active' | 'expiring' | 'debt' | 'inactive'
│   └── routes.ts              # ROUTES: LOGIN, CLIENTS, CLIENT_PROFILE, PAYMENTS, SHIFTS, ATTENDANCE, CALENDAR, EXPENSES, DASHBOARD
├── App.tsx                    # Router + PrivateRoute + RoleGuard wrapping all pages
├── main.tsx
└── index.css                  # @tailwind + CSS vars + dark mode overrides + SaaS light mode
```

---

## Rutas y Guards

```
/login              → LoginPage          (pública)
/                   → redirect → /clients
/clients            → ClientsPage        (admin + staff, PrivateRoute)
/clients/:id        → ClientProfilePage  (admin + staff)
/payments           → PaymentsPage       (admin + staff)
/shifts             → ShiftsPage         (admin + staff)
/attendance         → AttendancePage     (admin + staff)
/calendar           → CalendarPage       (admin + staff)
/expenses           → ExpensesPage       (solo admin, RoleGuard)
/dashboard          → DashboardPage      (solo admin, RoleGuard)
*                   → redirect → /clients
```

---

## Design System

### Tema oscuro (dark mode — predominante)

```
Fondo:         #0F0F0F
Surfaces:      #1A1A1A  (cards, modals)
Accent:        rgb(var(--color-primary)) — amarillo Eficiencia #FBC608, configurable
Texto:         #FFFFFF
Texto muted:   #9CA3AF
Bordes:        rgba(255,255,255,0.08)
```

Glassmorphism aplicado en todas las páginas nuevas:
```css
background: rgba(255,255,255,0.04);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px;
```

### Tema claro (SaaS redesign — en index.css)

```
Fondo:         #F5F4F2 (warm off-white + dot grid)
Surface:       #FFFFFF
Border:        #E5E3DF
Text:          #111827
Muted:         #6B7280
```

### Color system — tailwind.config.ts

```ts
colors: {
  primary: '#FBC608',          // amarillo Eficiencia
  'primary-dark': '#D4A800',
  surface: '#1A1A1A',          // dark / #FFFFFF light via CSS override
  'custom-border': '#2A2A2A',
  // SaaS tokens (light mode):
  'saas-bg': '#F5F4F2',
  'saas-surface': '#FFFFFF',
  'saas-border': '#E5E3DF',
  'saas-text': '#111827',
  'saas-muted': '#6B7280',
}
```

### Animaciones

Todas las páginas usan Framer Motion:
```tsx
<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
```

---

## Autenticación

- `accessToken` + `refreshToken` guardados en `authStore` (persistido en localStorage)
- Axios interceptor de request: añade `Authorization: Bearer <token>`
- Axios interceptor de response: si 401 → intenta refresh → si falla, logout + redirect /login
- Roles frontend: `'admin'` | `'staff'` (el guard chequea `user.role === 'admin'`)

**Nota crítica:** El backend usa `rol` (no `role`) y los valores son `ADMINISTRADOR`, `STAFF`, `PROFESOR` (mayúsculas). Al conectar al backend real hay que mapear estos valores.

---

## Mismatches con el Backend — Pendiente de Alinear

El frontend fue construido con nombres en inglés como placeholder. El backend usa español y sus propios enums.

| Campo | Frontend (actual) | Backend (real) | Acción requerida |
|---|---|---|---|
| Endpoints | `/clients`, `/payments`, `/shifts` | `/clientes`, `/pagos`, `/turnos` | Actualizar `api/*.api.ts` |
| Estado cliente | `active`, `debt`, `expiring`, `inactive` | `ACTIVO`, `EN_DEUDA`, `VENCIDO` | Mapear en respuestas |
| Rol usuario | `admin`, `staff` | `ADMINISTRADOR`, `STAFF`, `PROFESOR` | Mapear en authStore |
| Método pago | `cash`, `transfer`, `card` | `EFECTIVO`, `TRANSFERENCIA`, `DEBITO`, `EMPRESA` | Mapear en payments.api.ts |
| Categoría gasto | `rent`, `utilities`, `equipment`, etc. | `SUELDO`, `FIJO`, `VARIABLE` | Reemplazar enum completo |

**Regla:** Al conectar, actualizar los archivos `/api/*.api.ts` haciendo el mapeo ahí. No tocar los tipos de las páginas.

---

## Tipos de Datos — Shapes Exactas

```ts
// Client
{ id: number; name: string; lastName: string; email: string; phone: string; dni: string;
  status: 'active'|'expiring'|'debt'|'inactive';
  membershipExpiresAt: string | null; createdAt: string; updatedAt: string }

// Payment
{ id: number; clientId: number; clientName: string; amount: number;
  method: 'cash'|'transfer'|'card'; invoiced: boolean; paidAt: string; notes: string | null }

// Shift
{ id: number; name: string; room: string; day: WeekDay; startTime: string;
  endTime: string; capacity: number; enrolled: number; createdAt: string }
// WeekDay = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'

// Expense
{ id: number; description: string; amount: number;
  category: 'rent'|'utilities'|'equipment'|'salaries'|'maintenance'|'other'; date: string }

// DashboardStats
{ totalIncome, totalExpenses, netProfit, previousIncome, previousExpenses, previousProfit,
  activeClients, newClients, expiringClients, debtClients,
  incomeByMonth: [{month, amount}][], expensesByMonth: [{month, amount}][],
  incomeByMethod: [{method, amount, count?}][] }
```

---

## Notas de Implementación Importantes

1. **useDashboard tiene mock data fallback** — si la API falla, muestra datos de demostración con badge "Datos de demostración". Útil para demos.

2. **Calendario muestra semana recurrente** — los turnos tienen `day: WeekDay` (un día fijo), el calendario los pone en la columna del día de la semana independientemente de qué semana se navega. Es el comportamiento correcto para gimnasio.

3. **Asistencia llama mark() individualmente** — no hay endpoint bulk en el API file actual. Se llama por cada cliente con `Promise.all`. Si el backend implementa bulk endpoint, actualizar `attendanceApi` y `AttendancePage`.

4. **ClientProfilePage carga con Promise.all** — usa `clientsApi.getById()`, `paymentsApi.getAll({ clientId })` y `attendanceApi` en paralelo, sin hook, porque necesita datos específicos de ese cliente.

5. **ExpensesPage tiene create/edit en el mismo modal** — el estado `editExpense` controla cuál operación ejecutar en `onSubmit`.

---

## Componentes UI — Contratos de Uso

```ts
Button:   variant: 'primary'|'secondary'|'danger'|'ghost', size: 'sm'|'md'|'lg', isLoading: boolean
Modal:    isOpen, onClose, title?, size?: 'sm'|'md'|'lg' — usa createPortal
Badge:    status: ClientStatus → getStatusColor/getStatusLabel automático
Table:    columns: Column<T>[], data: T[], keyExtractor, isLoading→Skeleton, sortKey/sortDir/onSort
Input:    label, error, compatible con register() de RHF
Select:   label, error, compatible con register() de RHF
```

---

## Convenciones

- Componentes: `PascalCase` → `ClientCard.tsx`
- Hooks: `camelCase` con prefijo `use` → `useClients.ts`
- Constantes: `UPPER_SNAKE_CASE`
- Tipos: `*.types.ts`
- **Nunca** hacer axios directo dentro de un componente — siempre via `/api/[modulo].api.ts`
- Todo fetch → `isLoading` → mostrar `Skeleton` o `Spinner`
- Todo fetch → `error` → mostrar mensaje amigable
- Acciones → `Toast` de éxito o error
- TypeScript `strict: true`, prohibido usar `any`
- Formularios siempre con React Hook Form + Zod, errores inline

---

## Variables de Entorno

```env
VITE_API_URL=http://localhost:3000   # local
VITE_API_URL=https://<railway-url>   # producción
```

---

## Estado de Implementación

### Completado
- Setup Vite + React + TailwindCSS + design system Eficiencia
- Layout (Navbar + SettingsDrawer) responsive
- LoginPage con Zod + conexión a API
- Rutas protegidas por auth y rol (PrivateRoute + RoleGuard)
- Todos los componentes UI base (`/components/ui/`)
- Todos los archivos API (`/api/`)
- Todos los hooks (`/hooks/`)
- Todos los tipos (`/types/`)
- ClientsPage — tabla, búsqueda, filtros, modal crear
- ClientProfilePage — perfil, tabs Pagos/Asistencia, editar
- PaymentsPage — resumen mensual, tabla con filtros, registrar pago
- ShiftsPage — grid cards, filtros sala/día, crear turno
- AttendancePage — selector turno+fecha, checklist, bulk save
- CalendarPage — vista semanal, navegación, modal detalle
- ExpensesPage — resumen mensual, tabla CRUD, filtros categoría
- DashboardPage — KPIs, BarChart métodos, LineChart histórico

### Pendiente
- Conectar al backend real (resolver mismatches de tipos en `/api/`)
- Build sin errores TypeScript
- Variables de entorno en Vercel
- Deploy en Vercel

---

## Reuniones con el Cliente

| Fecha | Reunión | Estado |
|-------|---------|--------|
| 01/05 | #1 — Layout, login, navegación, design system | ✅ Realizada |
| 07/05 | #2 — Módulo Clientes completo | ✅ Realizada |
| 14/05 | #3 — Sistema operativo completo: pagos, turnos, asistencia, calendario | Pendiente |
| 21/05 | #4 — Demo final: plataforma integrada + dashboard + flujos admin | Pendiente |
| 28/05 | Entrega — Deploy producción + capacitación Gonzalo | Pendiente |
