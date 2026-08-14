# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Estado actual (Fases 5 y 5.5 cerradas; Fase 6 planificada).** Fases 0, 0.5, 1, 2, 3, 4, 5 y 5.5 están implementadas y verificadas end-to-end con la API real. Falta 6. Detalle exhaustivo y decisiones de implementación en `specs/ESTADO_ACTUAL.md`; spec original en `specs/PLAN_DESARROLLO.md`. Fase 4 desglosada (18 sub-fases) en `specs/FASE_4_SUBFASES.md`; Fase 5 (10 sub-fases) en `specs/FASE_5_SUBFASES.md`; Fase 5.5 (8 sub-fases, front transversal) en `specs/FASE_5.5_SUBFASES.md`.

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
| **4** Recibos + portal Cliente | Recibo PDF on-demand (`pdfkit`; nació HTML server-rendered, migrado después) + `auth-cliente` (3er rol JWT) + `client-portal` + `MustChangePasswordGuard` + `@Public()`/`APP_GUARD` global + `@nestjs/throttler` + acciones staff (`/clients/:id/access`) + pantalla nueva "Mis créditos" | ✅ (18/18 sub-fases, `FASE_4_SUBFASES.md`) |
| **5** Cierre diario + dashboard | `DailyClosure` Prisma (snapshot inmutable) + módulo `daily-closures` (preview + cerrar tx atómica + materializa MORA + PDF on-demand `pdfkit`) + módulo `dashboard` (agregaciones) + cron opcional `@nestjs/schedule` (apagado por default) + 4 pantallas nuevas (`#19c #12c #13c #2b`, `#19c` con espejo Admin en `/admin/routes-collectors/:id/close`) | ✅ (10/10 sub-fases, `FASE_5_SUBFASES.md`) |
| **5.5** Design system: dos modos + UX | Tokens `-strong` (WCAG AA en claro) + motor de tema por superficie sin FOUC (`shared/theme`) + selector Claro/Oscuro/Sistema en Admin y Cobrador + kit de estados (`EmptyState`/`ErrorState`/`NotFoundState`/`InlineNote`/`Spinner`/skeletons compuestos) + 8 boundaries de ruta + movimiento de marca (shimmer, anillo que avanza, press, transición de página) | ✅ (8/8 sub-fases, `FASE_5.5_SUBFASES.md`) |
| **6** Hardening + tests | Unit tests + filtros globales + auditoria + CI | ⬜ |

**Tests hoy:** 142 casos e2e en 16 suites de `apps/api/test/` (`app`, `auth`, `clientes`, `clientes-foto`, `rutas`, `usuarios`, `auth-cliente`, `client-portal`, `receipts`, `clientes-access`, `client-sharing`, `multi-tenancy`, `cobros`, `creditos`, `daily-closures`, `dashboard`) + 79 unit tests (`core/domain/payment-schedule.util.spec.ts` 35 + `core/contracts/repo-types-integrity.spec.ts` 5 + `core/domain/day-boundary.util.spec.ts` 11 + `core/domain/daily-closure.util.spec.ts` 19 + `modules/receipts/receipt-pdf.spec.ts` 9). Cero tests en front.

**Gotcha al correr e2e: el `--` de pnpm se come los flags de jest.** `test:e2e` ya termina en `--runInBand`, así que `pnpm --filter api test:e2e -- --testTimeout=40000` NO pasa un flag — jest lee todo lo que va después del `--` como **patrón de ruta** (por eso `-- receipts.e2e-spec` sí funciona como filtro, y `-t "…"` no funciona en absoluto). Importa porque varias suites hacen fixtures pesados contra el pooler de Supabase y se pasan del **timeout default de 5s de Jest**, que ninguna suite sobreescribe: fallan con "Exceeded timeout of 5000 ms" en el `createCliente()` del setup, sin haber llegado a la aserción, y parece un bug del endpoint. Para correrlas de verdad hay que invocar jest directo: `npx jest --config ./test/jest-e2e.json --runInBand --testTimeout=40000` desde `apps/api`. Con eso las 16 suites pasan; con 5s fallan ~3-5 tests de `client-portal` de forma intermitente.

**Bajas: qué se borra de verdad.** `Cliente` (relación `ClientAdmin.activo=false`) y `Usuario`/cobrador (`activo=false` + sus rutas quedan sin cobrador) son **soft-delete** — `Pago.cobradorId` y las FKs de dinero son `onDelete: Restrict` y la auditoría manda. `Ruta` es el **único borrado físico**, y solo si no le quedan clientes activos (409 en caso contrario). El login filtra por `activo`, que es lo que hace que la baja del cobrador signifique algo; sin eso el switch activo/inactivo era decorativo. Limitación conocida: `JwtAuthGuard` es stateless, así que un token ya emitido sigue válido hasta `JWT_EXPIRES_IN` (1d) — verificar `activo` por request es Fase 6.

**Volver a dar de alta a un cliente dado de baja = reactivación, no alta nueva.** `Cliente.documento` es `@unique` **global** y la baja es lógica, así que la fila sobrevive: registrar otra vez a la misma persona chocaba con el índice y devolvía `409 "Ya existe un cliente con ese documento"`. Era un callejón sin salida — el cliente inactivo tampoco aparece en `GET /clients` (filtra por `activo`), así que no había forma de recuperarlo *ni* de volver a crearlo. `POST /clients` ahora mira el documento antes de insertar (`ClientsRepository.findByDocumento`, sin filtro `activo` ni scoping) y distingue tres casos que antes eran el mismo 409: documento libre → alta normal; **cliente mío inactivo → reactiva** (`ClientAdmin.activo=true`, pisa los datos con los del alta y responde `reactivado: true`); cliente mío activo o de otra cartera → 409 como siempre. Al reactivar **vuelven sus créditos y su historial de pagos** — nunca se borraron, `Credito`/`Pago` son `onDelete: Restrict` justamente para que dar de baja a alguien no haga desaparecer plata —, y por eso el front lo anuncia distinto ("Cliente reactivado") en vez de como un alta limpia. Vincular un cliente existente a un **segundo** admin sigue siendo una acción explícita que no existe todavía.

**Un pago mal registrado se anula, nunca se edita ni se borra.** Mismo principio que anular un crédito, un nivel más abajo. `Pago` ganó `anulado Boolean`, `anuladoAt DateTime?`, `anuladoPorId String?` (`onDelete: Restrict`, igual que `cobradorId` — no se puede perder el rastro de quién anuló qué). `DELETE /collections/:pagoId` (transacción atómica, mismo `updateMany` condicional que el cobro) marca el pago, **devuelve el saldo al crédito**, y si ese pago lo había dejado `PAGADO`, lo reabre a `ACTIVO`. Corregir un monto o una fecha mal cobrados es: anular + registrar el cobro correcto con `POST /collections` de siempre — no hace falta matemática especial, y el crédito conserva su código y su historial completo. El historial (`buildPaymentHistory`) excluye los pagos anulados del cronograma (el período que ocupaban vuelve a verse pendiente) y los muestra aparte, al final, como fila de auditoría con `numeroCuota: 0` y `estado: "ANULADO"` — nunca desaparecen. `soloPagosReales` (front, `entities/payment/lib/payment-history.ts`) los excluye también de "Cobrado hoy": sin eso, anular un pago de hoy devolvía el saldo pero el banner seguía mostrando la plata como cobrada.

**Editar un crédito con pagos ya registrados — solo ADMIN, ahora permitido.** Antes `PATCH /credits/:id` rechazaba con 409 cualquier edición si el crédito tenía pagos; hoy lo permite para ADMIN (COBRADOR sigue bloqueado con pagos, sin pagos pueden ambos como siempre) y recalcula `saldoPendiente = montoTotal nuevo − lo ya pagado`, rechazando con 400 si el nuevo total queda por debajo de lo que el cliente ya pagó. Es una herramienta distinta de "anular pago": corrige los **términos** del crédito (monto, interés, cuotas, frecuencia), no un cobro puntual. No reemplaza un refinanciamiento formal — hoy no queda ningún rastro de que los términos cambiaron a mitad de camino, es una decisión pendiente de discutir si se necesita.

**Baja permanente de cobrador — solo si nunca cobró nada.** `DELETE /users/:id/permanent` borra la fila de verdad (a diferencia de `DELETE /users/:id`, que solo desactiva). Es posible únicamente cuando `Pago.cobradorId` no tiene ninguna fila para ese cobrador — la FK es `Restrict`, así que no hay forma de saltarlo ni con un query directo. `CobradorListItem.pagosCount` es lo que el front usa para deshabilitar el botón de antemano con el motivo a la vista, en vez de dejar que falle después.

**El login del portal ahora exige al menos una relación `ClientAdmin` activa.** Antes, dar de baja a un cliente no le cerraba el acceso si ya tenía `passwordHash`: el login solo miraba la contraseña, nunca la relación con el admin. Un cliente compartido por varios admins (`ClientAdmin[]`) conserva el acceso mientras a alguno le siga siendo cartera activa — la baja es por relación, no un interruptor único del cliente. Mismo límite ya conocido para tokens de staff: si el cliente ya tenía una sesión abierta cuando lo diste de baja, ese token sigue sirviendo hasta que expira (stateless, Fase 6 lo cierra).

**"Historial" en los créditos del cliente = solo terminados.** `AdminClientCreditsScreen`/`ClientPaymentsScreen` mezclaban ahí cualquier crédito con al menos un pago, incluidos los que seguían `ACTIVO` — un crédito en curso aparecía en las dos pestañas a la vez. Ahora esa pestaña sale directo de `cliente.creditosHistorial` (que el backend ya separa como "no `ACTIVO`/`MORA`"), sin mezclar.

**El cierre diario es un snapshot inmutable, nunca se recalcula.** `DailyClosure` congela `totalCollected`/`collectedCount`/`newCredits`/`newCreditsAmount`/`productsSold`/`unpaidClients`/`paidClients` (JSON) en el momento de cerrar (`POST /daily-closures/:routeId`); el histórico (`GET /daily-closures`, `GET /daily-closures/:id`) **lee lo persistido**, no vuelve a sumar `Pago`/`Credito` — es un libro contable, no una vista derivada. `@@unique([routeId, date])` es la idempotencia real (la garantiza Postgres con P2002→409, no un chequeo en JS): un día no se cierra dos veces. Cerrar es una única transacción (`$transaction`) que hace DOS cosas o ninguna: 1) `INSERT DailyClosure`, 2) `updateMany` condicional (`estado: "ACTIVO"` en el WHERE) que materializa `Credito.estado = MORA` para los créditos con una cuota `DEFAULTED` — antes la MORA se derivaba en cada lectura (`payment-schedule.util.ts`), ahora el cierre la persiste de una vez y el resto de la app (rollup de cliente, dashboard) simplemente la lee. `paidClients` es el espejo de `unpaidClients` para el otro lado ("quién sí pagó, con qué número de cuota") — una fila por PAGO, no por cliente (alguien puede pagar más de una cuota el mismo día). `null` en cierres de antes de que este campo existiera (columna nueva, nunca se recalcula hacia atrás), distinto de `[]` ("nadie pagó ese día").

**Cerrar la ruta NO bloquea nuevos cobros — y un cobro tardío no se pierde.** `POST /collections` no tiene ningún chequeo contra `DailyClosure`; se puede seguir cobrando toda la noche después de cerrar. El "período" que cuenta un cierre ya no es el día calendario fijo — es **desde el `createdAt` del último cierre de la ruta** (o desde medianoche si nunca se cerró antes), vía `periodStart` en `computeClosureSummary`. Antes, un cobro registrado después de cerrar hoy (mismo día calendario) no quedaba en NINGÚN cierre: no en el de hoy (ya congelado) ni en el de mañana (que solo miraba pagos de mañana) — el dinero sí se contabilizaba bien en el crédito del cliente, pero desaparecía de cualquier reporte de caja. Ahora ese cobro entra en el PRÓXIMO cierre que se haga, sea al otro día o varios días después si la ruta queda sin cerrar un tiempo. `daily-closures.repository.ts:findLastClosure` resuelve el punto de partida; `core/domain/daily-closure.util.ts` tiene el detalle y `daily-closure.util.spec.ts` la prueba con el escenario completo (cierre de hoy sin el pago → pago llega tarde → cierre de mañana lo recupera).

**El "día contable" vive en UN SOLO punto: `core/domain/day-boundary.util.ts` + `core/reports/closure-policy.ts` (`CLOSURE_TIMEZONE = "America/Bogota"`).** `Pago.fecha` se guarda en UTC; un cobro a las 23:30 hora Bogotá (04:30 UTC del día siguiente) tiene que caer en el día local correcto. `dayRange(date, tz)` da el rango `[start, end)` en UTC para filtrar pagos; `startOfLocalDay` da el instante UTC que se persiste en la columna `date` (`@db.Date`) del cierre. Sin librería de zonas horarias — usa el truco estándar de comparar cómo `Intl.DateTimeFormat` lee un instante "ingenuo" contra el instante real. Gotcha aparte: un valor `@db.Date` ya leído de Postgres es un día calendario puro (Prisma lo devuelve como medianoche UTC), así que compararlo contra "hoy" es lectura directa en UTC (`utcDateKey`), **nunca** una segunda conversión de zona horaria — `isRouteClosedOn` (`core/domain/daily-closure.util.ts`) es el predicado compartido que hace esto bien una sola vez, y lo reusan `daily-closures`, `dashboard` y `rutas`.

**El recibo es un PDF, y esa es la ÚNICA representación — no hay plantilla HTML.** Hasta acá el recibo era HTML server-rendered (`buildReceiptHtml` en `receipts.service.ts`) y "descargar" era print-to-PDF del navegador. Se reemplazó entero por `receipt-pdf.ts` (`pdfkit`, función pura, mismo patrón que `closure-pdf.ts`), y los **tres** endpoints migraron a la vez — staff, portal del cliente y el enlace público `/r/:token` — precisamente para no quedar con dos plantillas que se desincronizan. Se borró la plantilla HTML y también `apps/web/src/shared/lib/print.ts` (el iframe fuera de pantalla con rama para iOS Safari), así que hoy hay **menos** piezas que antes, no más.

- **Formato ticket (~80mm de ancho), no A4.** El recibo se abre en el teléfono del cliente desde WhatsApp: el visor ajusta al ancho, así que una página angosta se lee sin zoom mientras que una A4 obliga a hacer pinch.
- **El alto de página se MIDE, no se estima.** `pdfkit` exige el tamaño al construir el documento, antes de saber cuánto ocupa el contenido. La versión con constante (`BASE + nºCuotas × altoFila`) se desbordaba a dos páginas; hoy `measureHeight` dibuja una primera pasada sobre un lienzo altísimo solo para leer dónde quedó el cursor. **`HEIGHT_EPSILON` no es decorativo:** sin esos 2pt de holgura, `maxY` cae exactamente en el pie de la última línea y la comparación de salto de página de pdfkit (`y + altoLínea > maxY`, en floats) da `true` por redondeo — `385.44000000000005 > 385.43999999999994` — y mete una página entera para una línea. `receipt-pdf.spec.ts` fija "una sola página" en cinco escenarios; fue el test que atrapó el bug.
- **Todo lo del recibo se calcula AL MOMENTO DEL PAGO, nunca "a hoy".** `numeroCuota`, `cuotasPagadas`, `cuotasRestantes` y `cuotasPagadasDetalle` salen de `buildReceiptProgress`, que corta `buildPaymentHistory` en ese pago y descarta lo posterior. Es la misma disciplina que ya tenía `saldoRestante` (suma de vuelta los pagos posteriores en vez de leer el saldo actual): el enlace público dura 90 días, y un comprobante que se contradice al reabrirlo —"cuota 18 de 20" arriba, el saldo de la cuota 5 abajo— no sirve como comprobante.
- **Los campos nuevos del contrato nacen con `.default(...)`** (lector tolerante, ver más abajo): `credito.capital/interes/montoTotal/cuotaValor/cuotas/frecuencia` y los cuatro de progreso.
- **El iframe del recibo ya NO lleva `sandbox`.** Era el fix de FE-SEC-1 y existía porque el recibo era HTML con campos del cliente interpolados. Con un PDF no hay markup que inyectar, y sandboxear haría daño real: el visor de Firefox es pdf.js (o sea JavaScript), así que sin `allow-scripts` el recibo sale en blanco, y `allow-scripts` a secas fuerza un origen opaco que rompe la carga del `blob:`.

**PDF del cierre: on-demand con `pdfkit`, nunca en Storage.** `GET /daily-closures/:id/pdf` genera los bytes al vuelo desde el snapshot ya cargado (`closure-pdf.ts`, función pura) y los sirve como `StreamableFile` — la única fuente de verdad sigue siendo la fila `DailyClosure`, no un archivo aparte que se puede desincronizar. El front no puede pedirlo con un `<a href>` directo (la ruta exige JWT): descarga como `Blob` (`apiFetchBlob`) y dispara un `<a download>` con `URL.createObjectURL` (`shared/lib/download-blob.ts`).

**Cierre automático apagado por default.** `@nestjs/schedule` corre `daily-closures.cron.ts` a las 22:00 hora Bogotá, pero solo actúa si `DAILY_CLOSURE_CRON_ENABLED=true` — el chequeo vive DENTRO del handler, no condiciona si `ScheduleModule.forRoot()` se registra. Cierra con `closedById: null` (distingue "automático" de "manual" en el histórico) y reutiliza la misma transacción que el cierre manual; un P2002 (la ruta ya se cerró a mano un segundo antes) se captura como no-op.

**Gotcha real: `z.coerce.boolean()` NUNCA para un booleano leído de `.env`.** `DAILY_CLOSURE_CRON_ENABLED: z.coerce.boolean().default(false)` parecía correcto pero `z.coerce.boolean()` coerciona con `Boolean(valor)` — y `Boolean("false")` es `true`, porque cualquier string no vacío es *truthy*. Con `DAILY_CLOSURE_CRON_ENABLED=false` tal cual en `.env`, el cron corrió igual. Pasó de verdad: cerró las 6 rutas locales una madrugada con $0 en cobros, sin que nadie lo pidiera. `env.schema.ts` ahora usa `z.enum(["true","false"]).default("false").transform(v => v === "true")` — explícito sobre qué strings acepta, sin el `Boolean(...)` implícito. Si se agrega otro booleano de `.env` en el futuro, mismo patrón, nunca `z.coerce.boolean()`.

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
| DELETE | `/users/:id/permanent` | Jwt + Roles | ADMIN — baja **permanente** (borra la fila); 409 si tiene algún `Pago` en su historia (`Pago.cobradorId` es `Restrict`, no hay forma de saltarlo) |
| GET | `/clients` | Jwt + Roles | ADMIN/COBRADOR, scoping por rol |
| GET | `/clients/summary` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| GET | `/clients/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| POST | `/clients` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| PATCH | `/clients/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping |
| DELETE | `/clients/:id` | Jwt + Roles | ADMIN (soft-delete) |
| POST | `/clients/:id/reactivate` | Jwt + Roles | ADMIN — reactivación **directa** desde "Clientes inactivos" (solo voltea `ClientAdmin.activo=true`, no pisa datos); distinta de la reactivación automática de `POST /clients` con el mismo documento |
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
| DELETE | `/collections/:pagoId` | Jwt + Roles | ADMIN/COBRADOR, scoping — **anula** un pago mal registrado (nunca lo edita ni lo borra): devuelve el saldo al crédito, reabre a `ACTIVO` si estaba `PAGADO` por ese pago, 409 si ya estaba anulado. Corregir = anular + registrar el cobro correcto |
| POST | `/clients/:id/access` | Jwt + Roles + scoping | ADMIN/COBRADOR de la ruta — genera/resetea password temporal |
| DELETE | `/clients/:id/access` | Jwt + Roles + scoping | ADMIN/COBRADOR de la ruta — revoca acceso |
| POST | `/client-auth/login` | `@Public()` + Throttle(5/min) | público (rol se emite en el JWT) |
| GET | `/client-auth/me` | Jwt + Roles + MustChangePassword | CLIENTE |
| POST | `/client-auth/change-password` | Jwt + Roles | CLIENTE (sin `MustChangePasswordGuard` — es la salida del lockout) |
| GET | `/payments/:pagoId/receipt` | Jwt + Roles | ADMIN/COBRADOR de la ruta del cliente — recibo en **PDF** (`application/pdf`, `inline`), generado on-demand con `pdfkit` |
| GET | `/payments/:pagoId` | Jwt + Roles | ADMIN/COBRADOR de la ruta del cliente — mismo recibo en **JSON** (`Receipt`). Lo usa `ReceiptScreen` para armar el mensaje de WhatsApp justo después de cobrar, cuando solo tiene el `pagoId` y no el `CobroResponse` completo |
| GET | `/r/:token` | `@Public()` + Throttle(30/min) | público — el mismo **PDF** por enlace firmado (capability URL); el token ES la autorización |
| GET | `/client-portal/credits` | Jwt + Roles + MustChangePassword | CLIENTE, scoping por `clienteId` |
| GET | `/client-portal/credits/:id` | ídem | 404 si el crédito es de otro cliente |
| GET | `/client-portal/summary` | ídem | agregado del cliente autenticado |
| GET | `/client-portal/payments/:pagoId/receipt` | ídem | recibo propio (**PDF**, mismo `buildReceiptPdf` que el staff), 404 si es ajeno |
| GET | `/daily-closures/preview/:routeId` | Jwt + Roles | ADMIN/COBRADOR, scoping — resumen en vivo del día actual, **no persiste** |
| POST | `/daily-closures/:routeId` | Jwt + Roles | ADMIN/COBRADOR, scoping, tx atómica — cierra la ruta para HOY; recierre de `(ruta, hoy)` → 409 |
| GET | `/daily-closures` | Jwt + Roles | ADMIN/COBRADOR, scoping — histórico con filtros `routeId?`/`from?`/`to?` |
| GET | `/daily-closures/:id` | Jwt + Roles | ADMIN/COBRADOR, scoping — detalle del snapshot (con `unpaidClients`), nunca recalcula |
| GET | `/daily-closures/:id/pdf` | Jwt + Roles | ADMIN/COBRADOR, scoping — PDF `application/pdf` generado on-demand con `pdfkit`, sin tocar Storage |
| GET | `/dashboard/summary` | Jwt + Roles | ADMIN — agregaciones Prisma (`_sum`/`count`/`groupBy`-equivalente), `weeklyCollections` con 7 puntos (rellena días sin pagos con 0) |

**Mock vs real:** todos los features, incluidos `client-portal` (Fase 4) y `closures`/`dashboard` (Fase 5), están conectados a `httpXxxService`. Los `mockXxxService` siguen implementados (no se borraron) — el swap se hace cambiando una constante en cada `*-service.ts`. `cobros` no tiene mock útil: `mockCobrosService.registrarCobro` solo lanza errores para validar el camino de rollback; `mockClosuresService.getPdfBlob` tampoco (`pdfkit` es server-only, no tiene sentido mockearlo en el navegador).

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
pnpm --filter api test           # jest unit tests (65: payment-schedule.util 35 + repo-types-integrity 5 + day-boundary.util 11 + daily-closure.util 14)
pnpm --filter api test:e2e       # jest --config ./test/jest-e2e.json --runInBand (serial: ver gotcha abajo)
pnpm --filter api test:e2e -- -t "auth"
pnpm --filter api db:generate    # prisma generate (corre en postinstall también)
pnpm --filter api db:seed        # ts-node prisma/seed.ts — demo data idempotente
```

Sin test runner en `apps/web` aún (lo decide Fase 6).

### Local env setup

`apps/api/.env` (gitignored; copiar de `apps/api/.env.example`): `PORT`, `WEB_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET`, `PUBLIC_APP_URL` (Fase 4, default `http://localhost:3001` — URL del back para el enlace del recibo), `DAILY_CLOSURE_CRON_ENABLED` (Fase 5, default `false` — cierre automático de rutas por cron, apagado salvo que se pida explícito). Validados al boot con Zod (`apps/api/src/core/config/env.schema.ts`) vía `ConfigModule.forRoot({ validate })` — falla limpio si falta alguno. `NODE_ENV` también se valida pero **no está en `.env.example`** (agregar si se necesita explícito).

**Gotcha Supabase:** el host "Direct connection" (`db.<project>.supabase.co`) es IPv6-only y rompe con `ENETUNREACH` en WSL/sandboxes. Usar el **connection pooler** (dashboard → Connect → "Transaction/Session pooler"), IPv4-compatible. En `.env` actual del repo ya se usa el pooler.

**Resuelto — `SUPABASE_SERVICE_KEY`:** el `.env` actual **sí es la `service_role`** (JWT `eyJ...`, claim `role: "service_role"` verificado). El gotcha que documentaba esto como pendiente (clave con prefijo `sb_publishable_…`) quedó obsoleto — en algún momento se corrigió sin actualizar la doc. Lo que sí faltaba de verdad era el **bucket**: `SUPABASE_STORAGE_BUCKET="documentos"` no existía en el proyecto (0 objetos en todo el Storage, ninguna foto se subió jamás). Se creó como **privado** — ver "Foto de documento" más abajo.

**Gotcha e2e + connection pooler:** `test:e2e` corre con `--runInBand`. Con 16 archivos de e2e, Jest en paralelo (default) agota el pool de Supabase (`pool_size: 15` en modo sesión) — cada archivo abre su propio `PrismaClient` directo para fixtures, más el que abre cada test individual vía `Test.createTestingModule`. En serie no hay contención.

**Gotcha e2e + login del cliente: la fixture necesita `ClientAdmin`, no solo `passwordHash`.** Desde que el login del portal exige "al menos una relación `ClientAdmin` activa" (ver más arriba), un `prisma.cliente.create({...})` sin `admins: { create: { adminId, activo: true } }` crea un cliente que **nunca puede loguear**, sin importar que la contraseña esté bien — `POST /client-auth/login` responde 401 "Documento o contraseña incorrectos" para cualquier intento. Pasó de verdad: `auth-cliente.e2e-spec.ts` y `client-portal.e2e-spec.ts` quedaron con esa fixture desactualizada de antes de que existiera esa regla (10 tests fallando, 401 en cascada) hasta que se les agregó la relación.

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
app.module.ts                  imports ConfigModule, PrismaModule, CoreAuthModule, StorageModule, ThrottlerModule, ScheduleModule (Fase 5), 12 feature modules; APP_GUARD global: ThrottlerGuard, JwtAuthGuard, RolesGuard
core/
├── config/env.schema.ts       Zod schema + validateEnv()
├── prisma/                    PrismaService (driver-adapter pattern) + PrismaModule (@Global)
├── auth/                      CoreAuthModule (@Global): JwtModule, JwtAuthGuard, RolesGuard, MustChangePasswordGuard, @Public, @Roles, @CurrentUser, AuthenticatedUser
├── security/                  lockout-policy.ts (Fase 4): MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES, TEMPORARY_PASSWORD_EXPIRY_HOURS
├── receipts/                  ReceiptTokenService — firma/verifica el token del enlace público del recibo (claim `typ: "receipt"`, 90d). Provisto por CoreAuthModule (@Global) porque lo usan 4 features
├── reports/                   Fase 5: closure-policy.ts — CLOSURE_TIMEZONE ("America/Bogota"), DAILY_CLOSURE_CRON (cron string). Único lugar con la zona horaria hardcodeada
├── storage/                   StorageService (Supabase client + upload a bucket público)
├── contracts/                 repo-types-integrity.spec.ts — guardia anti-import-circular de @repo/types (ver el gotcha arriba)
├── pipes/                     ZodValidationPipe, ImageFileValidationPipe (5MB, JPEG/PNG/WebP)
└── domain/                    helpers cross-feature, cero I/O: rollupEstadoCliente, mapCreditoListItem, computeAvanceDelDia (Fase 5, compartido rutas/dashboard), buildReciboCodigo (Fase 4), buildPaymentHistory/computeProximaFechaCuota/fechaVencimientoCuota/cuotasVencidasAlDia, route-access.util.ts (Fase 5: assertRouteAccess/assertRouteOwnership, compartido clientes/cobros/daily-closures), day-boundary.util.ts (Fase 5: dayRange/startOfLocalDay/localDateKey/utcDateKey, sin librería de timezone), daily-closure.util.ts (Fase 5: computeClosureSummary/isRouteClosedOn) — todos con unit tests, único punto donde varias features comparten lógica sin acoplarse
modules/
├── auth/                      login, /me, /admin-only (referencia mínima)
├── health/                    GET /health (referencia mínima, query en vivo)
├── usuarios/                  CRUD ADMIN sobre Usuario (lista filtra COBRADOR por default)
├── clientes/                  CRUD + summary + upload foto doc (multipart) + soft-delete + acceso al portal (Fase 4: POST/DELETE /clients/:id/access)
├── rutas/                     CRUD + scoping por cobrador + delete con check de clientes + estadoDia/cierres/enMora reales (Fase 5, ver abajo)
├── productos/                 CRUD + Decimal para precioBase
├── creditos/                  crear/editar/anular + codigo por secuencia + recálculo de saldo
├── cobros/                    POST /collections con tx atómica + control de carrera + recibo embebido en la respuesta (Fase 4)
├── auth-cliente/              Fase 4: login/me/change-password del cliente final (3er rol JWT), lockout con incremento atómico
├── receipts/                  Fase 4: GET /payments/:pagoId/receipt — **PDF** on-demand (`receipt-pdf.ts`, `pdfkit`, función pura como `closure-pdf.ts`), scoping ADMIN/COBRADOR-de-la-ruta. Además `GET /r/:token` (`PublicReceiptsController`, `@Public()`): el mismo PDF sin JWT, autorizado por el token firmado — es el enlace que se manda por WhatsApp
├── client-portal/             Fase 4: portal de solo lectura del cliente (credits, credits/:id, summary, payments/:pagoId/receipt)
├── daily-closures/            Fase 5: preview (en vivo, no persiste) + cerrar (tx atómica: snapshot + materializa MORA) + lista/detalle/pdf del histórico + cron opcional (daily-closures.cron.ts, apagado por default). closure-pdf.ts aislado (función pura, pdfkit) — swappear a puppeteer en Fase 6 no debería tocar el service
└── dashboard/                  Fase 5: GET /dashboard/summary (ADMIN-only), sin repository — agregaciones Prisma directas, como receipts/client-portal
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
- Modelos actuales: `Usuario`, `Ruta`, `Cliente`, `ClientAdmin`, `Producto`, `Credito`, `Pago`, `DailyClosure` (Fase 5) + enums `Rol` (`ADMIN | COBRADOR | CLIENTE` — `CLIENTE` agregado en Fase 4), `EstadoCredito`, `FrecuenciaPago` (`DIARIO | SEMANAL | MENSUAL`), `ClosureStatus` (Fase 5: `OPEN | CLOSED` — el MVP solo persiste `CLOSED`, "día abierto" es la ausencia de cierre). FKs de dinero (`Cliente.rutaId`, `Credito.cliente/producto`, `Pago.credito/cobrador`, `DailyClosure.routeId`) son **`onDelete: Restrict`** (auditable). Solo `Ruta.cobradorId` y `DailyClosure.closedById` son `SetNull` (borrar un cobrador no debe borrar rutas ni perder el histórico de cierres, solo su autoría).
- **`DailyClosure` (Fase 5):** `@@unique([routeId, date])` es la idempotencia del cierre a nivel de base (P2002 → 409, no un chequeo en JS). `unpaidClients`/`paidClients` son `Json` (snapshot congelado, nunca se recalcula) — `paidClients` es `Json?` (nullable: cierres de antes de que existiera este campo quedan en `null`, no se backfillean); `unpaidCount`/`collectedCount` la denormalizan para el histórico sin parsear JSON. `date` es `@db.Date` (día calendario puro, sin hora ni zona horaria).
- **`Cliente` (Fase 4):** `tokenAcceso` eliminado (ya no se usa); agregó `passwordHash String?`, `mustChangePassword Boolean`, `passwordExpiresAt DateTime?`, `failedLoginAttempts Int`, `lockedUntil DateTime?`, `lastLoginAt DateTime?` — acceso al portal por credenciales, no por token.
- **`Pago` (post-Fase-4):** agregó `anulado Boolean @default(false)`, `anuladoAt DateTime?`, `anuladoPorId String?` (`onDelete: Restrict`, relación `"PagoAnuladoPor"` hacia `Usuario`) — ver "Un pago mal registrado se anula" arriba.
- Secuencia Postgres `credito_codigo_seq` (start 2000) para códigos `CR-XXXX` race-safe. **Gotcha:** `nextval` solo garantiza unicidad entre los códigos que emite ELLA. El seed inserta códigos a mano (`CR-2041`, `CR-2050`, `CR-2060`, `CR-2070`) en el mismo espacio numérico, así que la secuencia fue subiendo desde 2000 y al llegar a esos valores generó códigos ya existentes → `POST /credits` devolvía **409 "Conflicto generando código de crédito"** sin causa visible. Se detectó cuando `creditos.e2e-spec.ts` empujó la secuencia por esa zona. `prisma/seed.ts` ahora termina con `alinearSecuenciaDeCodigos()` (un `setval` que solo avanza, idempotente): todo código hardcodeado nuevo tiene que quedar por debajo de la secuencia.

### Next.js structure (`apps/web/src`)

Ver `apps/web/CLAUDE.md` para el detalle del front (FSD, design system, mock swap, etc.).

Resumen:
- App Router, Next 16 con Turbopack.
- `app/` = composición pura (server components que importan de `widgets`/`features`). Route-groups: `(admin)` (dark), `(collector)` (light + bottom tab), `(client)` (light — Fase 4: login, cambio de contraseña, lista de créditos, detalle), `dev/ui` (galería).
- `widgets/` = bloques compuestos (shells, login). `features/` = 12 features con `api/ + ui/` (Fase 4 agregó `client-auth`, `client-portal`, `receipts`; Fase 5 agregó `closures` y `dashboard`). `entities/` = 3 (client, credit, session — `session` incluye el store separado del cliente, `client-session-store.ts`). `shared/` = api client, motion (GSAP), ui primitives (23 shadcn + variantes `on-time`/`late`/`missed` en `Badge`), icons, lib.
- `shared/api/client.ts` (`apiFetch` + `uploadFile` + `apiFetchBlob`, Fase 5): base URL `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`). Token se pasa **explícitamente** en cada llamada (no interceptor) para mantener `shared` libre de imports de capas superiores. `apiFetchBlob` es la variante binaria (el PDF del cierre): mismo manejo de errores que `apiFetch`, pero `res.blob()` en vez de `res.json()` — no hay schema de Zod que validar sobre bytes.
- Patrón swap mock→real: `export const xxxService: XxxService = httpXxxService` en cada `*-service.ts`. Mocks siguen implementados. `client-portal` también está en `httpClientCreditService` — el swap se activó tras la auditoría post-Fase 4. `closures`/`dashboard` (Fase 5) swapearon en 5.10; `mockClosuresService.getPdfBlob` lanza (mismo criterio que `mockCobrosService.registrarCobro`: no tiene sentido mockear algo que solo corre en el server).
- Zustand para sesión: `entities/session/model/session-store.ts` (staff, clave `session-storage`) y `client-session-store.ts` (cliente final, Fase 4, clave `client-session` — separado a propósito para que ambas sesiones convivan en el mismo navegador). Ambos con flag `hasHydrated` para evitar redirección prematura en SSR.
- TanStack Query para todo lo demás. Cada feature define `queryKeys` jerárquico y mutaciones invalidan con `<feature>Keys.all`. Sin `defaultOptions` (defaults v5). Cerrar una ruta (`useCloseRoute`) invalida `closuresKeys.all` + `["rutas"]` + `["dashboard"]` con claves crudas (no imports de `routes-collectors`/`dashboard` — mismo criterio que `use-cobros.ts`, evita acoplamiento horizontal entre features).
- Validación en cliente: cada `apiFetch(path, schema, opts)` ejecuta `schema.parse(json)` con el MISMO schema Zod de `@repo/types`. Errores de shape lanzan `ZodError`.
- `recharts` (Fase 5, único gráfico de la app): `WeeklyChart.tsx` (dashboard admin), aislado del resto del componente. Respeta `prefers-reduced-motion` desactivando la animación de entrada de las barras.

**Modo de color: elegible en Admin y Cobrador (Fase 5.5).** Los defaults de `DESIGN_SYSTEM.md` §0 no cambian (Admin oscuro, Cobrador y Cliente claro), pero Admin y Cobrador tienen selector Claro/Oscuro/**Sistema** con la preferencia guardada **por superficie** — el Admin puede quedar oscuro y el Cobrador claro a la vez, que es coherente con que sus defaults difieran por contexto de uso (oficina vs. calle bajo sol). La clase `dark` vive solo en `<html>` y la escribe un script inline en el `<head>` antes del primer paint (patrón de Next 16); `shared/ui/surface-mode.tsx` se borró. **Habilitar el modo claro obligó a arreglar la paleta primero:** `accent`/`success`/`warning` como texto daban 2.1–2.6:1 sobre fondo claro y `Badge` los usa en sus seis estados, así que nacieron los tokens `-strong` (`--X` para fondos y trazos, `--X-strong` para texto e íconos). Detalle en `specs/FASE_5.5_SUBFASES.md` y `specs/DESIGN_SYSTEM.md` §1.1.

**No hay** (intencionalmente hoy): `ExceptionFilter`, interceptors de logging, Swagger/OpenAPI, optimistic updates, test runner en front. **Rate limiting** existe desde Fase 4 (`@nestjs/throttler`, backend). **Cron jobs** existen desde Fase 5 (`@nestjs/schedule`, cierre automático de rutas) pero **apagados por default** (`DAILY_CLOSURE_CRON_ENABLED=false`) — ver Architecture arriba.

Puertos: web 3000, api 3001 (defaults Nest/Next, override por `PORT`/`WEB_ORIGIN`/`NEXT_PUBLIC_API_URL`).
