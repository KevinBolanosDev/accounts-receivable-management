# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Accounts receivable / daily-installment collection system (see `specs/PLAN_DESARROLLO.md`, in Spanish, for the full product spec and phase-by-phase roadmap). Three user profiles: **Admin** (full access), **Cobrador** (collector, scoped to their assigned route(s)), **Cliente final** (read-only, token-based access, no login).

`specs/PLAN_DESARROLLO.md` is the authoritative source for architecture decisions and the phase plan (Fase 0 through Fase 6). `specs/FASE_0_SUBFASES.md` breaks down the current phase (monorepo foundation) into sub-steps. `specs/DESIGN_SYSTEM.md` has the design tokens (colors, radii, dark/light-mode-per-surface rules) for when frontend UI work begins — none of it is applied yet (`apps/web` still has the stock `create-next-app` theme).

## Commands

Root-level (Turborepo fans these out to every workspace that defines the script):

```bash
pnpm dev         # runs apps/web + apps/api + packages/types (watch build) concurrently
pnpm build       # builds packages/types first, then api and web (dependsOn: ["^build"])
pnpm lint        # eslint across all workspaces
pnpm typecheck   # tsc --noEmit across all workspaces
pnpm format      # prettier --write . (root Prettier config re-exports packages/config/prettier.config.js)
```

Target a single workspace with `--filter`:

```bash
pnpm --filter api dev
pnpm --filter web build
pnpm --filter @repo/types build   # must run before api/web can resolve @repo/types
```

Backend (`apps/api`, run from that directory or via `--filter api`):

```bash
pnpm test              # jest unit tests (rootDir: src, pattern: *.spec.ts) — none exist yet
pnpm test -- health.service.spec.ts   # run a single unit test file
pnpm test:e2e           # jest --config ./test/jest-e2e.json (test/app.e2e-spec.ts)
pnpm test:e2e -- -t "health"          # run a single e2e test by name
pnpm db:generate         # prisma generate (also runs automatically on postinstall)
npx prisma generate      # same, direct CLI
npx prisma studio         # inspect the DB (needs a reachable DATABASE_URL)
```

No test runner is configured for `apps/web` yet — Fase 6 of the plan decides this.

### Local env setup

`apps/api/.env` (gitignored; copy from `apps/api/.env.example`) needs `PORT`, `WEB_ORIGIN`, and `DATABASE_URL`. Env vars are validated at boot with a Zod schema (`apps/api/src/core/config/env.schema.ts`) via `@nestjs/config` — the app throws a clear error on startup if `DATABASE_URL` is missing.

**Supabase gotcha:** Supabase's "Direct connection" host (`db.<project>.supabase.co`) resolves IPv6-only. If the DATABASE_URL uses that host and the run environment has no outbound IPv6 (common in WSL, sandboxes, some CI), Postgres connections fail with `ENETUNREACH`. Use Supabase's **connection pooler** string instead (dashboard → Connect → "Transaction pooler" / "Session pooler"), which is IPv4-compatible.

## Architecture

Turborepo + pnpm workspaces. `apps/*` are deployables, `packages/*` are shared code.

```
apps/api      NestJS backend
apps/web      Next.js (App Router) frontend
packages/config  shared tsconfig/eslint/prettier base (consumed as source, no build step)
packages/types    shared Zod schemas + inferred types (@repo/types) — the contract between api and web
```

### Two different architectural styles, deliberately

Backend uses **Feature-Based modules** (NestJS's natural module → controller → service → repository pattern under `apps/api/src/modules/*`). Frontend uses **Feature-Sliced Design** (`apps/web/src/{app,pages-fsd,widgets,features,entities,shared}`, layers import only downward — `widgets` can use `shared`, `entities` never imports `features`). These are intentionally different labels for intentionally different ecosystems (FSD's `pages`/`widgets` notion doesn't map cleanly onto Nest, and Nest's DI-module system doesn't map onto a UI layer model). See `specs/PLAN_DESARROLLO.md` §2 for the full reasoning.

The cross-cutting rule that matters most: **no horizontal coupling between features**. A feature module never imports another feature's internals. Anything genuinely shared goes into `core/` (backend infra: Prisma, guards, interceptors) or a `shared`/`packages/*` layer, or is exchanged via typed contracts — never by reaching into a sibling feature's service.

### `@repo/types` — the contract layer

Both apps depend on `@repo/types` for shared shapes, defined once as a Zod schema and consumed identically on both ends (`schema.parse(data)` on the way out of the API, and again on the client after `fetch`). This is meant to be the pattern going forward: new shared DTOs get a Zod schema + inferred type in `packages/types/src/`, exported from `index.ts`, and imported by both `apps/api` and `apps/web`.

**Non-obvious constraint:** `@repo/types` must build to plain CommonJS (`tsc`, `module: CommonJS`), not ESM. `apps/api` has no `"type": "module"`, so Nest compiles to CJS and `require()`s workspace packages at runtime — an ESM-only shared package breaks at runtime (not at typecheck time, since `import type` is erased) the moment something imports a real value (not just a type) from it. If you add a new shared package, keep it CJS unless you also convert the consuming app to ESM.

### NestJS structure (`apps/api/src`)

```
main.ts                        NestFactory bootstrap, CORS (WEB_ORIGIN), PORT
app.module.ts                  root module — imports ConfigModule, PrismaModule, feature modules
core/config/env.schema.ts      Zod schema + validateEnv(), passed to ConfigModule.forRoot({ validate })
core/prisma/                   PrismaService (extends PrismaClient, driver-adapter pattern) + PrismaModule (@Global)
modules/<feature>/             one module per feature: <feature>.module.ts, .controller.ts, .service.ts
```

`HealthModule` (`modules/health/`) is the reference implementation of the module/controller/service pattern — copy its shape for new feature modules. `GET /health` reports `{ status, uptime, timestamp, database }`, where `database` is checked via a live query and never throws (returns `"down"` instead of crashing the app if Postgres is unreachable).

**Prisma is on v7**, which changed significantly from earlier versions used in most existing tutorials/training data:
- `PrismaClient` now **requires** an explicit driver adapter (`@prisma/adapter-pg`'s `PrismaPg`, constructed with `connectionString`). The old plain `datasource db { url = env(...) }` + bare `new PrismaClient()` pattern no longer works — Prisma 7 hard-rejects a `url` field inside the `datasource` block in `schema.prisma` (`P1012` validation error). The connection string for the CLI (migrate/studio) lives in `prisma.config.ts`; the connection string for the runtime client is passed explicitly to `PrismaPg` in `PrismaService`.
- The generator is pinned to `provider = "prisma-client-js"` (the classic generator), not the newer `"prisma-client"` generator. The new one emits TS using `import.meta.url`, which is ESM-only syntax that crashes (`ReferenceError: exports is not defined in ES module scope`) once compiled to CJS and actually loaded by a running Nest app — it only *looks* fine until something triggers a real (non-type-only) import.
- `prisma/schema.prisma` has no models yet — Fase 2 of the plan owns the data model.

### Next.js structure (`apps/web/src`)

App Router, Next 16 (Turbopack by default). `app/` is composition-only per the FSD rule — `app/page.tsx` renders widgets, it doesn't fetch or hold state itself. `shared/api/client.ts` holds the API base URL (`NEXT_PUBLIC_API_URL`, defaults to `http://localhost:3001`). `widgets/health-status/HealthStatus.tsx` is the reference pattern for a data-fetching client component: `"use client"`, fetch, validate the response with the matching Zod schema from `@repo/types`, render based on a discriminated state union (`loading` / `error` / `success`).

Ports: web on 3000, api on 3001 (both are Next/Nest defaults here, not overridden beyond `PORT`/`WEB_ORIGIN` env vars).
