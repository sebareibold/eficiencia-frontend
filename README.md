# Eficiencia Frontend

Interfaz web para el sistema de gestión del gimnasio **Eficiencia**.
Consume la API REST del repo `eficiencia-backend`.

---

## Tecnologías

| Herramienta | Versión | Rol |
|---|---|---|
| **React** | 18 | Framework UI — componentes funcionales + hooks |
| **Vite** | latest | Bundler y servidor de desarrollo |
| **TypeScript** | 5 | Tipado estricto (`strict: true`) |
| **TailwindCSS** | 3 | Estilos utility-first, dark mode por clase `.dark` en `<html>` |
| **React Router** | v6 | Ruteo declarativo con guards por auth y rol |
| **Zustand** | latest | Estado global: auth, UI (toasts), preferencias |
| **Axios** | latest | HTTP client con interceptores automáticos para JWT y refresh |
| **React Hook Form + Zod** | 7 / latest | Formularios con validación de esquemas |
| **Recharts** | 2 | Gráficos (AreaChart, BarChart, LineChart, PieChart) en el Dashboard |
| **Framer Motion** | 12 | Animaciones de entrada y transición de páginas |
| **Lucide React** | latest | Librería de íconos SVG |
| **date-fns** | 4 | Formateo y manipulación de fechas |

---

## Módulos implementados

| Página | Ruta | Acceso |
|---|---|---|
| Login + Solicitar acceso | `/login` | Público |
| Clientes | `/clients` | Admin + Staff |
| Perfil de cliente | `/clients/:id` | Admin + Staff |
| Rutina del cliente | `/clients/:id/rutina` | Admin + Staff |
| Pagos | `/payments` | Admin + Staff |
| Detalle de pago | `/payments/:id` | Admin + Staff |
| Turnos | `/shifts` | Admin + Staff |
| Detalle de turno | `/shifts/:id` | Admin + Staff |
| Asistencia | `/attendance` | Admin + Staff + Profesor |
| Calendario | `/calendar` | Admin + Staff + Profesor |
| Ejercicios | `/exercises` | Admin + Staff |
| Gastos | `/expenses` | Solo Admin |
| Dashboard | `/dashboard` | Solo Admin |
| Usuarios | `/usuarios` | Solo Admin |
| Configuración | `/settings` | Admin |

---

## Autenticación y seguridad

- `accessToken` almacenado solo en memoria (Zustand) — **no persiste en localStorage**, protección contra XSS
- `refreshToken` en Zustand con persistencia en localStorage
- Axios interceptor de request: añade `Authorization: Bearer <token>` automáticamente
- Axios interceptor de response: si 401 → intenta `POST /auth/refresh` → si falla, logout + redirect `/login`
- Logout llama a `POST /auth/logout` para invalidar tokens en el servidor antes de limpiar el store
- Session timeout de 30 minutos de inactividad
- Permisos dinámicos: la matriz RBAC se carga desde la API al montar y se refresca cada 5 minutos y en foco de ventana, sin necesidad de re-login

---

## Design System

- **Color primario:** `#FBC608` (amarillo Eficiencia, confirmado por el cliente)
- **Modo oscuro** (predominante): fondo `#0F0F0F`, surfaces `#1A1A1A`
- **Glassmorphism** en cards y modals: `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(12px)`
- **Modo claro SaaS**: fondo `#F5F4F2` (warm off-white), cards blancas con borde `#E5E3DF`
- Animaciones de entrada con Framer Motion en todas las páginas

---

## Comandos

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run build        # build de producción
npm run preview      # preview del build de producción
```

---

## Variables de entorno

```env
VITE_API_URL=http://localhost:3000
```

---

## Deploy en Vercel

1. Conectar el repo en Vercel
2. Agregar variable de entorno `VITE_API_URL` apuntando al backend en Railway
3. El archivo `vercel.json` en la raíz ya tiene el rewrite SPA configurado
