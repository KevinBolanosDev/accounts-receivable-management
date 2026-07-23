@AGENTS.md

# CLAUDE.md — Frontend (apps/web)

Next.js 16 + App Router + FSD. Este archivo documenta la estructura, patrones y decisiones del frontend. Lo específico del backend vive en `../../CLAUDE.md`.

## Stack

- **Next 16** (App Router, Turbopack default)
- **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind v4** (CSS-first; tokens en `app/globals.css`, **no hay `tailwind.config.ts`**)
- **shadcn/ui** (variantes locales en `shared/ui/`, config `style: new-york`, `baseColor: zinc`)
- **TanStack Query v5** (server state) + **Zustand** (client state, solo sesión)
- **Zod** (validación en cliente, schemas de `@repo/types`)
- **GSAP** + `@gsap/react` (animaciones; registrado una vez en `shared/lib/motion/gsap.ts`)
- **lucide-react** (iconos) + SVG custom para WhatsApp

Sin SWR, sin Redux, sin Emotion, sin Storybook.

## Estructura FSD

```
apps/web/src/
├── app/                  ← Rutas Next.js (App Router). Solo composición.
│   ├── (admin)/          ← route group: dark mode + RouteGuard ADMIN
│   ├── (collector)/      ← route group: light mode + RouteGuard COBRADOR
│   ├── (client)/         ← route group: light mode, placeholder
│   ├── dev/              ← galería de componentes (dev only)
│   ├── layout.tsx        ← root layout (Inter, Toaster, TooltipProvider, Providers)
│   ├── providers.tsx     ← QueryClientProvider (lazy en useState)
│   ├── globals.css       ← tokens + tipografía + dark mode
│   └── page.tsx          ← / → HealthStatus
├── widgets/              ← Bloques compuestos (shells, login, health-status)
│   ├── admin-shell/      ← sidebar + topbar + sheet móvil + nav-items
│   ├── collector-shell/  ← bottom tab bar + hero
│   ├── login/            ← AdminLoginScreen, CollectorLoginScreen, BrandLogo
│   └── health-status/    ← fetch /health (esquiva la api tipada, único caso)
├── features/             ← Acciones de usuario (7 features con api/ + ui/)
│   ├── auth/             ← login, RouteGuard, LogoutButton
│   ├── clients/          ← CRUD + upload foto doc + alta en campo
│   ├── cobros/           ← registrar cobro + ruta de hoy del cobrador
│   ├── collectors/       ← gestión de cobradores (admin)
│   ├── creditos/         ← crear/editar/anular crédito
│   ├── productos/        ← CRUD de productos (alimenta creditos)
│   └── routes-collectors/← CRUD de rutas + asignar/desasignar clientes
├── entities/             ← Modelos de dominio UI
│   ├── client/           ← ClientCard + lib estado
│   ├── credit/           ← CreditCard + lib progress + cálculo
│   └── session/          ← Zustand useSessionStore (único store)
├── shared/               ← Base agnóstica de dominio
│   ├── api/              ← apiFetch, uploadFile, ApiError, authHeaders
│   ├── lib/              ← format-currency, initials, utils (cn), motion/*
│   └── ui/               ← 23 primitivos shadcn + icons/
└── pages-fsd/            ← VACÍO (placeholder; FSD "pages" no aplica con App Router)
```

**Regla de capas (FSD):** una capa solo importa de capas inferiores.
`app` puede usar `widgets`/`features`/`entities`/`shared`. `widgets` puede usar `features`/`entities`/`shared`. `features` puede usar `entities`/`shared`. `entities` solo `shared`. `shared` no importa nada.

**Regla transversal:** **no acoplamiento horizontal entre features**. `clients` no importa nada de `cobros` ni viceversa. Lo compartido va a `entities/` (modelos), `shared/` (utilidades) o `@repo/types` (contratos).

## Patrones por feature

Todos los features siguen la misma forma:

```
features/<name>/
├── index.ts                ← barrel (exporta ui/* y a veces api)
├── api/
│   ├── <name>-service.ts   ← interface XxxService + mockXxxService + httpXxxService + swap
│   └── use-<name>.ts       ← hooks TanStack Query (queryKeys jerárquico + useMutation)
└── ui/                     ← componentes "use client" (pantallas y sub-componentes)
```

### Patrón "interfaz + mock + http" (punto único de inyección)

```ts
// features/<name>/api/<name>-service.ts
export interface XxxService {
  method(arg: Type): Promise<ResultType>;
}

export const mockXxxService: XxxService = { /* in-memory */ };

export const httpXxxService: XxxService = {
  method: (arg) => apiFetch("/path", resultSchema, { method: "POST", body: arg, token }),
};

// Único punto de cambio (swap mock→real):
export const xxxService: XxxService = httpXxxService;
```

Estado actual (todos los `xxxService = httpXxxService`): `auth`, `clientes`, `cobros`, `collectors` (cobradores), `creditos`, `productos`, `routes-collectors` (rutas). Los mocks siguen implementados — revertir es cambiar una constante.

`cobros` es especial: `mockCobrosService.registrarCobro` **solo lanza errores** (caso `monto===999999` falla simulada, resto "no implementa backend fake"). Sirve solo para validar el camino de error; los hooks de lectura del cobrador reusan los hooks reales de `routes-collectors`/`clients`.

### Hooks TanStack Query por feature

Cada feature define `queryKeys` jerárquico:

```ts
export const xxxKeys = {
  all: ["xxx"],
  list: (q?: Query) => [...xxxKeys.all, "list", q],
  detail: (id: string) => [...xxxKeys.all, "detail", id],
};
```

Las mutaciones invalidan con `queryClient.invalidateQueries({ queryKey: xxxKeys.all })`. Sin `defaultOptions` globales (defaults v5). Sin optimistic updates.

## Cliente API (`shared/api/client.ts`)

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const apiUrl = (path: string) => `${API_URL}${path}`;
const authHeaders = (token?: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : {};

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function apiFetch<T>(path, schema, { method?, body?, token?, headers? }): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: method ?? "GET",
    headers: { "Content-Type": "application/json", ...authHeaders(token), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toApiError(res, path);   // lee json.message del Nest o fallback
  return schema.parse(await res.json());            // Zod parse con schema de @repo/types
}

async function uploadFile<T>(path, schema, { file, fieldName="file", fields?, token? }): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  Object.entries(fields ?? {}).forEach(([k, v]) => fd.append(k, String(v)));
  // (sin Content-Type — el navegador pone el boundary)
}
```

**Decisiones clave:**
- **Token explícito por llamada** (no interceptor). Razón: `shared` no puede importar de `entities/session` (rompe FSD). Quien llama lee `useSessionStore.getState().token`.
- **Validación Zod con el MISMO schema del backend**. Errores de shape → `ZodError` propagado.
- **No maneja 401/403** automáticamente. `useValidateSession` los detecta vía `useQuery.isError` y limpia la sesión.

## Estado de sesión (Zustand)

`entities/session/model/session-store.ts`:

```ts
interface SessionState {
  token: string | null;
  usuario: Usuario | null;          // tipo @repo/types
  isAuthenticated: boolean;
  hasHydrated: boolean;             // false hasta que persist termina (evita redirect SSR)
  setSession(s: LoginResponse): void;
  clearSession(): void;
  setHasHydrated(v: boolean): void;
}
```

Persistencia: `persist(..., { name: "session-storage", onRehydrateStorage: () => state => state?.setHasHydrated(true) })`. Selectores siempre parciales (`useSessionStore(s => s.token)`) para minimizar renders.

**`RouteGuard`** (`features/auth/ui/RouteGuard.tsx`): server-component-friendly, espera `hasHydrated`, redirige a `loginPath` si no autenticado o si rol no está en `allowedRoles`.

## Design system

Tokens en `app/globals.css`:
- `:root` (HSL triplets shadcn) + `.dark` (overrides)
- `@theme inline` mapea a `--color-*` y tipografía
- `@custom-variant dark (&:where(.dark, .dark *))` — dark por clase ancestro
- Radios: `--radius-sm 8px · md 12px · lg 14px (--radius) · xl 20px`
- Tipografía: `--text-display/h1/h2/h3/body/body-sm/caption/amount`
- `tabular-nums` para todo monto en pantalla

**Modo por superficie (DESIGN_SYSTEM §0):** Admin=dark, Cobrador/Cliente=light. Aplicado a nivel de layout del route-group (`className="dark"` solo en `(admin)/layout.tsx:6`). Sin FOUC, sin JS para el default.

**Primitivos en `shared/ui/`** (23): avatar, badge (cva con status variant), button (cva con variant+size+loading+asChild), card, command (cmdk), dialog, dropdown-menu, form (wrapper RHF), input, label, metric-card (cva tone), popover, progress-bar, progress-ring (32/64/120px, cambio cian→verde >90%), select, sheet (Radix), skeleton, sonner (Toaster), switch, table, tabs (variant underline), textarea, tooltip. **Sin Storybook**: la galería vive en `/dev/ui` (404 en producción).

**Animación con GSAP** (`shared/lib/motion/`):
- `gsap.ts` registra `useGSAP`, `ScrollTrigger`, `Flip` una sola vez
- Tokens: `micro 0.14s · base 0.28s · overlay 0.33s · hero 0.6s` + easings `power2/3.out`
- `useReducedMotion()` — todos los hooks lo consultan
- Hooks: `useReveal<T>` (fade+rise), `useStagger<T>` (lista), `useCountUp<T>` (monto animado), `animateProgressRing(scope, opts)` (función, no hook; se llama dentro de `useGSAP({scope})`)

## Formularios (RHF + Zod)

Patrón canónico (`features/clients/ui/ClientFormScreen.tsx`):

```ts
const form = useForm<CreateClienteRequest>({
  resolver: zodResolver(createClienteRequestSchema, undefined, { raw: true }) as never,
  //          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //          { raw: true } para NO stripear campos extra (ej: bloque crédito opcional)
  defaultValues: { ... },
  mode: "onBlur",
});

const onSubmit = form.handleSubmit(async (values) => {
  try {
    await mutateAsync(values);
    toast.success("...");
    router.push("...");
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Error inesperado");
  }
});
```

- Sin optimistic updates.
- Validación cruzada (campos opcionales que se vuelven requeridos condicionalmente) se hace manual con `form.setError(name, { type: "manual", message })`.
- Edición: `useEffect(() => form.reset(...), [isEdit, entity])`.

## Rutas (App Router)

| Path | Layout | Modo |
|---|---|---|
| `/` | raíz | claro |
| `/dev/ui` | raíz (404 en prod) | toggle manual |
| `/admin/login` | `(admin)` | oscuro |
| `/admin/(shell)/...` | `(admin)` + AdminShell | oscuro |
| `/collector/login` | `(collector)` | claro |
| `/collector/(shell)/...` | `(collector)` + CollectorShell | claro |
| `/client` | `(client)` | claro |

Las `page.tsx` son server components. Toda la lógica vive en features/widgets con `"use client"`. Pages dinámicas usan Next 16: `params: Promise<{ id: string }>` (se hace `await params`).

**Rutas del Admin implementadas:** `/admin`, `/admin/login`, `/admin/clients`, `/admin/clients/new`, `/admin/clients/[id]`, `/admin/clients/[id]/edit`, `/admin/collectors`, `/admin/credits/new`, `/admin/credits/[id]`, `/admin/credits/[id]/edit`, `/admin/routes-collectors`, `/admin/routes-collectors/new`, `/admin/routes-collectors/[id]`, `/admin/routes-collectors/[id]/edit`. Falta `credits/page.tsx` (placeholder) — `redirect("/admin/credits/new")`.

**Rutas del Cobrador implementadas:** `/collector`, `/collector/login`, `/collector/clients`, `/collector/clients/new`, `/collector/receipts` (placeholder Fase 4), `/collector/profile` (placeholder + Logout), `/collector/routes/[id]`, `/collector/routes/payments/[id]`.

**Rutas del Cliente:** `/client` (placeholder; feature vive en Fase 4).

## Decisiones y gotchas

- **`pages-fsd/`** está vacío (`.gitkeep`). FSD "pages" no se usa: el routing vive en `app/`. Si en el futuro se quiere respetar la nomenclatura FSD estricta, renombrar `app/` → `pages-fsd/`. Decisión pendiente.
- **Tailwind v4** sin `tailwind.config.ts`. Todo en CSS-first (`@theme inline`). Si necesitas un plugin custom, va en `globals.css` con `@plugin` o en `postcss.config.mjs`.
- **`widgets/health-status/HealthStatus.tsx`** es el único punto que **no** usa `apiFetch`: hace `fetch("/health")` directo porque el endpoint público no necesita auth ni schema tipado.
- **Mocks no se borran.** `mockXxxService` queda implementado para poder volver atrás en un click si el back se rompe.
- **`apiFetch` no maneja 401/403** automáticamente. Política: si la sesión expira, `useValidateSession` lo detecta y limpia; las queries activas fallan con `ApiError` y la UI decide qué hacer (mostrar toast, redirigir, etc.).
- **Decimales:** todo monto en pantalla va con `formatCurrency` (`Intl es-CO`, COP, 0 fracciones, `tabular-nums`). El cálculo de progreso del crédito está en `entities/credit/lib/credit-progress.ts`.
- **Sin SWR/React Query devtools** ni **sin Storybook**: la galería `/dev/ui` hace de ambos.

## Comandos

Ver `../../CLAUDE.md` §Commands. Los más usados:

```bash
pnpm --filter web dev              # next dev (3000)
pnpm --filter web build
pnpm --filter web typecheck
pnpm --filter web lint
```

No hay test runner configurado (decisión de Fase 6).
