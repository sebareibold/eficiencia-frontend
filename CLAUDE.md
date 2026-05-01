# CLAUDE.md — eficiencia-frontend
> Tenes que hablar en español
> Contexto para Claude Code. Leé esto antes de tocar cualquier archivo del frontend.

---

## 📌 Contexto del Proyecto

App web para la gestión integral del gimnasio **Eficiencia** (cliente: Gonzalo).
El frontend consume una API REST provista por el repo `eficiencia-backend`.

- **Repo:** `eficiencia-frontend`
- **Entrega:** 28/05/2026

> ⚠️ La app **registra** pagos (quién pagó, cuánto, cómo). No procesa cobros online. Sin MercadoPago, sin Stripe.

---

## 🛠️ Stack

| Herramienta | Uso |
|---|---|
| React 18 + Vite | Framework + bundler |
| TailwindCSS | Estilos (utility-first, sin CSS custom) |
| React Router v6 | Ruteo con rutas protegidas |
| Zustand | Estado global (auth, UI) |
| Axios | HTTP client con interceptores JWT |
| React Hook Form + Zod | Formularios y validaciones |
| Recharts | Gráficos del Dashboard |
| Lucide React | Íconos |
| date-fns | Manejo de fechas |

---

## 📁 Estructura de Carpetas

```
eficiencia-frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── axiosInstance.ts       # baseURL, interceptores JWT, refresh
│   │   ├── auth.api.ts
│   │   ├── clients.api.ts
│   │   ├── payments.api.ts
│   │   ├── shifts.api.ts
│   │   ├── attendance.api.ts
│   │   ├── expenses.api.ts
│   │   └── dashboard.api.ts
│   ├── components/
│   │   ├── ui/                    # Componentes genéricos reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Navbar.tsx
│   │   ├── clients/
│   │   ├── payments/
│   │   ├── shifts/
│   │   ├── attendance/
│   │   ├── calendar/
│   │   ├── expenses/
│   │   └── dashboard/
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── ClientsPage.tsx
│   │   ├── ClientProfilePage.tsx
│   │   ├── PaymentsPage.tsx
│   │   ├── ShiftsPage.tsx
│   │   ├── AttendancePage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── ExpensesPage.tsx       # Solo Admin
│   │   └── DashboardPage.tsx      # Solo Admin
│   ├── store/
│   │   ├── authStore.ts           # user, token, role, login, logout
│   │   └── uiStore.ts             # sidebar, toasts
│   ├── hooks/
│   │   ├── useClients.ts
│   │   ├── usePayments.ts
│   │   ├── useShifts.ts
│   │   ├── useAttendance.ts
│   │   └── useDashboard.ts
│   ├── guards/
│   │   ├── PrivateRoute.tsx       # Redirige a /login si no hay token
│   │   └── RoleGuard.tsx          # Redirige si el rol no tiene acceso
│   ├── types/
│   │   ├── client.types.ts
│   │   ├── payment.types.ts
│   │   ├── shift.types.ts
│   │   ├── attendance.types.ts
│   │   ├── expense.types.ts
│   │   └── auth.types.ts
│   ├── utils/
│   │   ├── formatDate.ts
│   │   ├── formatCurrency.ts      # Pesos argentinos
│   │   └── getStatusColor.ts      # Clase Tailwind por status
│   ├── constants/
│   │   ├── clientStatus.ts
│   │   └── routes.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                  # Solo @tailwind directives
├── .env
├── .env.example
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## 🗺️ Rutas

```
/login                  → LoginPage          (pública)
/                       → redirect → /clients
/clients                → ClientsPage        (admin + staff)
/clients/:id            → ClientProfilePage  (admin + staff)
/payments               → PaymentsPage       (admin + staff)
/shifts                 → ShiftsPage         (admin + staff)
/attendance             → AttendancePage     (admin + staff)
/calendar               → CalendarPage       (admin + staff)
/expenses               → ExpensesPage       (solo admin)
/dashboard              → DashboardPage      (solo admin)
```

---

## 🎨 Design System

### Paleta de colores — Eficiencia

```
Primary:        #F5A623   naranja Eficiencia
Primary Dark:   #D4880A
Background:     #0F0F0F   negro profundo
Surface:        #1A1A1A   cards, sidebar
Border:         #2A2A2A
Text:           #FFFFFF
Text Muted:     #9CA3AF
```

Definir en `tailwind.config.ts`:
```ts
theme: {
  extend: {
    colors: {
      primary: '#F5A623',
      'primary-dark': '#D4880A',
      surface: '#1A1A1A',
      'custom-border': '#2A2A2A',
    }
  }
}
```

### Estados de clientes

| Estado | Color | Clase Tailwind |
|--------|-------|----------------|
| `active` | Verde | `bg-green-500` |
| `expiring` | Amarillo | `bg-yellow-400` |
| `debt` | Rojo | `bg-red-500` |
| `inactive` | Gris | `bg-gray-500` |

Centralizar en `utils/getStatusColor.ts`. No hardcodear colores en componentes.

### Componentes UI base — reglas

- `Button`: variants `primary | secondary | danger | ghost`, prop `isLoading`
- `Input`: siempre con `label` y mensaje de `error`, controlado con React Hook Form
- `Badge`: recibe `status` y devuelve color correcto automáticamente
- `Modal`: usa `createPortal` para renderizar fuera del DOM del componente
- `Table`: columnas configurables, soporte sort y paginación
- `Spinner` / `Skeleton`: obligatorio en todo estado de carga

---

## 🔐 Autenticación y Guards

- Al login exitoso guardar `accessToken` y `refreshToken` en `authStore`
- Axios interceptor de request: agregar `Authorization: Bearer <token>`
- Axios interceptor de response: si `401` → intentar refresh → si falla, logout y redirigir a `/login`
- `PrivateRoute` verifica token antes de renderizar
- `RoleGuard` verifica `user.role === 'admin'` para rutas restringidas

```ts
// axiosInstance.ts — estructura base
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL })

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

---

## 📐 Convenciones

### Nombrado
- Componentes: `PascalCase` → `ClientCard.tsx`
- Hooks: `camelCase` con prefijo `use` → `useClients.ts`
- Constantes: `UPPER_SNAKE_CASE`
- Archivos de tipos: `*.types.ts`

### Llamadas HTTP
- **Nunca** hacer axios directo dentro de un componente
- Toda llamada va en `/api/[modulo].api.ts`
- Los hooks en `/hooks/` consumen `/api/` y manejan `loading`, `error`, `data`

### Formularios
- Siempre con `React Hook Form` + validación `Zod`
- Mostrar errores inline bajo cada campo

### Estados de carga y error
- Todo fetch → `isLoading` → mostrar `Skeleton` o `Spinner`
- Todo fetch → `error` → mostrar mensaje amigable, no crashear
- Acciones (crear, editar, eliminar) → `Toast` de éxito o error

### TypeScript
- `strict: true` en `tsconfig.json`
- Prohibido usar `any`. Si es inevitable, comentar el motivo
- Tipar todas las respuestas de API con interfaces en `/types/`

---

## 🌐 Variables de Entorno

```env
# .env.example (commitear esto, nunca el .env real)
VITE_API_URL=
```

```env
# .env local
VITE_API_URL=http://localhost:3000
```

---

## 📋 Checklist por Fase

### Fase 1 — Setup
- [ ] Init Vite + React + TailwindCSS
- [ ] Colores Eficiencia en `tailwind.config.ts`
- [ ] Instalar: zustand, axios, react-router-dom, react-hook-form, zod, recharts, lucide-react, date-fns
- [ ] Estructura de carpetas
- [ ] Layout (Sidebar + Navbar) responsive
- [ ] Login page conectada a API
- [ ] Rutas protegidas por auth y rol
- [ ] Componentes UI base

### Fase 2 — Clientes
- [ ] `clients.api.ts` con GET, POST, PATCH, DELETE
- [ ] `useClients.ts`
- [ ] `ClientsPage`: listado con búsqueda y filtro por estado
- [ ] `ClientProfilePage`: turnos, historial pagos, botón WhatsApp
- [ ] Formulario alta/edición con validaciones Zod
- [ ] Badge de estado con colores

### Fase 3 — Pagos
- [ ] `payments.api.ts`
- [ ] `PaymentsPage`: resumen del mes + listado con filtros
- [ ] Registrar pago desde perfil de cliente
- [ ] Toggle "Facturado" (para ARCA)
- [ ] Alertas visuales de vencimiento y deuda

### Fase 4 — Turnos y Asistencia
- [ ] `ShiftsPage`: listado con ocupación (`4/10`)
- [ ] Crear/editar turno (sala, día, hora, cupo)
- [ ] `AttendancePage`: selector turno/fecha + checkboxes de presentes
- [ ] Historial de asistencia en perfil del cliente

### Fase 5 — Calendario
- [ ] Vista semanal con columnas por día
- [ ] Bloques de turno con sala, hora, cantidad/nombres
- [ ] Colores por estado del cliente en cada bloque
- [ ] Actualización reactiva al modificar turnos o clientes

### Fase 6 — Gastos y Dashboard
- [ ] `ExpensesPage`: CRUD con filtro por categoría y mes
- [ ] `DashboardPage`: tarjetas (ingresos, gastos, ganancia neta, clientes activos)
- [ ] Gráfico línea: evolución ingresos por mes
- [ ] Comparación entre dos períodos
- [ ] Desglose por método de pago

### Fase 7 — Deploy
- [ ] Build sin errores
- [ ] Variables de entorno en Vercel
- [ ] Deploy en Vercel
- [ ] Verificar conexión con backend en producción

---

## 📅 Demos

| Fecha | Demo | Qué mostrar |
|-------|------|-------------|
| 01/05 | #1 | Layout, login, navegación, design system |
| 07/05 | #2 | Módulo Clientes completo |
| 14/05 | #3 | Pagos + Turnos + Asistencia |
| 21/05 | #4 | Calendario + Gastos + Dashboard |
| 28/05 | Entrega | Todo en producción + capacitación |