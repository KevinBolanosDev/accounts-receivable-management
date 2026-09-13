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
│   ├── login/            ← AdminLoginScreen, CollectorLoginScreen, BrandLogo, SurfaceSwitchLink
│   └── health-status/    ← fetch /health (esquiva la api tipada, único caso)
├── features/             ← Acciones de usuario (con api/ + ui/; Fase 4 sumó client-auth/client-portal/receipts, Fase 5 sumó closures/dashboard)
│   ├── auth/             ← login, RouteGuard, LogoutButton
│   ├── clients/          ← CRUD + upload foto doc + alta en campo
│   ├── cobros/           ← registrar cobro + ruta de hoy del cobrador
│   ├── collectors/       ← gestión de cobradores (admin)
│   ├── creditos/         ← crear/editar/anular crédito
│   ├── productos/        ← CRUD de productos (alimenta creditos)
│   ├── routes-collectors/← CRUD de rutas + asignar/desasignar clientes
│   ├── closures/         ← Fase 5: preview/cerrar ruta (#19c), histórico (#12c), detalle (#13c), descarga de PDF
│   └── dashboard/        ← Fase 5: métricas del Admin (#2b) + WeeklyChart (recharts)
├── entities/             ← Modelos de dominio UI
│   ├── client/           ← ClientCard (API de slots) + ClientContactPanel + lib estado
│   ├── credit/           ← CreditCard (admin) + CreditSummaryCard (fila tappable) + lib progress/agregados/frecuencia
│   ├── payment/          ← PaymentRow/PaymentHistoryTable/PaymentHistory + cuota-estado + helpers de historial
│   ├── receipt/          ← ReceiptActions + useReceiptActions + fetchReceiptPdf + buildWhatsAppUrl
│   └── session/          ← Zustand useSessionStore + useClientSessionStore
├── shared/               ← Base agnóstica de dominio
│   ├── api/              ← apiFetch, uploadFile, ApiError, authHeaders
│   ├── lib/              ← format-currency, format-date, download-blob, initials, phone/*, utils (cn), motion/*
│   └── ui/               ← 26 primitivos shadcn + phone-input + icons/
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

Estado actual (todos los `xxxService = httpXxxService`): `auth`, `clientes`, `cobros`, `collectors` (cobradores), `creditos`, `productos`, `routes-collectors` (rutas), `client-auth`, `client-portal`, `receipts` (los 3 últimos, Fase 4). Los mocks siguen implementados — revertir es cambiar una constante.

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
- **`apiFetchVoid` para los 204.** Los DELETE del sistema (`/clients/:id`, `/clients/:id/access`, `/users/:id`, `/routes/:id`) responden **204 sin cuerpo**: `apiFetch` hacía `res.json()` incondicional y reventaba con un `SyntaxError` **después** de que el servidor ya había ejecutado la acción — el borrado ocurría pero la UI decía "no se pudo" y no invalidaba nada. `apiFetch` ahora **lanza un error nombrando `apiFetchVoid`** si recibe un 204, para que el mal uso se diagnostique al instante. Ojo: `DELETE /credits/:id` y `DELETE /routes/:id/clients/:clienteId` **sí devuelven body** y usan `apiFetch` normal — al agregar un DELETE, contrastar siempre contra el `@HttpCode` de su controller.
- **401 → cierra sesión, global.** `providers.tsx` registra `QueryCache`/`MutationCache` `onError`: ante un `ApiError` 401 limpia la sesión de la superficie activa (staff o cliente, por `pathname`) y no reintenta 4xx. `useValidateSession` sigue validando el token al montar, pero no basta por sí solo: `GET /auth/me` no valida el tenant, así que un token viejo pasaba esa comprobación y fallaba en todo lo demás.
- **Mostrar el error real.** En los `catch`, `error instanceof ApiError ? error.message : "<fallback>"`. Un `catch {}` ciego borra mensajes de negocio accionables (el 409 de "la ruta tiene N clientes asignados", el 409 de documento duplicado).

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

**`RouteGuard`** (`features/auth/ui/RouteGuard.tsx`): server-component-friendly, espera `hasHydrated`, redirige a `loginPath` si no autenticado o si rol no está en `allowedRoles`. En la propia ruta de login **solo** salta el formulario quien ya tiene sesión **con un rol válido para esa superficie** — si no, se muestra el login para poder cambiar de cuenta.

**Los dos logins de staff se enlazan entre sí** (`widgets/login/SurfaceSwitchLink`). Como cada uno acepta solo su rol, quien llegaba al equivocado escribía sus credenciales, recibía "esta cuenta no puede ingresar acá" y no tenía forma de cruzar salvo editando la URL.

**Cada login acepta solo SUS roles.** `LoginForm` recibe `allowedRoles` + `redirectTo`; si el backend autentica bien pero devuelve otro rol, **la sesión no se establece** y se muestra el error indicando dónde ingresar. Antes el formulario redirigía según el rol devuelto sin mirar la superficie: con credenciales de admin en `/collector/login` la sesión se abría igual y rebotaba a `/admin`. `POST /auth/login` sigue siendo agnóstico de superficie a propósito (un endpoint, el rol viaja en el JWT); quien decide qué rol acepta cada pantalla es el front.

## Design system

Tokens en `app/globals.css`:
- `:root` (HSL triplets shadcn) + `.dark` (overrides)
- `@theme inline` mapea a `--color-*` y tipografía
- `@custom-variant dark (&:where(.dark, .dark *))` — dark por clase ancestro
- Radios: `--radius-sm 8px · md 12px · lg 14px (--radius) · xl 20px`
- Tipografía: `--text-display/h1/h2/h3/body/body-sm/caption/amount`
- `tabular-nums` para todo monto en pantalla

**Modo por superficie + selector (DESIGN_SYSTEM §0, Fase 5.5):** los *defaults* siguen siendo Admin=dark, Cobrador/Cliente=light, pero Admin y Cobrador pueden cambiarlo (Claro/Oscuro/**Sistema**) y la preferencia se guarda **por superficie** (`theme:admin`, `theme:collector`). El Portal Cliente no tiene selector.

**La clase `dark` vive SOLO en `<html>`.** Antes había tres fuentes de verdad para el mismo booleano: el `className="dark"` del `(admin)/layout.tsx`, el `SurfaceMode` que replicaba la clase en `<html>` para los overlays de Radix (portalizados a `body`, leían `:root`), y el toggle propio de `/dev/ui`. `SurfaceMode` se borró; `<html>` es lo que ven tanto el árbol de la página como los portales.

```
shared/theme/
├── theme.ts          SURFACE_DEFAULTS · resolveSurface · resolveTheme · applyTheme (funciones puras)
├── theme-script.tsx  <script> inline en <head> — resuelve el modo ANTES del primer paint
├── theme-store.ts    useSyncExternalStore sobre localStorage + matchMedia
├── theme-sync.tsx    re-aplica en navegación soft / cambio de SO / otra pestaña
└── use-theme.ts      useTheme(): { surface, preference, resolved, canToggle, setPreference }
```

- **Sin FOUC:** el script inline lee `location.pathname` → superficie → `localStorage`, y escribe la clase durante el parseo del `<head>`. Patrón oficial de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`, §Themes) con `suppressHydrationWarning` en `<html>`. Un `useEffect` corre **después** del paint; `useLayoutEffect`, después de la hidratación — en conexión lenta el navegador ya pintó el HTML del servidor.
- **GOTCHA: el algoritmo está escrito dos veces.** En JS plano dentro del script (no puede importar: corre antes del bundle) y en `theme.ts` para React. Las **constantes** sí tienen una sola fuente — se interpolan desde `theme.ts`. Si tocás `resolveSurface` o `resolveTheme`, tocá también el string de `theme-script.tsx`.
- **`null` ≠ `"system"`.** Sin preferencia guardada manda el default de §0; `"system"` es una elección explícita de seguir al SO. Si `null` significara "system", el panel del Admin se abriría claro para cualquiera con el SO en claro.
- **`useSyncExternalStore` y no `zustand/persist`:** `persist` hidrata en un efecto y necesita `hasHydrated` (como los dos session stores) — justo el frame de retraso que se está evitando.
- **`resolveSurface(pathname)` es la única definición de "qué superficie es esta ruta"** y también la usa `providers.tsx` para decidir qué sesión limpiar ante un 401.
- **`<meta name="theme-color">`** se actualiza con el modo resuelto (barra del navegador en Android — importa para el Cobrador).
- **`.theme-switching`** (globals.css) congela las transiciones durante un frame al cambiar de modo; sin eso cada `transition-colors` interpola a su ritmo y se ve sucio.
- El selector es `shared/ui/theme-toggle.tsx`, montado en `UserMenu`, `AdminMoreSheet` y `/collector/profile`. Cambia con **revelado circular** (`document.startViewTransition`, sin el flag `experimental.viewTransition` de Next: es una mutación de DOM, no una navegación).
- `/dev/ui` cae en la superficie `"public"` (no themeable): conserva su switch local, pero pasa por `applyTheme`, el mismo punto único.

**Tokens `-strong` (Fase 5.5): `--X` para fondos y trazos, `--X-strong` para texto e íconos.** La paleta se había afinado mirando el Admin oscuro; en claro `text-accent`/`text-success`/`text-warning` daban 2.1–2.6:1 sobre el fondo real del badge. Como `Badge` pinta `bg-X/15 text-X` en sus seis estados, encender el modo claro sin esto habría hecho ilegible todo el sistema de estados. Ver `DESIGN_SYSTEM.md` §1.1 para los valores y los ratios medidos. Al escribir una pantalla nueva: si el tono es **texto**, `-strong`.

**Primitivos en `shared/ui/`**: alert-dialog, avatar, badge (cva con status variant), **brand-ring**, button (cva con variant+size+loading+asChild), card, command (cmdk), **confirm-dialog**, **count-up-value**, dialog, dropdown-menu, **empty-state**, **error-state** (`ErrorState` + `NotFoundState`), form (wrapper RHF), **inline-note**, input, label, metric-card (cva tone), popover, progress-bar, progress-ring (32/64/120px, cambio cian→verde >90%), select, sheet (Radix), skeleton, **skeletons** (composiciones), sonner (Toaster), **spinner**, switch, table, tabs (variant underline), textarea, **theme-toggle**, tooltip. **Sin Storybook**: la galería vive en `/dev/ui` (404 en producción) y **es** el criterio de aceptación — cada primitiva nueva se valida ahí en los dos modos.

**Kit de estados (Fase 5.5) — DESIGN_SYSTEM §2.9.** Antes había cuatro `EmptyState` locales con firmas distintas (`{text}` en tres, `{title, description}` en otro) y ~30 `<div border-dashed>` sueltos; ninguno aceptaba acción, así que la tercera parte de §2.9 no se cumplía en ninguna pantalla.

| Cuándo | Qué usar |
|---|---|
| No hay contenido todavía | `EmptyState` — `title` obligatorio, `action` con verbo. `size="inline"` dentro de una lista/pestaña |
| La petición falló | `ErrorState` con `onRetry` |
| La entidad no existe | `NotFoundState` con `backHref` |
| Aclarar un dato que puede malinterpretarse | `InlineNote` (`info`/`warning`/`success`) |
| Espera puntual (botón, bloque) | `Spinner`. Para una pantalla que carga, skeletons con la forma real |

**`ErrorState` ≠ `NotFoundState`, y es la regla que más importa del kit.** El patrón `isError || !entity → "no existe o fue eliminado"` que usaban casi todas las pantallas mezcla dos situaciones opuestas: la entidad no existe (nada que reintentar) versus la petición falló (la entidad puede existir perfectamente). Ese merge ya causó el bug documentado más abajo — un `ZodError` por un campo nuevo requerido se mostraba como "este cliente no existe". Dos componentes obligan a decidir cuál es cuál al escribir la pantalla.

**Boundaries de ruta (Fase 5.5).** Antes no existía **ninguno** en 37 páginas: una excepción no capturada tumbaba el árbol entero. Hoy hay `loading.tsx` + `error.tsx` + `not-found.tsx` en `(admin)/admin/(shell)` y `(collector)/collector/(shell)`, `loading.tsx` + `error.tsx` en `(client)`, y `not-found.tsx` + `global-error.tsx` en la raíz. `global-error.tsx` **no** usa primitivos de `shared/ui`: solo se dispara si falla el root layout, y `globals.css` se importa desde ahí — va con estilos en línea.

**Confirmaciones destructivas: siempre `ConfirmDialog`**, nunca un `<Dialog>` a mano (antes había tres copias divergentes). Va sobre `AlertDialog` de Radix por `role="alertdialog"` y foco inicial en Cancelar. La fricción se escala según el daño, no por defecto:

| Acción | Reversible | Confirmación |
|---|---|---|
| Eliminar cliente · Eliminar acceso al portal · Anular crédito | Sí, o auditable | `ConfirmDialog` simple |
| Eliminar cobrador | Parcial (el Switch revierte `activo`; la desasignación de rutas no) | `confirmPhrase={cobrador.documento}` |
| Eliminar ruta | **No — es el único borrado físico** | `confirmPhrase={ruta.nombre}` |

`confirmPhrase` obliga a escribir un identificador **corto y visible en pantalla**. Se descartaron los dos diálogos encadenados y el checkbox "entiendo": ambos se despachan por reflejo sin leer nada.

**Acciones de página: `widgets/admin-shell/PageActions`.** Se declaran como lista (`PageAction[]`) y el componente las pinta como botones en `md:` y como menú "…" (`DropdownMenu`) debajo. El detalle de cliente tenía tres botones `whitespace-nowrap shrink-0` en un header `h-16` sin wrap: pedía ~440px y desbordaba a toda la página en un teléfono de 360px. `AdminPageHeader` no cambió su API (`actions?: React.ReactNode`), así que solo lo usan las pantallas que lo necesitan.

**Animación con GSAP** (`shared/lib/motion/`):
- `gsap.ts` registra `useGSAP`, `ScrollTrigger`, `Flip` una sola vez
- Tokens: `micro 0.14s · base 0.28s · overlay 0.33s · hero 0.6s` + easings `power2/3.out`
- `useReducedMotion()` — todos los hooks lo consultan
- Hooks: `useReveal<T>` (fade+rise), `useStagger<T>` (lista), `useCountUp<T>` (monto animado), `animateProgressRing(scope, opts)` (función, no hook; se llama dentro de `useGSAP({scope})`)
- **Fase 5.5:** `useProgressRing(value)` (envuelve la ceremonia de `animateProgressRing`), `PRESS_SCALE` (constante de clases), `PageTransition` (para `template.tsx`), y `CountUpValue` en `shared/ui`

**El anillo avanza, no se redibuja — es el momento de firma del producto.** `useProgressRing(value)` dibuja de 0 al valor en el primer montaje y, cuando el valor **cambia**, anima desde el anterior. En `ClientPaymentsScreen`, registrar un cobro invalida la query, `porcentajePagado` sube y el cobrador ve crecer exactamente lo que acaba de hacer. `animateProgressRing` existía desde la Fase 0.5 pero **solo lo usaba `/dev/ui`**: ninguna pantalla real animaba el elemento de firma.

**El skeleton usa `.skeleton-shimmer`, no `animate-pulse`.** Barrido diagonal con el gradiente índigo→cian del hero, definido en `globals.css`. Es CSS y no GSAP a propósito: hay decenas de skeletons en pantalla a la vez y montar un timeline por cada uno sería caro para algo decorativo. El gate de `prefers-reduced-motion` vive en el CSS.

**GOTCHA de `PageTransition`: `clearProps` no es opcional.** `gsap.from` deja el `transform` inline puesto al terminar, y **un ancestro con `transform` deja de ser el viewport para sus descendientes `position: fixed`** — pasan a posicionarse contra ese ancestro. `ClientsListScreen`, `CollectorsScreen` y `RoutesListScreen` montan su FAB móvil con `className="fixed right-4 ..."` DENTRO del contenido de la página, así que sin `clearProps` el botón dejaría de estar fijo y scrollearía con la lista. Por eso `PageTransition` corre su propio tween en vez de usar `useReveal` tal cual. Si agregás otro wrapper animado por encima de contenido de página, mismo cuidado.

**`template.tsx` va DENTRO del route-group `(shell)`.** Next re-monta el template en cada navegación (eso es lo que permite animar la entrada); si envolviera al shell, el sidebar y la tab bar parpadearían en cada click.

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

**Formularios de edición: gate + `key`, nunca `reset()` dentro de un `useEffect`.**

1. El contenedor espera a que **todas** las queries que alimentan los valores iniciales estén resueltas (Skeleton mientras).
2. Entidad inexistente → estado vacío con salida, jamás Skeleton eterno.
3. El cuerpo recibe los datos ya resueltos, calcula `defaultValues` una sola vez y se monta con `key={entity?.id ?? "new"}`.
4. `reset()` queda reservado para acciones explícitas del usuario.

```tsx
if (isEdit && (loadingEntity || loadingDeps)) return <FormSkeleton />;
if (isEdit && (isError || !entity))          return <NotFound />;
return <FormBody key={entity?.id ?? "new"} entity={entity ?? null} deps={deps} />;
```

Razón: TanStack devuelve una **referencia nueva** en cada refetch y `refetchOnWindowFocus` está activo, así que un `reset` en efecto se re-dispara y **pisa lo que el usuario está escribiendo**. Y si el reset corre antes de que lleguen las opciones de un `<Select>`, Radix pinta el placeholder aunque el valor esté puesto (era el "no precarga la ruta al editar").

Implementado en `ClientFormScreen` y `CollectorDialog` (form montado solo con el diálogo abierto). **Excepción documentada:** `RouteFormScreen` conserva el efecto pero depende de `ruta?.id`, no del objeto — ahí `ruta` también alimenta métricas y la lista de clientes asignados, que **sí** deben re-renderizar con cada mutación.

## Rutas (App Router)

| Path | Layout | Modo |
|---|---|---|
| `/` | raíz | claro |
| `/dev/ui` | raíz (404 en prod) | toggle manual de previsualización |
| `/admin/login` | `(admin)` | oscuro **por defecto**, elegible |
| `/admin/(shell)/...` | `(admin)` + AdminShell + template | oscuro **por defecto**, elegible |
| `/collector/login` | `(collector)` | claro **por defecto**, elegible |
| `/collector/(shell)/...` | `(collector)` + CollectorShell + template | claro **por defecto**, elegible |
| `/client` | `(client)` | claro (fijo, sin selector) |

"Elegible" = el usuario puede pasar a Claro/Oscuro/Sistema desde su superficie y la preferencia se guarda aparte para cada una (ver §Design system).

Las `page.tsx` son server components. Toda la lógica vive en features/widgets con `"use client"`. Pages dinámicas usan Next 16: `params: Promise<{ id: string }>` (se hace `await params`).

**Rutas del Admin implementadas:** `/admin` (dashboard, Fase 5), `/admin/login`, `/admin/clients`, `/admin/clients/new`, `/admin/clients/[id]`, `/admin/clients/[id]/edit`, `/admin/collectors`, `/admin/credits/new`, `/admin/credits/[id]`, `/admin/credits/[id]/edit`, `/admin/routes-collectors`, `/admin/routes-collectors/new`, `/admin/routes-collectors/[id]`, `/admin/routes-collectors/[id]/edit`, `/admin/routes-collectors/[id]/close` (cierre de ruta, post-Fase-5, `AdminCloseRouteScreen` — el backend ya lo permitía desde 5.7, faltaba la pantalla), `/admin/routes-collectors/[id]/clients/[clienteId]` (+ `?tab=historial`), `/admin/routes-collectors/[id]/clients/[clienteId]/credits/[creditoId]`, `/admin/receipts/[pagoId]`, `/admin/closures` (histórico de cierres, Fase 5), `/admin/closures/[id]` (detalle, snapshot congelado). Falta `credits/page.tsx` (placeholder) — `redirect("/admin/credits/new")`.

**Flujo de cobro del Admin (el admin tiene acceso total, también cobra).** `/admin/routes-collectors` separa **"Mis rutas"** (`cobradorId === null` — las cobra el admin) de **"Rutas de cobradores"**, con un solo `GET /routes` y el filtro en el cliente: no hay columna nueva en la BD. Desde el detalle de la ruta, un cliente **ya no abre su ficha** (`/admin/clients/[id]`) sino sus créditos (`AdminClientCreditsScreen`, dos pestañas Activos/Historial), y de ahí al crédito (`AdminCreditCollectScreen`: pagos, cuotas vencidas/mora y registrar cobro). La ficha completa queda en las acciones del header. Las dos pantallas son **espejos** de las del Cobrador (mismos componentes de `entities/`, mismo `scope: "staff"` del recibo) en la superficie del Admin — si tocas una, revisá la otra.

**`RegistrarCobroSheet` recibe `receiptBasePath`.** Default `/collector/receipts`; el Admin pasa `/admin/receipts`. Tenía la ruta hardcodeada, así que cobrar desde el panel del admin lo expulsaba al shell del cobrador y el `RouteGuard` de esa superficie lo rebotaba al login del cobrador. Por la misma razón `/admin/receipts/[pagoId]` existe aparte aunque renderice el MISMO `ReceiptScreen`.

**Rutas del Cobrador implementadas:** `/collector`, `/collector/login`, `/collector/clients`, `/collector/clients/new`, `/collector/profile` (Fase 5.5: pantalla de cuenta real — identidad, documento/rol desde el JWT sin endpoint nuevo, selector de apariencia y Logout), `/collector/receipts` (vacío explicativo, ver abajo), `/collector/routes/[id]`, `/collector/routes/[id]/close` (cierre de ruta, Fase 5, `CloseRouteScreen`), `/collector/routes/payments/[id]` (acepta `?tab=historial`), `/collector/routes/payments/[id]/credits/[creditoId]` (detalle de crédito + historial de sus cuotas), `/collector/receipts/[pagoId]`.

> **Recibos del cobrador (Fase 5.5): ya no es un 404, pero sigue sin listado.** La pestaña "Recibos" de `nav-items.ts` apuntaba a una ruta sin `page.tsx` (solo existía `[pagoId]`), así que tocarla **expulsaba al cobrador de la app**. Ahora `/collector/receipts` es un `EmptyState` honesto que explica dónde SÍ están los recibos (en el historial del crédito) y lleva ahí. El listado real sigue necesitando un endpoint que no existe (`GET /payments` scoped por cobrador).

**Rutas del Cliente:** `/client/login`, `/client/change-password`, `/client/credit` (lista "Mis créditos"), `/client/credit/[id]` (detalle + historial + recibo).

**Historial modular (Cobrador y Cliente comparten componentes):** la pestaña "Historial" del cliente lista **un crédito por producto** (`CreditSummaryCard`), y cada uno abre el detalle de ESE crédito con sus cuotas (`PaymentHistory` + `ReceiptActions`). Es la misma estructura de dos niveles que ya tenía el Portal (`/client/credit` → `/client/credit/[id]`), con los mismos componentes de `entities/` — solo cambian el `scope` del recibo y qué acciones se pintan. La ruta del detalle va **anidada** bajo el cliente porque `isCollectorTabActive` marca la pestaña con `pathname.startsWith("/collector/routes")`; una ruta plana no encendería ninguna.

## Decisiones y gotchas

- **`pages-fsd/`** está vacío (`.gitkeep`). FSD "pages" no se usa: el routing vive en `app/`. Si en el futuro se quiere respetar la nomenclatura FSD estricta, renombrar `app/` → `pages-fsd/`. Decisión pendiente.
- **Tailwind v4** sin `tailwind.config.ts`. Todo en CSS-first (`@theme inline`). Si necesitas un plugin custom, va en `globals.css` con `@plugin` o en `postcss.config.mjs`.
- **`widgets/health-status/HealthStatus.tsx`** es el único punto que **no** usa `apiFetch`: hace `fetch("/health")` directo porque el endpoint público no necesita auth ni schema tipado.
- **Mocks no se borran.** `mockXxxService` queda implementado para poder volver atrás en un click si el back se rompe.
- **`apiFetch` no maneja 401/403** automáticamente. Política: si la sesión expira, `useValidateSession` lo detecta y limpia; las queries activas fallan con `ApiError` y la UI decide qué hacer (mostrar toast, redirigir, etc.).
- **Decimales:** todo monto en pantalla va con `formatCurrency` (`Intl es-CO`, COP, 0 fracciones, `tabular-nums`). El cálculo de progreso del crédito está en `entities/credit/lib/credit-progress.ts`.
- **El día del desembolso no se cobra.** La cuota N vence N períodos después de `fechaInicio` (diario: al día siguiente). La proyección del front está en `fechaVencimientoCuota` y es espejo del backend.
- **Una fecha `"YYYY-MM-DD"` se parsea con `parseFechaInicio`, nunca con `new Date(s)`.** `new Date("2026-07-29")` es medianoche UTC y `formatDate` fija `timeZone: "America/Bogota"` (UTC-5), así que renderiza el **28**. `parseFechaInicio` la ancla al mediodía UTC. Es el bug que hacía que la vista previa de "Crear crédito" mostrara todas las cuotas corridas un día atrás.
- **`CreditoCalculoPanel` (`features/creditos/ui/`) es la card "Cálculo estimado" compartida.** La montan tres pantallas que arman un crédito en vivo: Crear crédito, el alta de cliente con crédito opcional del Admin (`ClientFormScreen`) y el alta en campo del Cobrador (`FieldClientCreateScreen`). Antes cada una tenía su propia versión — Crear crédito la card completa, las otras dos una barra de una sola línea. Toma valores crudos (`monto`, `interes`, `cuotas`, `frecuencia`, `fechaInicio?`) y deriva `calc` internamente, para que cada pantalla no repita `calcularCredito(...)`.
- **En el picker de cobrador de una ruta, "Tú" es una opción explícita, no un vacío.** `Ruta.cobradorId = null` ya significaba "la cobra el admin" (el backend deja pasar a un ADMIN sin chequear la ruta — ver `cobros.service.ts`), pero `CobradorPicker` (`RouteFormScreen.tsx`) lo mostraba como "Sin cobrador asignado", indistinguible de "todavía no elegí nada". Ahora "Tú (tu nombre)" es un `CommandItem` fijo arriba de la lista y también el estado por defecto de la card seleccionada. Elegirlo NO manda tu propio id como `cobradorId` — el backend rechaza con 400 cualquier id que no sea un usuario con rol COBRADOR (`findCobradorById` lo filtra a propósito) — simplemente vuelve a dejarlo en `null`. Es una capa de UI sobre un dato que no cambió; decisión explícita del usuario para no tocar la validación de roles del backend.
- **Teléfonos: un solo campo, en E.164 (`+573001234567`).** El indicativo se elige con `PhoneInput` (`shared/ui/phone-input.tsx`) y se guarda pegado al número — no hay columna aparte, el `+` ya lo delimita. La tabla de países y los helpers (`parsePhone`, `toE164`, `formatPhone`, `toDialableE164`) viven en `shared/lib/phone/`; **sin `libphonenumber-js`**: la app solo necesita elegir un indicativo, así que no se valida longitud ni prefijo móvil por país. Los números guardados **antes** del selector no tienen `+` y se leen como nacionales de `DEFAULT_COUNTRY` (Colombia); se reescriben a E.164 solo cuando alguien guarda ese formulario — migración perezosa a propósito, un `UPDATE` masivo asumiría que todo número viejo es colombiano. Todo lo que marque o mande WhatsApp usa `toDialableE164` (`tel:`, `buildWhatsAppUrl`), nunca el string crudo; todo lo que lo muestre usa `formatPhone`. Campos cableados: teléfono y contacto del cliente (Admin y alta en campo) + teléfono del cobrador.
- **Un `ZodError` se ve igual que un 404.** El patrón `isError || !entity → "no existe"` que usan todas las pantallas no distingue "el backend devolvió 404" de "la respuesta no cumple el schema". Si una pantalla dice que algo no existe y el `curl` al endpoint responde 200, sospechá del shape antes que de los ids — y revisá a qué API apunta `NEXT_PUBLIC_API_URL` en `apps/web/.env` (hoy puede apuntar a Render, no a `localhost:3001`).
- **Frecuencia de pago: nunca escribas "diaria" en duro.** `cuotaDiaria` es un nombre histórico del contrato — hoy es la cuota del período que fije `credito.frecuencia` (`DIARIO`/`SEMANAL`/`MENSUAL`). Todo el vocabulario (`CUOTA_LABEL`, `CUOTA_SUFIJO`, `CUOTAS_PLURAL`, `FRECUENCIA_LABEL`, `FRECUENCIA_OPTIONS`) y la aritmética de vencimientos (`fechaVencimientoCuota`) viven en `entities/credit/lib/frecuencia.ts`; `FRECUENCIA_OPTIONS` se deriva del enum de `@repo/types`, así que agregar una frecuencia rompe el typecheck hasta traducirla. El `calcularCredito(monto, interes, cuotas)` del front es solo la vista previa: el backend recalcula y es la autoridad. La proyección de vencimientos del front (`fechaVencimientoCuota`, `upcomingInstallments`) es **espejo** de `core/domain/payment-schedule.util.ts` — se cambian juntas.
- **Estado de una cuota (`CuotaEstado`):** pagadas `ON_TIME` / `LATE`; sin pagar escala con el tiempo — `PENDING` (vence hoy, todavía se cobra: neutro) → `OVERDUE` ("Vencida", ámbar, desde el día siguiente) → `DEFAULTED` ("En mora", rojo, a los `DIAS_PARA_MORA` = 7 días). Lo calcula el backend (`buildPaymentHistory`, con unit tests); el front solo mapea a badge en `entities/payment/lib/cuota-estado.ts`.
- **Vencimiento ≠ pago.** `PaymentHistoryItem` trae `fechaVencimiento` (siempre) y `fechaPago` (null si no se ha pagado) como campos distintos, más `diasAtraso`. La tabla los muestra en dos columnas: antes había una sola `fecha` que significaba una cosa en las filas pagadas y otra en las no pagadas.
- **Fechas:** todas por `shared/lib/format-date.ts` (`formatDate`, `formatDateShort`, `formatTime`, `formatDateTime`, `formatDateTimeShort`, `formatRelativeDateTime`). **Los pagos se muestran con hora** — un cliente puede abonar dos veces el mismo día.
- **Afordancia de navegación:** toda tarjeta que navega lleva `href` y pinta un `ChevronRightIcon`. Si una tarjeta no tiene chevron, no se abre. `timeZone` está **fijo a `America/Bogota`**: sin eso el SSR (UTC) y el navegador generan strings distintos y React tira mismatch de hidratación. Nada de `toLocaleDateString` suelto en una pantalla.
- **El recibo es un PDF que genera el back — ya no se imprime nada.** Una sola implementación en `entities/receipt`: `fetchReceiptPdf({pagoId, scope, token})` baja el `Blob` de `application/pdf` (no pasa por `apiFetch`: no hay JSON que validar con Zod, mismo criterio que `apiFetchBlob`). **Ver** = object URL en un `<iframe src>`; **descargar** = `downloadBlob` directo. Se borró `shared/lib/print.ts` — el iframe fuera de pantalla con `window.print()` y su rama para iOS Safari ya no existe, junto con la plantilla HTML del backend (ver el bloque del recibo en el `CLAUDE.md` raíz).
  - **El object URL lo gestiona `useReceiptActions`, no las pantallas.** Expone `previewUrl` + `closePreview()` y revoca al cerrar y al desmontar; antes pasaba el HTML por callback (`onHtml`). Un `createObjectURL` sin su `revokeObjectURL` retiene el Blob entero hasta recargar la página, y repartir esa responsabilidad entre tres pantallas garantizaba que alguna se la olvidara. `ReceiptScreen` es la excepción: gestiona el suyo en el mismo `useEffect` que hace el fetch, porque el PDF es la pantalla completa y no un diálogo.
  - **Ningún iframe de recibo lleva `sandbox`** — ver el porqué en `ReceiptScreen.tsx`: con un PDF no hay markup que inyectar, y sandboxear rompe el visor (pdf.js de Firefox necesita scripts; `allow-scripts` a secas fuerza un origen opaco que rompe el `blob:`).
  - **Compartir** = `wa.me` con el **`reciboPublicUrl`** (`GET /r/:token`), nunca con `reciboUrl` (esa exige JWT de staff y le daría 401 al cliente). Ojo: `wa.me` solo prellena **texto**, no adjunta archivos — mandar el PDF adjunto necesitaría `navigator.share({files})`, que hoy no existe en el repo. Si no hay recibo, el botón va `disabled` con tooltip — **no** un toast que promete algo que no pasa.
- **Descargar un archivo binario real (PDF de cierre, Fase 5):** `apiFetchBlob` (`shared/api/client.ts`) es la única función de `shared/api` que NO valida con Zod — devuelve el `Blob` crudo de `performRequest`, porque el response no es JSON. `downloadBlob(blob, filename)` (`shared/lib/download-blob.ts`) hace el patrón estándar (`URL.createObjectURL` → `<a download>` temporal → `revokeObjectURL`). Lo usa `useDownloadClosurePdf` (`features/closures`) contra `GET /daily-closures/:id/pdf`; el nombre de archivo lo arma `closurePdfFilename` (`features/closures/lib/pdf-filename.ts`, strip de diacríticos vía `\p{Diacritic}`) para que no dependa de la cabecera `Content-Disposition`.
- **`recharts` (nuevo en Fase 5):** único chart de la app, `WeeklyChart` en `features/dashboard/ui/`, consumido solo por la pantalla `/admin`. No es un patrón reusable todavía — si aparece un segundo chart, recién ahí vale la pena extraer un wrapper compartido.
- **Cerrar ruta es del Admin también, no solo del Cobrador (post-Fase-5).** `POST /daily-closures/:routeId` ya lo permitía desde 5.7 (`assertRouteOwnership` solo restringe a COBRADOR, ADMIN no tiene ese chequeo — mismo criterio que `cobros`), pero Fase 5.10 solo cableó la pantalla del Cobrador. `AdminCloseRouteScreen` (`features/closures/ui/`) es el espejo: mismos hooks genéricos (`useClosurePreview`/`useCloseRoute`/`useDownloadClosurePdf`, sin acoplamiento a una superficie), `AdminPageHeader` en vez de `CollectorHero`, y la lista rica de "clientes sin pagar" (`UnpaidClientsList`, llamar/recordar por WhatsApp) que antes solo vivía en `ClosureDetailScreen` — se extrajo a un componente compartido porque el preview y el detalle usan el mismo `UnpaidClient[]`. El botón "Cerrar ruta" vive como `PageAction` en `RouteDetailScreen` (`features/routes-collectors`) y se autodeshabilita con motivo ("Ya se cerró hoy") leyendo `ruta.estadoDia`, en vez de dejar que el 409 lo explique después.
- **"Clientes que pagaron" (post-Fase-5) en `ClosureDetailScreen` y en el PDF.** `PaidClientsList` (`features/closures/ui/`) es el espejo positivo de `UnpaidClientsList`: una fila por PAGO (no por cliente — alguien puede pagar dos cuotas el mismo día), sin acciones de llamar/recordar. `closure.paidClients` puede ser `null` (cierre de antes de que este campo existiera — el snapshot no se recalcula hacia atrás) y la pantalla lo distingue explícitamente de `[]` ("nadie pagó ese día") con un mensaje distinto ("No disponible para cierres anteriores a esta función."). El mismo dato alimenta la sección nueva del PDF (`closure-pdf.ts`, `drawPaidClients`).
- **Frontera entities ↔ features:** `entities/*` nunca importa de `features/*` ni de otra entity. Cuando una tarjeta de entity necesita un componente de feature (ej. `RegistrarCobroSheet` dentro de `CreditSummaryCard`) se pasa por un **slot** (`footer`, `actions`, `renderActions`). Cuando una entity necesita el JWT (`entities/receipt`), el token entra **por parámetro** — igual que `apiFetch`.
- **Tarjetas navegables con botones dentro:** `ClientCard`/`CreditSummaryCard` usan **stretched link** (`<Link className="absolute inset-0">` bajo el contenido), no envuelven la tarjeta en un `<a>`. Un `<button>` (copiar, compartir) dentro de un `<a>` es HTML inválido y además navega al pulsarlo.
- **Sin SWR/React Query devtools** ni **sin Storybook**: la galería `/dev/ui` hace de ambos.
- **`CuotaEstado` ganó `"ANULADO"` (post-Fase-4).** Es una fila de auditoría, no una cuota real: su `numeroCuota` es el sentinel `0` (nunca un lugar real del cronograma — la UI nunca debe renderizar "Cuota 0/N", se distingue por `estado`, no por ese número). `esCuotaAnulada(estado)` (`entities/payment/lib/cuota-estado.ts`) es la que decide: ocultar "Anular pago" sobre una fila ya anulada, y no mostrar "Cuota X/Y" en `PaymentRow`/`PaymentHistoryTable` (se tacha el monto en su lugar — se muestra, no se esconde, es auditoría). Badge nuevo en `shared/ui/badge.tsx`: `anulado` (gris, mismo tono que `missed`).
- **"Anular pago"** (`features/cobros/ui/AnularPagoButton.tsx`) vive en `features/cobros`, no en `entities/payment`, porque necesita el hook de mutación (`useAnularPago`) — una entity no puede importar de una feature. Se monta junto a `ReceiptActions` en el `renderActions` de `AdminCreditCollectScreen`/`CollectorCreditDetailScreen` (las dos pantallas de staff con historial de cuotas), nunca en el portal del cliente.
- **`ReceiptScreen` ahora comparte, no solo ve.** Era la única pantalla de recibo sin `ReceiptActions` — justo la que se abre automáticamente después de cobrar (`RegistrarCobroSheet` navega ahí), así que no había forma de mandarlo por WhatsApp sin ir al historial a buscar la misma fila. Ahora hace un segundo fetch en paralelo (`receiptsService.getData`, `GET /payments/:pagoId` JSON) para tener los datos del mensaje; si ese fetch falla, la pantalla sigue mostrando el recibo, solo sin poder compartir (nunca rompe la vista principal). "Descargar" reusa el PDF que ya está en el iframe (no lo vuelve a pedir).
- **Clientes inactivos: pestaña dedicada, no el form de alta.** `ClientsListScreen` tiene un tab "Inactivos" (ADMIN-only, la pantalla ya lo es por ruta) con un botón "Reactivar" por fila que abre `ReactivateClientDialog` — fetch aparte (`useClienteInactivo`, query key `["clientes", id, "inactivo"]`, **nunca** comparte caché con `useCliente` porque tiene scoping distinto en el backend) que muestra un aviso si el cliente tiene créditos abiertos antes de confirmar. Reactivar así **no pisa datos** (solo `ClientAdmin.activo=true`) — distinto de volver a dar de alta con el mismo documento, que sí los pisa (ver `CLAUDE.md` raíz, "reactivación").
- **"Historial" de créditos del cliente = solo terminados.** `AdminClientCreditsScreen`/`ClientPaymentsScreen` (espejos Admin/Cobrador) usaban `[...creditosActivos, ...creditosHistorial].filter(pagos > 0)` para esa pestaña — un crédito `ACTIVO` con algún abono aparecía ahí Y en "Activos" a la vez. Ahora sale directo de `cliente.creditosHistorial` (ya separado por el backend como "no ACTIVO/MORA"), sin merge.

## Comandos

Ver `../../CLAUDE.md` §Commands. Los más usados:

```bash
pnpm --filter web dev              # next dev (3000)
pnpm --filter web build
pnpm --filter web typecheck
pnpm --filter web lint
```

No hay test runner configurado (decisión de Fase 6).
