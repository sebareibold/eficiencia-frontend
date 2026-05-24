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
- **Estado (20/05/2026):** Plataforma completa. Refactor membresías (TarifaVigente + Modalidad). Dashboard rediseñado con 5 secciones + alertas operativas. Sistema de permisos dinámicos implementado. Responsive fix aplicado en todas las páginas.

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
│   ├── memberships.api.ts     # getAll(), create(), update(), remove()
│   ├── shifts.api.ts          # getAll(), getById(), create(), update(), delete(); professorsApi
│   ├── attendance.api.ts      # mark(), bulk(), fetchByShiftAndDate()
│   ├── inscripciones.api.ts   # enroll(), darDeBaja(), getByTurno()
│   ├── listaEspera.api.ts     # create(), updateEstado(), remove()
│   ├── expenses.api.ts        # getAll(), create(), update(), delete()
│   ├── dashboard.api.ts       # getSummary()
│   ├── configuracion.api.ts   # get(), update()
│   ├── permisos.api.ts        # getForMyRole(), getAll(), update()
│   ├── usuarios.api.ts        # CRUD + linkProfesor, unlinkProfesor, updateProfesor
│   ├── rutinas.api.ts         # CRUD rutinas + ejercicios
│   └── solicitudes.api.ts     # create(), getAll(), aprobar(), rechazar()
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
│   │   ├── Toast.tsx          # notificación auto-dismiss
│   │   └── KpiCard.tsx        # card métrica con icono
│   └── layout/
│       ├── Layout.tsx         # Navbar + Outlet + SettingsDrawer + ToastContainer
│       ├── Navbar.tsx         # Pill nav responsive con ResizeObserver, user badge, logout
│       └── SettingsDrawer.tsx # Appearance, Dashboard, System, Account, Security
├── pages/
│   ├── LoginPage.tsx          # Form login + formulario "Solicitar Acceso" → POST /solicitudes
│   ├── ClientsPage.tsx        # Tabla + búsqueda + filtros por estado + modal crear cliente
│   ├── ClientProfilePage.tsx  # Perfil con tabs Pagos/Asistencia, editar en modal
│   ├── PaymentsPage.tsx       # Vista unificada: KPIs + filtros + toggle Lista/Grid + tabla/cards de pagos + sección membresías debajo
│   ├── MembershipsPage.tsx    # (legacy, la funcionalidad está en PaymentsPage)
│   ├── ShiftsPage.tsx         # Grid cards, filtros sala/día, crear turno
│   ├── ShiftDetailPage.tsx    # Tabs: Resumen / Inscripciones / Asistencia / Lista de Espera. Edición inline en card hero
│   ├── AttendancePage.tsx     # Selector turno+fecha, checklist, bulk save
│   ├── CalendarPage.tsx       # Vista semanal Lun–Sáb, navegación, modal detalle turno
│   ├── ExpensesPage.tsx       # Resumen mensual, tabla CRUD, filtros categoría
│   ├── DashboardPage.tsx      # KPIs, BarChart métodos, LineChart histórico (con fallback mock)
│   ├── UsersPage.tsx          # 4 tabs: Usuarios / Profesores / Roles y Permisos (API) / Solicitudes
│   ├── SettingsPage.tsx       # Configuración de usuario
│   ├── ClientRutinaPage.tsx   # Rutina de ejercicios del cliente
│   └── SettingsPage.tsx       # Configuración
├── store/
│   ├── authStore.ts           # user, accessToken, refreshToken — persistido en localStorage
│   ├── uiStore.ts             # toasts con addToast/removeToast, auto-dismiss 4s
│   └── settingsStore.ts       # appearance (theme/accentColor/density), notificaciones, sistema
├── hooks/
│   ├── useClients.ts          # fetch clientes con loading/error/refetch
│   ├── usePayments.ts         # fetch pagos, acepta params {desde?, hasta?, anio?}
│   ├── useMemberships.ts      # fetch planes/membresías
│   ├── useShifts.ts           # fetch turnos
│   ├── useAttendance.ts       # fetchByShiftAndDate(shiftId, date)
│   ├── useExpenses.ts         # fetch gastos, acepta params {mes?, categoria?}
│   ├── useDashboard.ts        # fetch stats — FALLBACK A MOCK DATA si API falla
│   ├── useListaEspera.ts      # fetch lista de espera por turnoId
│   ├── usePermissions.ts      # fetch permisos del usuario autenticado
│   ├── useRutinas.ts          # fetch rutinas del cliente
│   └── useThemeApplier.ts     # aplica dark/light class en <html>, accentColor via CSS vars
├── guards/
│   ├── PrivateRoute.tsx       # Redirige a /login si no hay accessToken
│   └── RoleGuard.tsx          # Redirige a /clients si role !== 'admin'
├── types/
│   ├── auth.types.ts          # User { id, name, lastName, email, role: 'admin'|'staff' }
│   ├── client.types.ts        # Client
│   ├── payment.types.ts       # Payment { method: 'cash'|'transfer'|'card' }
│   ├── shift.types.ts         # Shift, WeekDay
│   ├── attendance.types.ts    # AttendanceRecord
│   ├── expense.types.ts       # Expense
│   ├── membership.types.ts    # Membership/Plan
│   ├── listaEspera.types.ts   # ListaEspera, TipoEspera, EstadoEspera
│   └── rutina.types.ts        # Rutina, Ejercicio
├── utils/
│   ├── formatCurrency.ts      # ARS con Intl.NumberFormat
│   ├── formatDate.ts          # formatDate(d, pattern?) y formatDateTime(d)
│   └── getStatusColor.ts      # Tailwind class por ClientStatus + getStatusLabel()
├── constants/
│   ├── clientStatus.ts        # 'active' | 'expiring' | 'debt' | 'inactive'
│   └── routes.ts              # ROUTES: LOGIN, CLIENTS, PAYMENTS, SHIFTS, etc.
├── lib/
│   └── motion.ts              # Variantes de Framer Motion reutilizables
├── App.tsx                    # Router + PrivateRoute + RoleGuard
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
/clients/:id/rutina → ClientRutinaPage   (admin + staff)
/payments           → PaymentsPage       (admin + staff)
/payments/:id       → PaymentDetailPage  (admin + staff)
/shifts             → ShiftsPage         (admin + staff)
/shifts/:id         → ShiftDetailPage    (admin + staff)
/attendance         → AttendancePage     (admin + staff)
/calendar           → CalendarPage       (admin + staff)
/exercises          → ExercisesPage      (admin + staff)
/expenses           → ExpensesPage       (solo admin, RoleGuard)
/memberships        → MembershipsPage    (solo admin, RoleGuard)
/dashboard          → DashboardPage      (solo admin, RoleGuard)
/usuarios           → UsersPage          (solo admin, RoleGuard)
/settings           → SettingsPage       (solo admin, RoleGuard)
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
Texto muted:   #9CA3AF / #8A8A9A
Bordes:        rgba(255,255,255,0.08)
```

Glassmorphism aplicado en todas las páginas:
```css
background: rgba(255,255,255,0.04);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px–32px;
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
  primary: '#FBC608',
  'primary-dark': '#D4A800',
  surface: '#1A1A1A',
  'custom-border': '#2A2A2A',
  'saas-bg': '#F5F4F2',
  'saas-surface': '#FFFFFF',
  'saas-border': '#E5E3DF',
  'saas-text': '#111827',
  'saas-muted': '#6B7280',
}
```

---

## Autenticación

- `accessToken` + `refreshToken` guardados en `authStore` (persistido en localStorage)
- Axios interceptor de request: añade `Authorization: Bearer <token>`
- Axios interceptor de response: si 401 → intenta refresh → si falla, logout + redirect /login
- Roles frontend: `'admin'` | `'staff'` (el guard chequea `user.role === 'admin'`)

**Nota crítica:** El backend usa `rol` (no `role`) y los valores son `ADMINISTRADOR`, `STAFF`, `PROFESOR` (mayúsculas). Al conectar al backend real hay que mapear estos valores en `authStore.ts`.

---

## Comportamiento de páginas clave

### PaymentsPage
- Vista unificada — sin tabs de navegación superior
- Sección pagos: KPIs + toolbar (filtros colapsable + contador resultados + toggle Lista/Grid)
  - Vista Lista desktop: tabla 5 columnas — Cliente (avatar inicial) · Importe · Método·Fecha · Estado (badge clickable toggle facturado) · Acciones (trash hover)
  - Vista Lista mobile: cards con avatar inicial + método·fecha en línea + badge facturado
  - Vista Grid: cards en grid 1/2/3 columnas
  - Click en fila/card → navega a `/payments/:id` (PaymentDetailPage)
- Separación con `min-h-[25vh]` spacer antes de la sección membresías
- Sección membresías: debajo del fold, visible solo al scrollear
- Header: dos botones independientes "Nueva membresía" y "Nuevo pago"

### PaymentDetailPage
- Ruta `/payments/:id`, accesible para admin + staff
- Back button → `/payments`
- Hero card: monto grande, método con color e ícono propios, fecha, badge facturado
- Card cliente con nombre + botón "Ver perfil →" que linkea a `/clients/:clientId`
- Card comprobante/notas (si existe)
- Card membresía vinculada con estado badge coloreado (si existe)
- Acciones: toggle facturado (todos) · eliminar (solo admin)
- Desde ClientProfilePage: botón "Ver" en cuotas + click en fila de tabla de pagos navegan aquí

### ShiftDetailPage
- Card hero: información del turno + barra de ocupación
  - Botón "Editar" (solo admin): activa modo edición **inline dentro del mismo card** (AnimatePresence)
  - En modo edición: formulario con Sala, Días, Recurrente, Horario, Cupo, Profesor + botones Cancelar/Guardar
- Sub-navegación con 4 tabs: **Resumen → Inscripciones → Asistencia → Lista de Espera**
  - No hay tab "Editar" separada

### UsersPage (4 tabs)
- **Usuarios**: CRUD usuarios + filtro por rol + búsqueda
- **Profesores**: vincular/desvincular perfiles de profesor
- **Roles y Permisos**: matriz interactiva conectada a `GET/PATCH /permisos`. IDs de módulos: `clients`, `payments`, `shifts`, `attendance`, `memberships`, `expenses`, `dashboard`, `users`, `rutinas`. IDs de roles: `ADMINISTRADOR`, `STAFF`, `PROFESOR`
- **Solicitudes**: lista de solicitudes de acceso (PENDIENTE/APROBADO/RECHAZADO). Admin puede aprobar (crea usuario) o rechazar

### LoginPage
- Vista `login`: formulario email + contraseña
- Vista `request`: formulario "Solicitar Acceso" con nombre, email, contraseña (con toggle mostrar/ocultar) y select de rol (`ADMINISTRADOR`, `STAFF`, `PROFESOR`) → llama a `POST /solicitudes`

---

## Mapeos Frontend/Backend — Implementados ✅

Todos los mapeos están en `/api/*.api.ts`. Los tipos internos de las páginas no fueron tocados.

| Campo | Tipo interno (frontend) | Valor en API (backend) | Implementado en |
|---|---|---|---|
| Endpoints | — | `/clientes`, `/pagos`, `/turnos`, etc. | Cada `api/*.api.ts` |
| Estado cliente | `active`, `debt`, `expiring` | `ACTIVO`, `EN_DEUDA`, `VENCIDO` | `clients.api.ts` → `mapEstado()` |
| Rol usuario | `admin`, `staff`, `profesor` | `ADMINISTRADOR`, `STAFF`, `PROFESOR` | `auth.api.ts` → login mapper |
| Método pago | `cash`, `transfer`, `card` | `EFECTIVO`, `TRANSFERENCIA`, `DEBITO`, `EMPRESA` | `payments.api.ts` → `mapMetodo*()` |
| Categoría gasto | `SUELDO`, `FIJO`, `VARIABLE` | `SUELDO`, `FIJO`, `VARIABLE` | Alineado directamente en `expense.types.ts` |
| Días de turno | `monday`, `tuesday`, … | `lunes`, `martes`, … | `shifts.api.ts` → `DIA_TO_WEEKDAY` / `WEEKDAY_TO_DIA` |
| Unwrap respuesta | `r.data` directo | `{ data, message, statusCode }` | `axiosInstance.ts` → interceptor response |

**Regla activa:** No tocar los tipos de las páginas. Cualquier ajuste de mapeo va en el archivo `/api/` correspondiente.

---

## Notas de Implementación Importantes

1. **useDashboard tiene mock data fallback** — si la API falla, muestra datos de demostración con badge "Datos de demostración".

2. **PermisosTab usa la API real** — carga `GET /permisos` (todos los roles) al montar. Toggle → `PATCH /permisos/:id`. Actualización optimista con rollback. Admin no es editable.

3. **solicitudesApi** — `create()` es **público** (no requiere JWT). `getAll()`, `aprobar()`, `rechazar()` requieren JWT de admin.

4. **ShiftDetailPage edición inline** — el estado `isEditingShift` (boolean) controla si el card hero muestra la info del turno o el formulario de edición. No hay tab "Editar" separada.

5. **PaymentsPage viewMode** — el estado `viewMode: 'list' | 'grid'` alterna la visualización de la lista de pagos. Las membresías siempre se muestran como grid de cards.

---

## Componentes UI — Contratos de Uso

```ts
Button:   variant: 'primary'|'secondary'|'danger'|'ghost', size: 'sm'|'md'|'lg', isLoading: boolean
Modal:    isOpen, onClose, title?, size?: 'sm'|'md'|'lg' — usa createPortal
Badge:    status: ClientStatus → getStatusColor/getStatusLabel automático
Input:    label, error, compatible con register() de RHF
Select:   label, error, compatible con register() de RHF
KpiCard:  label, value, icon, iconColor, iconBg, isLoading
Skeleton: className (height + rounded)
```

---

## Convenciones

- Componentes: `PascalCase` → `ClientCard.tsx`
- Hooks: `camelCase` con prefijo `use` → `useClients.ts`
- **Nunca** hacer axios directo dentro de un componente — siempre via `/api/[modulo].api.ts`
- Todo fetch → `isLoading` → mostrar `Skeleton` o `Spinner`
- Todo fetch → `error` → mostrar mensaje amigable con opción "Reintentar"
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

### Completado ✅
- Setup Vite + React + TailwindCSS + design system Eficiencia
- Layout (Navbar + SettingsDrawer) responsive
- LoginPage con Zod + conexión a API + formulario solicitud de acceso
- Rutas protegidas por auth y rol (PrivateRoute + RoleGuard)
- Todos los componentes UI base (`/components/ui/`)
- Todos los archivos API (`/api/`)
- Todos los hooks (`/hooks/`)
- Todos los tipos (`/types/`)
- ClientsPage, ClientProfilePage, ClientRutinaPage
- PaymentsPage, PaymentDetailPage, ShiftsPage, ShiftDetailPage
- AttendancePage, CalendarPage, ExpensesPage
- UsersPage (4 tabs: Usuarios / Profesores / Permisos API / Solicitudes)
- ScrollToTop global en navegación entre rutas

### Sesión 20/05/2026 — cambios aplicados ✅

**Membresías (Opción B — refactor completo):**
- `Modalidad` enum actualizado: `TRANSFERENCIA_MENSUAL | EFECTIVO | MEMBRESIA_3_MESES | MEMBRESIA_6_MESES`
- Nuevo `tarifas.api.ts`: `getAll`, `getMatriz`, `create`, `updatePrecio`
- `memberships.api.ts` sin `precioBase`, incluye `tarifas[]` en cada plan
- `membresiasCliente.api.ts` actualizado con nuevos valores de modalidad
- `membership.types.ts` reescrito: `Plan`, `TarifaVigente`, `Modalidad`, labels
- `PaymentsPage` — sección planes rediseñada: cards con tabla de 4 modalidades, edición de precio inline (formulario expandible dentro del mismo row), edición del plan inline dentro del card (AnimatePresence), selector visual de sesiones (botones 2× / 3× / Full), `PermissionGuard` gatea botones con `can()`
- Ruta `/memberships` eliminada — todo el CRUD de planes vive en `/payments`

**Dashboard rediseñado (5 secciones):**
- **KPIs**: 4 cards (clientes activos, ingresos, gastos, ganancia neta)
- **Alertas operativas**: clientes en deuda (clickeable → /clients), membresías por vencer en 7 días, membresías por vencer en 30 días
- **Financiero**: AreaChart ingresos vs gastos vs ganancia (6 meses) + BarChart por método de cobro
- **Clientes y planes**: DonutChart por estado + BarChart horizontal por plan + DonutChart gastos por categoría
- **Facturación**: progress bar animada facturado/sin facturar + resumen del período
- Skeleton completo que replica las 5 secciones con proporciones exactas
- `dashboard.api.ts` reescrito: solo 2 llamadas paralelas (antes hacía 8+). Usa `/dashboard/historico` en vez de 6 llamadas mensuales

**Sistema de permisos dinámicos:**
- `PermissionGuard` (nuevo): reemplaza `RoleGuard` hardcodeado. Cada ruta gateada por `can(module, 'read')` de la matriz dinámica
- `Layout.tsx`: refresh automático de permisos en mount + `window focus` — cambios del admin se propagan sin re-login
- `Navbar`: items visibles según `can(module, 'read')` en lugar de `adminOnly: boolean`
- `usePermissions`: sin cambios en la interfaz, ahora siempre tiene datos del servidor al mount
- Gates aplicadas en páginas: `ClientsPage` (create), `PaymentsPage` (create/delete pagos, create/update membresías), `ShiftsPage` (create/delete turnos)

**Responsive fix (patrón `base → lg: → xl:`):**
- Todos los h1: `text-2xl lg:text-3xl xl:text-4xl`
- Wrappers de página: `space-y-5 md:space-y-7 xl:space-y-10`
- KPI grids: `gap-2 md:gap-4 xl:gap-6`
- Cards: `rounded-2xl lg:rounded-[2rem]`, `p-4 lg:p-6 xl:p-8`
- Dashboard charts: `min-h` adaptativos (3 niveles)
- ShiftsPage calendar: `min-h-[72px] lg:min-h-[96px] xl:min-h-[120px]` por celda
- `space-y-6` → `space-y-4 lg:space-y-6` en ClientsPage, ExpensesPage, ShiftsPage, AttendancePage

### Pendiente ⚠️
- ⚠️ **Testear responsive en notebook 15"** — los fixes están aplicados pero no fueron verificados visualmente en una pantalla real de 1366×768 o similar. Hacer una pasada en el browser con DevTools → responsive mode antes de la reunión del 21/05
- ⚠️ **Testear sistema de permisos con usuarios reales** — crear un usuario STAFF y un PROFESOR, verificar que: (a) las rutas protegidas redirigen correctamente, (b) los botones de acción se ocultan/muestran según la matriz, (c) al modificar permisos en UsersPage el cambio se refleja sin re-login (window focus)
- Variables de entorno en Vercel (`VITE_API_URL` apuntando a Railway)
- Deploy en Vercel + `vercel.json` con rewrite SPA

---

## Reuniones con el Cliente

| Fecha | Reunión | Estado |
|-------|---------|--------|
| 01/05 | #1 — Layout, login, navegación, design system | ✅ Realizada |
| 07/05 | #2 — Módulo Clientes completo | ✅ Realizada |
| 14/05 | #3 — Sistema operativo completo | ✅ Realizada |
| 21/05 | #4 — Demo final: plataforma integrada + dashboard + flujos admin | Pendiente |
| 28/05 | Entrega — Deploy producción + capacitación Gonzalo | Pendiente |
