# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Estado actual (Fase 4 cerrada; Fase 5 planificada).** Fases 0, 0.5, 1, 2, 3 y 4 están implementadas y verificadas end-to-end con la API real. Faltan 5 y 6. Detalle exhaustivo y decisiones de implementación en `specs/ESTADO_ACTUAL.md`; spec original en `specs/PLAN_DESARROLLO.md`. Fase 4 desglosada (18 sub-fases, todas cerradas) en `specs/FASE_4_SUBFASES.md`.

## Project

Accounts receivable / daily-installment collection system. Three user profiles: **Admin** (full access), **Cobrador** (collector, scoped to their assigned route(s)), **Cliente final** (read-only portal, login por documento + contraseña — sin token). El portal del cliente (Fase 4) tiene login, cambio de contraseña obligatorio en el primer ingreso, lista de créditos y detalle con historial de pagos.

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
| **4** Recibos + portal Cliente | Recibo HTML server-rendered + `auth-cliente` (3er rol JWT) + `client-portal` + `MustChangePasswordGuard` + `@Public()`/`APP_GUARD` global + `@nestjs/throttler` + acciones staff (`/clients/:id/access`) + pantalla nueva "Mis créditos" | ✅ (18/18 sub-fases, `FASE_4_SUBFASES.md`) |
| **5** Cierre diario + reportes PDF | — | ⬜ |
| **6** Hardening + tests | Unit tests + filtros globales + auditoria + CI | ⬜ |

**Tests hoy:** 103 casos e2e en 14 suites de `apps/api/test/` (`app`, `auth`, `clientes`, `clientes-foto`, `rutas`, `usuarios`, `auth-cliente`, `client-portal`, `receipts`, `clientes-access`, `client-sharing`, `multi-tenancy`, `cobros`, `creditos`) + 37 unit tests (`core/domain/payment-schedule.util.spec.ts` 32 + `core/contracts/repo-types-integrity.spec.ts` 5). Cero tests en front.

**Bajas: qué se borra de verdad.** `Cliente` (relación `ClientAdmin.activo=false`) y `Usuario`/cobrador (`activo=false` + sus rutas quedan sin cobrador) son **soft-delete** — `Pago.cobradorId` y las FKs de dinero son `onDelete: Restrict` y la auditoría manda. `Ruta` es el **único borrado físico**, y solo si no le quedan clientes activos (409 en caso contrario). El login filtra por `activo`, que es lo que hace que la baja del cobrador signifique algo; sin eso el switch activo/inactivo era decorativo. Limitación conocida: `JwtAuthGuard` es stateless, así que un token ya emitido sigue válido hasta `JWT_EXPIRES_IN` (1d) — verificar `activo` por request es Fase 6.

**Endpoints implementados** (en inglés, ver refactor reciente):

| Verbo | Path | Guards | Roles |
|---|---|---|---|
| GET | `/health` | — | público |
| POST | `/auth/login` | — | público |
| GET | `/auth/me` | Jwt | auth |
| GET | `/auth/admin-only` | Jwt + Roles | ADMIN |
| GET, POST | `/users` | Jwt + Roles | ADMIN |
| PATCH | `/users/:id` | Jwt + Roles | ADMIN |
| DELETE | `/users/:id` | Jwt + Roles | ADMIN — baja lógica del cobrador (`activo:false` + libera sus rutas); 403 al auto-borrarse, 404 fuera del tenant |
| GET | `/clients` | Jwt + Roles | ADMIN/COBRADOR, scoping por rol |
| GET | `/clients/summary` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| GET | `/clients/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| POST | `/clients` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| PATCH | `/clients/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| DELETE | `/clients/:id` | Jwt + Roles | ADMIN (soft-delete) |
| POST | `/clients/id-document-photo` | Jwt + Roles | ADMIN/COBRADOR, multipart, bucket privado — devuelve `{ path, url }` (path a persistir, URL firmada solo para el preview inmediato) |
| GET | `/routes` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| GET | `/routes/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| POST | `/routes` | Jwt + Roles | ADMIN |
| PATCH | `/routes/:id` | Jwt + Roles | ADMIN |
| DELETE | `/routes/:id` | Jwt + Roles | ADMIN |
| GET | `/products` | Jwt + Roles | ADMIN/COBRADOR |
| POST | `/products` | Jwt + Roles | ADMIN |
| PATCH | `/products/:id` | Jwt + Roles | ADMIN |
| GET | `/credits` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| GET | `/credits/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| POST | `/credits` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| PATCH | `/credits/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| DELETE | `/credits/:id` | Jwt + Roles | ADMIN (anular, soft) |
| POST | `/collections` | Jwt + Roles | ADMIN/COBRADOR, scoping, tx atómica — el ADMIN cobra en cualquier ruta de su tenant (el chequeo "la ruta es mía" solo aplica a COBRADOR) y el `Pago` queda a su nombre |
| POST | `/clients/:id/access` | Jwt + Roles + scoping | ADMIN/COBRADOR de la ruta — genera/resetea password temporal |
| DELETE | `/clients/:id/access` | Jwt + Roles + scoping | ADMIN/COBRADOR de la ruta — revoca acceso |
| POST | `/client-auth/login` | `@Public()` + Throttle(5/min) | público (rol se emite en el JWT) |
| GET | `/client-auth/me` | Jwt + Roles + MustChangePassword | CLIENTE |
| POST | `/client-auth/change-password` | Jwt + Roles | CLIENTE (sin `MustChangePasswordGuard` — es la salida del lockout) |
| GET | `/payments/:pagoId/receipt` | Jwt + Roles | ADMIN/COBRADOR de la ruta del cliente (`text/html`) |
| GET | `/r/:token` | `@Public()` + Throttle(30/min) | público — recibo por enlace firmado (capability URL); el token ES la autorización |
| GET | `/client-portal/credits` | Jwt + Roles + MustChangePassword | CLIENTE, scoping por `clienteId` |
| GET | `/client-portal/credits/:id` | ídem | 404 si el crédito es de otro cliente |
| GET | `/client-portal/summary` | ídem | agregado del cliente autenticado |
| GET | `/client-portal/payments/:pagoId/receipt` | ídem | recibo propio (`text/html`), 404 si es ajeno |

**Mock vs real:** todos los features, incluido `client-portal` (Fase 4, swap activado tras auditoría post-Fase 4), están conectados a `httpXxxService`. Los `mockXxxService` siguen implementados (no se borraron) — el swap se hace cambiando una constante en cada `*-service.ts`. `cobros` no tiene mock útil: `mockCobrosService.registrarCobro` solo lanza errores para validar el camino de rollback.

**Frecuencia de pago (diaria/semanal/mensual).** `Credito.frecuencia` + `Credito.cuotas`. El dinero se calcula igual en las tres: `montoTotal = capital + capital*interes/100`, `cuota = montoTotal / cuotas` — 4 cuotas semanales de 1.200.000 son 300.000 cada una, igual que 4 diarias. Lo único que cambia es **cuándo vence** cada cuota, y eso lo sabe una sola función: `fechaVencimientoCuota(fechaInicio, numeroCuota, frecuencia)` en `core/domain/payment-schedule.util.ts` (mensual = mismo día del mes siguiente, cayendo al último día si no existe — 31 ene → 28 feb, nunca +30 fijos). El umbral de mora (`DIAS_PARA_MORA = 7`) es el mismo para las tres.

**El día del desembolso NO se cobra.** La cuota N vence N períodos después de `fechaInicio`: en diario, la cuota 1 vence al día siguiente; en semanal, a los 7 días; en mensual, el mismo día del mes siguiente. Antes la cuota 1 vencía el MISMO `fechaInicio`, así que un crédito nacía con una cuota pendiente el día de otorgarlo. Vive en `fechaVencimientoCuota` (`periodos = numeroCuota`), con espejo en el front (`entities/credit/lib/frecuencia.ts`) — los dos se cambian juntos.

**`fechaInicio` se ancla al MEDIODÍA UTC** (`parseFechaInicio`, `core/domain/payment-schedule.util.ts`). Un `<input type="date">` manda `"2026-07-29"` y `new Date(...)` lo lee como medianoche UTC; como toda la UI formatea con `timeZone: "America/Bogota"` (UTC-5), eso se renderizaba como el **28** de julio y arrastraba todo el cronograma un día atrás. El mediodía cae en el mismo día de calendario en cualquier zona entre UTC-11 y UTC+11. Los créditos creados ANTES de este fix siguen guardados a medianoche UTC y se ven un día antes; se corrigen con `UPDATE "Credito" SET "fechaInicio" = "fechaInicio" + interval '12 hours' WHERE date_part('hour', "fechaInicio" AT TIME ZONE 'UTC') = 0;` (no cambia el día UTC, así que el cronograma no se mueve). **`Credito.cuotas` es la columna que manda**; `dias` quedó como plazo nominal (`cuotas * 1|7|30`), columna histórica de cuando todo era diario y `dias` ERA el número de cuotas — no se usa para calcular vencimientos. `cuotaDiaria` conserva el nombre por compatibilidad del contrato pero significa "valor de una cuota": la UI la titula con `CUOTA_LABEL` (`apps/web/src/entities/credit/lib/frecuencia.ts`), nunca "diaria" fijo.

**Roles y permisos:** política completa en `specs/PLAN_DESARROLLO.md` §1.1 — ningún rol ve la información completa de los otros dos. Todos los controllers de staff (`clients`, `credits`, `collections`, `routes`, `products`) declaran `@Roles("ADMIN", "COBRADOR")` a nivel de clase para excluir explícitamente a `CLIENTE`, con overrides puntuales por handler donde un endpoint es ADMIN-only. `CLIENTE` solo tiene acceso (de solo lectura) a `/client-portal/*`.

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
pnpm --filter api test           # jest unit tests (32 casos en core/domain/payment-schedule.util.spec.ts + 5 en core/contracts/repo-types-integrity.spec.ts)
pnpm --filter api test:e2e       # jest --config ./test/jest-e2e.json --runInBand (serial: ver gotcha abajo)
pnpm --filter api test:e2e -- -t "auth"
pnpm --filter api db:generate    # prisma generate (corre en postinstall también)
pnpm --filter api db:seed        # ts-node prisma/seed.ts — demo data idempotente
```

Sin test runner en `apps/web` aún (lo decide Fase 6).

### Local env setup

`apps/api/.env` (gitignored; copiar de `apps/api/.env.example`): `PORT`, `WEB_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET`, `PUBLIC_APP_URL` (Fase 4, default `http://localhost:3001` — URL del back para el enlace del recibo). Validados al boot con Zod (`apps/api/src/core/config/env.schema.ts`) vía `ConfigModule.forRoot({ validate })` — falla limpio si falta alguno. `NODE_ENV` también se valida pero **no está en `.env.example`** (agregar si se necesita explícito).

**Gotcha Supabase:** el host "Direct connection" (`db.<project>.supabase.co`) es IPv6-only y rompe con `ENETUNREACH` en WSL/sandboxes. Usar el **connection pooler** (dashboard → Connect → "Transaction/Session pooler"), IPv4-compatible. En `.env` actual del repo ya se usa el pooler.

**Resuelto — `SUPABASE_SERVICE_KEY`:** el `.env` actual **sí es la `service_role`** (JWT `eyJ...`, claim `role: "service_role"` verificado). El gotcha que documentaba esto como pendiente (clave con prefijo `sb_publishable_…`) quedó obsoleto — en algún momento se corrigió sin actualizar la doc. Lo que sí faltaba de verdad era el **bucket**: `SUPABASE_STORAGE_BUCKET="documentos"` no existía en el proyecto (0 objetos en todo el Storage, ninguna foto se subió jamás). Se creó como **privado** — ver "Foto de documento" más abajo.

**Gotcha e2e + connection pooler:** `test:e2e` corre con `--runInBand`. Con 12 archivos de e2e, Jest en paralelo (default) agota el pool de Supabase (`pool_size: 15` en modo sesión) — cada archivo abre su propio `PrismaClient` directo para fixtures, más el que abre cada test individual vía `Test.createTestingModule`. En serie no hay contención.

**Foto de documento (Fase 5, adelantado desde el plan de Fase 2/6):** el bucket `documentos` es **privado** (documentos de identidad), no público como especificaba originalmente `FASE_2_SUBFASES.md` — el endurecimiento se adelantó en vez de diferirse. `Cliente.fotoDocumentoFrentePath`/`ReversoPath` guardan el **path** dentro del bucket, nunca una URL; `ClientsService.toDetail` firma ambos en batch con `StorageService.createSignedUrls` (TTL 1h, `core/storage/storage.constants.ts`) y expone la URL firmada como `fotoDocumentoFrenteUrl`/`ReversoUrl` — **solo en el detalle, nunca en listas** (firmar por fila en un listado sería un round-trip a Storage inútil, ver el comentario de `clienteListItemSchema`). El contrato en `@repo/types` es asimétrico a propósito: requests llevan `*Path` sin `.url()`, el detalle devuelve ambos. Un fallo al firmar no tumba el `GET`: devuelve `null` y queda logueado (`Logger.warn`), nunca lanza. El único endpoint que toca Storage tiene e2e real (`apps/api/test/clientes-foto.e2e-spec.ts`, sube/borra objetos de verdad — `describe.skip` si faltan credenciales).

**`apps/web/.env`:** copiar de `apps/web/.env.example` (creado en Fase 4.6). Lee `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`) y `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`, usado para el enlace compartible del recibo por WhatsApp).

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

**Gotcha crítico: nada de imports circulares entre archivos de `packages/types/src`.** Al compilar a CJS, si dos módulos se importan mutuamente, el que pierde la carrera lee un binding todavía `undefined` y lo **captura** dentro de su `z.object({...})`. El schema queda roto para siempre y solo falla al parsear, con `TypeError: Cannot read properties of undefined (reading '_parse')` — `tsc` y el build pasan limpios. Pasó de verdad: `cobro.ts ↔ credito.ts` dejó `cobroResponseSchema.shape.credito` en `undefined` y `POST /collections` devolvía 500 **con el pago ya guardado**. Por eso `pagoSchema` vive en `payment.ts` (hoja, sin imports) y el grafo es lineal: `payment → payment-history → credito → cobro → client/client-portal/route`. `apps/api/src/core/contracts/repo-types-integrity.spec.ts` recorre todos los schemas exportados y falla si aparece un nodo `undefined`.

**Lector tolerante en las respuestas.** El front valida TODA respuesta con estos mismos schemas, así que un campo nuevo y **requerido** rompe la app entera contra un backend que todavía no lo manda — front desplegado antes que el back, o `apps/web/.env` apuntando a la API de Render mientras se desarrolla contra `main`. Pasó de verdad con `frecuencia`: `clienteDetailSchema.parse` lanzaba `ZodError` por cada crédito y las pantallas lo mostraban como **"este cliente no existe"** (el patrón `isError || !cliente` no distingue un 404 de un error de shape). Por eso los campos nuevos de respuesta nacen con `.default(...)`/`.optional()` — ver `frecuencia`, `reciboPublicUrl`, `totalCobradoHoy` — y `repo-types-integrity.spec.ts` tiene un test que fija la tolerancia. En los **requests** la regla es la opuesta: ahí un campo faltante debe fallar.

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
app.module.ts                  imports ConfigModule, PrismaModule, CoreAuthModule, StorageModule, ThrottlerModule, 10 feature modules; APP_GUARD global: ThrottlerGuard, JwtAuthGuard, RolesGuard
core/
├── config/env.schema.ts       Zod schema + validateEnv()
├── prisma/                    PrismaService (driver-adapter pattern) + PrismaModule (@Global)
├── auth/                      CoreAuthModule (@Global): JwtModule, JwtAuthGuard, RolesGuard, MustChangePasswordGuard, @Public, @Roles, @CurrentUser, AuthenticatedUser
├── security/                  lockout-policy.ts (Fase 4): MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES, TEMPORARY_PASSWORD_EXPIRY_HOURS
├── receipts/                  ReceiptTokenService — firma/verifica el token del enlace público del recibo (claim `typ: "receipt"`, 90d). Provisto por CoreAuthModule (@Global) porque lo usan 4 features
├── storage/                   StorageService (Supabase client + upload a bucket público)
├── contracts/                 repo-types-integrity.spec.ts — guardia anti-import-circular de @repo/types (ver el gotcha arriba)
├── pipes/                     ZodValidationPipe, ImageFileValidationPipe (5MB, JPEG/PNG/WebP)
└── domain/                    helpers cross-feature, cero I/O: rollupEstadoCliente, mapCreditoListItem, buildReciboCodigo (Fase 4), buildPaymentHistory/computeProximaFechaCuota/fechaVencimientoCuota/cuotasVencidasAlDia (con unit tests) — único punto donde dos features comparten lógica sin acoplarse
modules/
├── auth/                      login, /me, /admin-only (referencia mínima)
├── health/                    GET /health (referencia mínima, query en vivo)
├── usuarios/                  CRUD ADMIN sobre Usuario (lista filtra COBRADOR por default)
├── clientes/                  CRUD + summary + upload foto doc (multipart) + soft-delete + acceso al portal (Fase 4: POST/DELETE /clients/:id/access)
├── rutas/                     CRUD + scoping por cobrador + delete con check de clientes
├── productos/                 CRUD + Decimal para precioBase
├── creditos/                  crear/editar/anular + codigo por secuencia + recálculo de saldo
├── cobros/                    POST /collections con tx atómica + control de carrera + recibo embebido en la respuesta (Fase 4)
├── auth-cliente/              Fase 4: login/me/change-password del cliente final (3er rol JWT), lockout con incremento atómico
├── receipts/                  Fase 4: GET /payments/:pagoId/receipt — HTML server-rendered, scoping ADMIN/COBRADOR-de-la-ruta. Además `GET /r/:token` (`PublicReceiptsController`, `@Public()`): mismo HTML sin JWT, autorizado por el token firmado — es el enlace que se manda por WhatsApp
└── client-portal/              Fase 4: portal de solo lectura del cliente (credits, credits/:id, summary, payments/:pagoId/receipt)
```

**Patrón repository (sin interface abstracta):** cada módulo tiene una clase `@Injectable()` concreta (`ClientsRepository`, etc.) con `prisma` inyectado y métodos tipados. El **scoping por rol siempre lo arma el service**, no el repository — `clients.repository.ts:44-46` lo declara explícito: *"Capa de datos pura: solo Prisma, cero reglas de negocio, cero auth."* `receipts` y `client-portal` son la excepción documentada: sin repository, `PrismaService` directo (features de solo lectura que no comparten modelo de escritura).

**Patrón de guards (Fase 4 lo simplificó):** `APP_GUARD` global registra `ThrottlerGuard`, `JwtAuthGuard` y `RolesGuard` en `app.module.ts` — los controllers de staff ya NO declaran `@UseGuards(JwtAuthGuard, RolesGuard)` explícito, solo `@Roles(...)` donde aplica. `@Public()` marca los handlers que deben quedar fuera del JWT dentro de un controller mixto (hoy: `health.check`, `auth.login`, `client-auth.login`). `MustChangePasswordGuard` (no global, se aplica explícito) bloquea al `CLIENTE` con `mustChangePassword=true` en todo menos `POST /client-auth/change-password`.

**Manejo de errores:** sin `ExceptionFilter` global. Cada service mapea errores Prisma a HTTP en su `mapError`:
- `P2002` → `ConflictException` (unique constraint)
- `P2025` → `NotFoundException` o `BadRequestException` según contexto
- `P2003` (FK) → `ConflictException` (solo en `Rutas.remove`)
- Zod → `BadRequestException` con `result.error.issues` (pipe)

**Prisma v7 cambios importantes** (ver `specs/PLAN_DESARROLLO.md` §"stack" + `prisma/schema.prisma:8-10`):
- `PrismaClient` requiere driver adapter (`@prisma/adapter-pg` + `PrismaPg({ connectionString })`). El schema NO tiene `url` en `datasource` (Prisma 7 lo rechaza con `P1012`).
- Generator pinned a `provider = "prisma-client-js"` (clásico). El nuevo `"prisma-client"` emite `import.meta.url` (ESM-only) que rompe en runtime CJS.
- **`prisma.config.ts` DEBE estar en `apps/api` raíz**, no en `src/`. Si no, el CLI falla con "datasource.url is required" engañoso.
- Modelos actuales: `Usuario`, `Ruta`, `Cliente`, `ClientAdmin`, `Producto`, `Credito`, `Pago` + enums `Rol` (`ADMIN | COBRADOR | CLIENTE` — `CLIENTE` agregado en Fase 4), `EstadoCredito`, `FrecuenciaPago` (`DIARIO | SEMANAL | MENSUAL`). FKs de dinero (`Cliente.rutaId`, `Credito.cliente/producto`, `Pago.credito/cobrador`) son **`onDelete: Restrict`** (auditable). Solo `Ruta.cobradorId` es `SetNull` (cobrador borrado no debe borrar rutas).
- **`Cliente` (Fase 4):** `tokenAcceso` eliminado (ya no se usa); agregó `passwordHash String?`, `mustChangePassword Boolean`, `passwordExpiresAt DateTime?`, `failedLoginAttempts Int`, `lockedUntil DateTime?`, `lastLoginAt DateTime?` — acceso al portal por credenciales, no por token.
- Secuencia Postgres `credito_codigo_seq` (start 2000) para códigos `CR-XXXX` race-safe. **Gotcha:** `nextval` solo garantiza unicidad entre los códigos que emite ELLA. El seed inserta códigos a mano (`CR-2041`, `CR-2050`, `CR-2060`, `CR-2070`) en el mismo espacio numérico, así que la secuencia fue subiendo desde 2000 y al llegar a esos valores generó códigos ya existentes → `POST /credits` devolvía **409 "Conflicto generando código de crédito"** sin causa visible. Se detectó cuando `creditos.e2e-spec.ts` empujó la secuencia por esa zona. `prisma/seed.ts` ahora termina con `alinearSecuenciaDeCodigos()` (un `setval` que solo avanza, idempotente): todo código hardcodeado nuevo tiene que quedar por debajo de la secuencia.

### Next.js structure (`apps/web/src`)

Ver `apps/web/CLAUDE.md` para el detalle del front (FSD, design system, mock swap, etc.).

Resumen:
- App Router, Next 16 con Turbopack.
- `app/` = composición pura (server components que importan de `widgets`/`features`). Route-groups: `(admin)` (dark), `(collector)` (light + bottom tab), `(client)` (light — Fase 4: login, cambio de contraseña, lista de créditos, detalle), `dev/ui` (galería).
- `widgets/` = bloques compuestos (shells, login). `features/` = 10 features con `api/ + ui/` (Fase 4 agregó `client-auth`, `client-portal`, `receipts`). `entities/` = 3 (client, credit, session — `session` incluye el store separado del cliente, `client-session-store.ts`). `shared/` = api client, motion (GSAP), ui primitives (23 shadcn + variantes `on-time`/`late`/`missed` en `Badge`), icons, lib.
- `shared/api/client.ts` (`apiFetch` + `uploadFile`): base URL `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`). Token se pasa **explícitamente** en cada llamada (no interceptor) para mantener `shared` libre de imports de capas superiores.
- Patrón swap mock→real: `export const xxxService: XxxService = httpXxxService` en cada `*-service.ts`. Mocks siguen implementados. **Excepción actual:** `client-portal` sigue en `mockClientCreditService` (backend ya existe y está probado por e2e; el swap del front no se hizo en Fase 4).
- Zustand para sesión: `entities/session/model/session-store.ts` (staff, clave `session-storage`) y `client-session-store.ts` (cliente final, Fase 4, clave `client-session` — separado a propósito para que ambas sesiones convivan en el mismo navegador). Ambos con flag `hasHydrated` para evitar redirección prematura en SSR.
- TanStack Query para todo lo demás. Cada feature define `queryKeys` jerárquico y mutaciones invalidan con `<feature>Keys.all`. Sin `defaultOptions` (defaults v5).
- Validación en cliente: cada `apiFetch(path, schema, opts)` ejecuta `schema.parse(json)` con el MISMO schema Zod de `@repo/types`. Errores de shape lanzan `ZodError`.

**No hay** (intencionalmente hoy): `ExceptionFilter`, interceptors de logging, Swagger/OpenAPI, cron jobs, optimistic updates, test runner en front. **Rate limiting sí existe** desde Fase 4 (`@nestjs/throttler`, backend — ver Architecture arriba).

Puertos: web 3000, api 3001 (defaults Nest/Next, override por `PORT`/`WEB_ORIGIN`/`NEXT_PUBLIC_API_URL`).
