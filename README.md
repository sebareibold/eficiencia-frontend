# Eficiencia Frontend

Interfaz web para el sistema de gestión del gimnasio **Eficiencia**.

---

## Tecnologías

| Herramienta | Versión | Rol |
|---|---|---|
| **React** | 18 | Framework UI — componentes funcionales + hooks |
| **Vite** | latest | Bundler y servidor de desarrollo |
| **TypeScript** | 5 | Tipado estricto en toda la codebase |
| **TailwindCSS** | 3 | Estilos utility-first, dark mode por clase `.dark` en `<html>` |
| **React Router** | v6 | Ruteo declarativo con rutas protegidas (guards) |
| **Zustand** | latest | Estado global: auth, UI (toasts), preferencias de usuario |
| **Axios** | latest | HTTP client con interceptores automáticos para JWT y refresh |
| **React Hook Form** | 7 | Formularios de alto rendimiento |
| **Zod** | latest | Validación de esquemas en formularios |
| **Recharts** | 2 | Gráficos (BarChart, LineChart) en el Dashboard |
| **Framer Motion** | 12 | Animaciones de entrada y transición de páginas |
| **Lucide React** | latest | Librería de íconos SVG |
| **date-fns** | 4 | Formateo y manipulación de fechas |

---

## Qué está construido

Sistema de gestión completo para gimnasio con las siguientes secciones:

### Módulos implementados

**Clientes** (`/clients`)
- Tabla con búsqueda por nombre/DNI y filtros por estado (Activo, Vencido, En deuda)
- Perfil individual con historial de pagos y asistencia
- Modal para crear/editar cliente

**Pagos** (`/payments`)
- Resumen mensual de ingresos por método de pago
- Tabla filtrable por mes, cliente y método
- Registro de nuevos pagos con marcado de facturación

**Turnos** (`/shifts`)
- Grid de cards con ocupación en tiempo real (inscriptos/cupo)
- Filtros por sala y día de la semana
- Modal para crear turnos

**Asistencia** (`/attendance`)
- Selector de turno + fecha
- Checklist de clientes inscriptos para marcar presentes
- Guardado masivo (bulk save)

**Calendario** (`/calendar`)
- Vista semanal Lunes–Sábado con los turnos de la semana
- Navegación entre semanas
- Modal de detalle al clickear un turno

**Gastos** (`/expenses`, solo admin)
- Resumen mensual por categoría
- CRUD completo de gastos
- Filtros por categoría y mes

**Dashboard** (`/dashboard`, solo admin)
- KPIs: ingresos, gastos, ganancia neta, clientes activos — con comparativa al mes anterior
- Gráfico de barras por método de pago
- Gráfico de líneas histórico de ingresos vs gastos

### Sistema de autenticación

- Login con JWT — `accessToken` (15m) + `refreshToken` (7d)
- Renovación automática de token al recibir 401
- Guards por autenticación (`PrivateRoute`) y por rol (`RoleGuard`)
- Roles: `admin` (acceso total) y `staff` (sin gastos ni dashboard)

### Design System

- **Modo oscuro** como modo principal: fondo `#0F0F0F`, surfaces `#1A1A1A`, accent naranja `#F5A623` configurable
- **Modo claro SaaS**: fondo warm off-white `#F5F4F2` con dot grid, cards blancas
- Glassmorphism en cards y modals del modo oscuro
- Color primario del gimnasio: amarillo `#FBC608`
- Animaciones de entrada con Framer Motion en todas las páginas

---

## Comandos

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run build        # build de producción
npm run preview      # preview del build
```

---

## Variables de entorno

```env
# .env.example
VITE_API_URL=http://localhost:3000
```

---

## Deploy

La app se despliega en **Vercel**. Requiere configurar `VITE_API_URL` apuntando al backend en Railway.
