# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Estado actual (Fase 3 cerrada; Fase 4 planificada).** Fases 0, 0.5, 1, 2 y 3 están implementadas y verificadas end-to-end con la API real. Faltan 4, 5 y 6. Detalle exhaustivo y decisiones de implementación en `specs/ESTADO_ACTUAL.md`; spec original en `specs/PLAN_DESARROLLO.md`. Plan detallado de Fase 4 en `specs/FASE_4_SUBFASES.md` (18 sub-fases, listo para ejecutar).

## Project

Accounts receivable / daily-installment collection system. Three user profiles: **Admin** (full access), **Cobrador** (collector, scoped to their assigned route(s)), **Cliente final** (read-only, token-based access, no login). Hoy el portal del cliente es un placeholder; su feature se cierra en Fase 4.

`specs/PLAN_DESARROLLO.md` es la spec original (Fase 0 → 6). `specs/ESTADO_ACTUAL.md` documenta lo implementado, decisiones tomadas en el camino y lo que falta. Cada fase está desglosada en `specs/FASE_<N>_SUBFASES.md`. `specs/DESIGN_SYSTEM.md` tiene los tokens; están aplicados en `apps/web` (Fase 0.5).

## Working conventions

Dos convenciones (también en `specs/PLAN_DESARROLLO.md` §5):

- **Orden por fase: frontend → backend → wiring.** Desde Fase 1, cada fase se entrega en tres bloques: (A) front contra mocks; (B) back (Nest + Prisma + guards); (C) cableado, swap mock→real. El servicio HTTP se esconde detrás de una interfaz desde el primer bloque. El contrato compartido (Zod + tipo en `@repo/types`) se define en el primer bloque de front y el back lo **reusa** sin duplicar.
- **Idioma: código en inglés, prosa en español.** Identificadores, filenames, carpetas, clases, funciones, variables, schemas, services, repos, rutas API/front nuevas → inglés. Los nombres técnicos en español son deuda y se renombran al ser tocados. Docs (`specs/*`), copy de usuario, respuestas y comentarios solo donde aporten.

## Estado actual (resumen rápido)

| Fase | Alcance | Estado |
|---|---|---|
| **0** Monorepo | Turborepo + pnpm + `apps/web` + `apps/api` + `packages/{types,config}` + `GET /health` | ✅ |
| **0.5** Design system | Tokens CSS, Inter, modo por superficie, shadcn primitives (23), `ProgressRing`, GSAP motion + galería dev | ✅ |
| **1** Auth | `Usuario` Prisma + JWT + `JwtAuthGuard` + `RolesGuard` + `@Roles` + `@CurrentUser` + 2 logins + `RouteGuard` | ✅ (DoD tildado en spec) |
| **2** Clientes/Rutas/Cobradores | `Ruta`, `Cliente` Prisma + 3 módulos + `core/storage` (Supabase) + foto documento (multipart, 2 lados) + shell Admin/Cobrador + 7 pantallas | ✅ |
| **3** Créditos/Cobros | `Producto`, `Credito`, `Pago` Prisma + 3 módulos + transacción atómica con control de carrera (`updateMany` condicional) + `codigo` por secuencia + anular crédito + 6 pantallas Admin/Cobrador | ✅ |
| **4** Recibos + portal Cliente | Recibo HTML server-rendered + `auth-cliente` (3er rol JWT) + `client-portal` + `MustChangePasswordGuard` + `@Public()`/`APP_GUARD` global + `@nestjs/throttler` + acciones staff (`/clients/:id/access`) | ⬜ (plan listo en `FASE_4_SUBFASES.md`) |
| **5** Cierre diario + reportes PDF | — | ⬜ |
| **6** Hardening + tests | Unit tests + filtros globales + auditoria + CI | ⬜ |

**Tests hoy:** 24 casos e2e en `apps/api/test/` (`app`, `auth`, `clientes`, `rutas`). Cero unit tests. Cero tests en front.

**Endpoints implementados** (en inglés, ver refactor reciente):

| Verbo | Path | Guards | Roles |
|---|---|---|---|
| GET | `/health` | — | público |
| POST | `/auth/login` | — | público |
| GET | `/auth/me` | Jwt | auth |
| GET | `/auth/admin-only` | Jwt + Roles | ADMIN |
| GET, POST | `/users` | Jwt + Roles | ADMIN |
| PATCH | `/users/:id` | Jwt + Roles | ADMIN |
| GET | `/clients` | Jwt | scoping por rol |
| GET | `/clients/summary` | Jwt | scoping |
| GET | `/clients/:id` | Jwt | scoping |
| POST | `/clients` | Jwt | scoping |
| PATCH | `/clients/:id` | Jwt | scoping |
| DELETE | `/clients/:id` | Jwt + Roles | ADMIN (soft-delete) |
| POST | `/clients/id-document-photo` | Jwt | multipart, devuelve URL pública |
| GET | `/routes` | Jwt | scoping |
| GET | `/routes/:id` | Jwt | scoping |
| POST | `/routes` | Jwt + Roles | ADMIN |
| PATCH | `/routes/:id` | Jwt + Roles | ADMIN |
| DELETE | `/routes/:id` | Jwt + Roles | ADMIN |
| GET | `/products` | Jwt | auth |
| POST | `/products` | Jwt + Roles | ADMIN |
| PATCH | `/products/:id` | Jwt + Roles | ADMIN |
| GET | `/credits` | Jwt | scoping |
| GET | `/credits/:id` | Jwt | scoping |
| POST | `/credits` | Jwt | scoping |
| PATCH | `/credits/:id` | Jwt | scoping |
| DELETE | `/credits/:id` | Jwt + Roles | ADMIN (anular, soft) |
| POST | `/collections` | Jwt | scoping, tx atómica |

**Mock vs real:** TODOS los features están conectados a `httpXxxService`. Los `mockXxxService` siguen implementados (no se borraron) — el swap se hace cambiando una constante en cada `*-service.ts`. `cobros` no tiene mock útil: `mockCobrosService.registrarCobro` solo lanza errores para validar el camino de rollback.

## Commands

```bash
# Root (Turborepo fans out a cada workspace)
pnpm dev         # web + api + types watch build, en paralelo
pnpm build       # types primero (^build), luego api y web
pnpm lint        # eslint en todos los workspaces
pnpm typecheck   # tsc --noEmit en todos los workspaces
pnpm format      # prettier --write . (root re-exporta packages/config/prettier.config.js)

# Workspace único
pnpm --filter api dev
pnpm --filter web build
pnpm --filter @repo/types build   # necesario antes de api/web en cold start

# Backend
pnpm --filter api test           # jest unit tests (no hay *.spec.ts aún)
pnpm --filter api test:e2e       # jest --config ./test/jest-e2e.json
pnpm --filter api test:e2e -- -t "auth"
pnpm --filter api db:generate    # prisma generate (corre en postinstall también)
pnpm --filter api db:seed        # ts-node prisma/seed.ts — demo data idempotente
```

Sin test runner en `apps/web` aún (lo decide Fase 6).

### Local env setup

`apps/api/.env` (gitignored; copiar de `apps/api/.env.example`): `PORT`, `WEB_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET`. Validados al boot con Zod (`apps/api/src/core/config/env.schema.ts`) vía `ConfigModule.forRoot({ validate })` — falla limpio si falta alguno. `NODE_ENV` también se valida pero **no está en `.env.example`** (agregar si se necesita explícito).

**Gotcha Supabase:** el host "Direct connection" (`db.<project>.supabase.co`) es IPv6-only y rompe con `ENETUNREACH` en WSL/sandboxes. Usar el **connection pooler** (dashboard → Connect → "Transaction/Session pooler"), IPv4-compatible. En `.env` actual del repo ya se usa el pooler.

**Gotcha `SUPABASE_SERVICE_KEY`:** debe ser la **`service_role`** real (JWT que empieza con `eyJ...`). El `.env` actual tiene una clave con prefijo `sb_publishable_…` — verificar que no sea la anon; el `StorageService.uploadImagen` requiere permisos de escritura en el bucket.

**`apps/web/.env`:** no existe `.env.example`. Solo se lee `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Architecture

Turborepo + pnpm workspaces. `apps/*` deployables, `packages/*` código compartido.

```
apps/api      NestJS backend
apps/web      Next.js (App Router) frontend
packages/config  shared tsconfig/eslint/prettier base (source, sin build)
packages/types   shared Zod + tipos (@repo/types) — el contrato api/web
```

### Dos estilos arquitectónicos, deliberadamente

Back: **Feature-Based modules** (NestJS module → controller → service → repository en `apps/api/src/modules/*`). Front: **Feature-Sliced Design** (`apps/web/src/{app,widgets,features,entities,shared}`, las capas importan solo hacia abajo). Distintos a propósito (ver `specs/PLAN_DESARROLLO.md` §2).

**Regla transversal:** **no acoplamiento horizontal entre features**. Lo compartido va a `core/` (back), `shared/`/`packages/*` (front), o contratos tipados — nunca importando el service del vecino.

### `@repo/types` — la capa de contratos

Zod como única fuente de verdad. Convención:
- `<entidad>Schema` (camelCase) + tipo inferido PascalCase mismo nombre (`rutaSchema` → `Ruta`).
- Sufijos por rol: `Schema` (shape), `ListItemSchema` (fila), `DetailSchema` (detalle), `RequestSchema` (body), `QuerySchema` (query), `ResponseSchema`.
- Updates vía `.partial()` cuando el shape coincide; redefinidos a mano cuando se quita un campo requerido.
- Mensajes de error en español, en imperativo/predicativo para mostrar al usuario final (`"El monto debe ser mayor a 0."`).
- Decimales: `z.number()` (JS). Prisma persiste `Decimal(12,2)`, el service hace `.toNumber()` antes del `schema.parse(...)`. **Nunca Float para dinero.**
- Reglas clave: `password min(6)`, `monto positive`, `dias int positive`, `interes min(0)`, `ids: z.string()` (acepta UUIDs y códigos legibles como `CR-XXXX`).

**Constraint no obvio:** `@repo/types` debe compilar a CommonJS (`tsc`, `module: CommonJS`). `apps/api` no tiene `"type": "module"`, así que Nest compila a CJS y `require()` los workspace packages. ESM-only rompe en runtime (no en typecheck) cuando hay imports de valor real.

### NestJS structure (`apps/api/src`)

```
main.ts                        bootstrap: NestFactory, CORS (WEB_ORIGIN), PORT (default 3001)
app.module.ts                  imports ConfigModule, PrismaModule, CoreAuthModule, StorageModule, 7 feature modules
core/
├── config/env.schema.ts       Zod schema + validateEnv()
├── prisma/                    PrismaService (driver-adapter pattern) + PrismaModule (@Global)
├── auth/                      CoreAuthModule (@Global): JwtModule, JwtAuthGuard, RolesGuard, @Roles, @CurrentUser, AuthenticatedUser
├── storage/                   StorageService (Supabase client + upload a bucket público)
├── pipes/                     ZodValidationPipe, ImageFileValidationPipe (5MB, JPEG/PNG/WebP)
└── domain/                    helpers cross-feature (ej: rollupEstadoCliente, mapCreditoListItem) — único punto donde dos features comparten lógica sin acoplarse
modules/
├── auth/                      login, /me, /admin-only (referencia mínima)
├── health/                    GET /health (referencia mínima, query en vivo)
├── usuarios/                  CRUD ADMIN sobre Usuario (lista filtra COBRADOR por default)
├── clientes/                  CRUD + summary + upload foto doc (multipart) + soft-delete
├── rutas/                     CRUD + scoping por cobrador + delete con check de clientes
├── productos/                 CRUD + Decimal para precioBase
├── creditos/                  crear/editar/anular + codigo por secuencia + recálculo de saldo
└── cobros/                    POST /collections con tx atómica + control de carrera
```

**Patrón repository (sin interface abstracta):** cada módulo tiene una clase `@Injectable()` concreta (`ClientsRepository`, etc.) con `prisma` inyectado y métodos tipados. El **scoping por rol siempre lo arma el service**, no el repository — `clients.repository.ts:44-46` lo declara explícito: *"Capa de datos pura: solo Prisma, cero reglas de negocio, cero auth."*

**Patrón de guards:** se aplican a nivel de clase (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("ADMIN")`) y se sobreescriben en handlers puntuales. **No hay `@Public()`**: los endpoints públicos son los que no llevan `@UseGuards(JwtAuthGuard)`. No hay `APP_GUARD` global (cada controller decide).

**Manejo de errores:** sin `ExceptionFilter` global. Cada service mapea errores Prisma a HTTP en su `mapError`:
- `P2002` → `ConflictException` (unique constraint)
- `P2025` → `NotFoundException` o `BadRequestException` según contexto
- `P2003` (FK) → `ConflictException` (solo en `Rutas.remove`)
- Zod → `BadRequestException` con `result.error.issues` (pipe)

**Prisma v7 cambios importantes** (ver `specs/PLAN_DESARROLLO.md` §"stack" + `prisma/schema.prisma:8-10`):
- `PrismaClient` requiere driver adapter (`@prisma/adapter-pg` + `PrismaPg({ connectionString })`). El schema NO tiene `url` en `datasource` (Prisma 7 lo rechaza con `P1012`).
- Generator pinned a `provider = "prisma-client-js"` (clásico). El nuevo `"prisma-client"` emite `import.meta.url` (ESM-only) que rompe en runtime CJS.
- **`prisma.config.ts` DEBE estar en `apps/api` raíz**, no en `src/`. Si no, el CLI falla con "datasource.url is required" engañoso.
- Modelos actuales: `Usuario`, `Ruta`, `Cliente`, `Producto`, `Credito`, `Pago` + enums `Rol`, `EstadoCredito`. FKs de dinero (`Cliente.rutaId`, `Credito.cliente/producto`, `Pago.credito/cobrador`) son **`onDelete: Restrict`** (auditable). Solo `Ruta.cobradorId` es `SetNull` (cobrador borrado no debe borrar rutas).
- Secuencia Postgres `credito_codigo_seq` (start 2000) para códigos `CR-XXXX` race-safe.

### Next.js structure (`apps/web/src`)

Ver `apps/web/CLAUDE.md` para el detalle del front (FSD, design system, mock swap, etc.).

Resumen:
- App Router, Next 16 con Turbopack.
- `app/` = composición pura (server components que importan de `widgets`/`features`). Route-groups: `(admin)` (dark), `(collector)` (light + bottom tab), `(client)` (light, placeholder), `dev/ui` (galería).
- `widgets/` = bloques compuestos (shells, login). `features/` = 7 features con `api/ + ui/`. `entities/` = 3 (client, credit, session). `shared/` = api client, motion (GSAP), ui primitives (23 shadcn), icons, lib.
- `shared/api/client.ts` (`apiFetch` + `uploadFile`): base URL `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`). Token se pasa **explícitamente** en cada llamada (no interceptor) para mantener `shared` libre de imports de capas superiores.
- Patrón swap mock→real: `export const xxxService: XxxService = httpXxxService` en cada `*-service.ts`. Mocks siguen implementados.
- Zustand para sesión (`entities/session/model/session-store.ts`, persistido en `localStorage` clave `session-storage`, con flag `hasHydrated` para evitar redirección prematura en SSR).
- TanStack Query para todo lo demás. Cada feature define `queryKeys` jerárquico y mutaciones invalidan con `<feature>Keys.all`. Sin `defaultOptions` (defaults v5).
- Validación en cliente: cada `apiFetch(path, schema, opts)` ejecuta `schema.parse(json)` con el MISMO schema Zod de `@repo/types`. Errores de shape lanzan `ZodError`.

**No hay** (intencionalmente hoy): `ExceptionFilter`, interceptors de logging, Swagger/OpenAPI, rate limiting, cron jobs, optimistic updates, test runner en front.

Puertos: web 3000, api 3001 (defaults Nest/Next, override por `PORT`/`WEB_ORIGIN`/`NEXT_PUBLIC_API_URL`).
