import {
  closurePreviewSchema,
  dailyClosureListItemSchema,
  dailyClosureSchema,
  type ClosurePreview,
  type DailyClosure,
  type DailyClosureListItem,
  type DailyClosureListQuery,
} from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { apiFetch, apiFetchBlob } from "@/shared/api/client";

export interface ClosuresService {
  getPreview(routeId: string): Promise<ClosurePreview>;
  /** Cierra la ruta para HOY. Recierre de `(ruta, hoy)` → el backend responde 409. */
  close(routeId: string): Promise<DailyClosure>;
  list(query?: DailyClosureListQuery): Promise<DailyClosureListItem[]>;
  getById(id: string): Promise<DailyClosure>;
  /** PDF generado on-demand por el backend (Fase 5.8) — sin schema, son bytes. */
  getPdfBlob(id: string): Promise<Blob>;
}

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

const today = () => new Date().toISOString().slice(0, 10);

// Nombres propios del mock: `closures` no importa el service de
// `routes-collectors` (no acoplamiento horizontal entre features), así que
// duplica esta tabla mínima solo para fidelidad de la demo.
const ROUTE_NAMES: Record<string, string> = {
  r1: "Ruta 1 · Norte",
  r2: "Ruta 2 · Sur",
  r3: "Ruta 3 · Centro",
  r4: "Ruta 4 · Occidente",
  r5: "Ruta 5 · Oriente",
  r6: "Ruta 6 · Kennedy",
};

function routeName(routeId: string): string {
  return ROUTE_NAMES[routeId] ?? "Ruta";
}

const MOCK_UNPAID_CLIENTS: Record<
  string,
  { clienteId: string; nombre: string; saldoPendiente: number; telefono: string | null }[]
> = {
  r1: [
    { clienteId: "r1-cl1", nombre: "Rosa Gómez", saldoPendiente: 480_000, telefono: "+573132204471" },
    { clienteId: "r1-cl4", nombre: "Andrés Ruiz", saldoPendiente: 410_000, telefono: "+573001184420" },
  ],
  r2: [{ clienteId: "r2-cl2", nombre: "Luisa Peña", saldoPendiente: 220_000, telefono: "+573001187742" }],
  r3: [],
  r5: [
    { clienteId: "r5-cl1", nombre: "María Fernández", saldoPendiente: 320_000, telefono: "+573215560983" },
    { clienteId: "r5-cl3", nombre: "José Martínez", saldoPendiente: 150_000, telefono: null },
    { clienteId: "r5-cl5", nombre: "Pedro Lara", saldoPendiente: 90_000, telefono: "+573105529087" },
  ],
};

// Rutas con cierre YA registrado hoy en el mock (r4 refleja el
// `estadoDia:"cerrada"` que ya tenía el mock de `routes-collectors`) — deja
// ver el estado bloqueado de #19c sin pasar antes por el flujo de cerrar.
const CLOSED_TODAY_ROUTE_IDS = new Set<string>(["r4"]);

let closureSeq = 0;
function nextClosureId(routeId: string) {
  closureSeq += 1;
  return `dc-${routeId}-${closureSeq}`;
}

function buildClosure(routeId: string, date: string, overrides?: Partial<DailyClosure>): DailyClosure {
  const unpaidClients = overrides?.unpaidClients ?? MOCK_UNPAID_CLIENTS[routeId] ?? [];
  return dailyClosureSchema.parse({
    id: nextClosureId(routeId),
    routeId,
    rutaNombre: routeName(routeId),
    date,
    totalCollected: 540_000,
    collectedCount: 24,
    newCredits: 2,
    newCreditsAmount: 1_200_000,
    productsSold: 2,
    unpaidClients,
    unpaidCount: unpaidClients.length,
    status: "CLOSED",
    closedByNombre: "Carlos Ramírez",
    createdAt: new Date().toISOString(),
    ...overrides,
  });
}

// Histórico demo: un par de cierres pasados por ruta, más el de "hoy" para
// las rutas ya cerradas — le da a #12c/#13c (5.3) algo real que listar.
const MOCK_CLOSURES: DailyClosure[] = [
  ...Array.from(CLOSED_TODAY_ROUTE_IDS).map((routeId) => buildClosure(routeId, today())),
  buildClosure("r1", "2026-08-04"),
  buildClosure("r1", "2026-08-03", { unpaidClients: [], unpaidCount: 0 }),
  buildClosure("r4", "2026-08-04"),
  buildClosure("r2", "2026-08-04", { unpaidClients: [], unpaidCount: 0 }),
];

export const mockClosuresService: ClosuresService = {
  async getPreview(routeId) {
    await delay();
    const alreadyClosed = CLOSED_TODAY_ROUTE_IDS.has(routeId);
    const unpaidClients = alreadyClosed ? [] : (MOCK_UNPAID_CLIENTS[routeId] ?? []);
    return closurePreviewSchema.parse({
      routeId,
      rutaNombre: routeName(routeId),
      date: today(),
      totalCollected: 540_000,
      collectedCount: 24,
      newCredits: 2,
      newCreditsAmount: 1_200_000,
      productsSold: 2,
      unpaidClients,
      alreadyClosed,
    });
  },
  async close(routeId) {
    await delay(600);
    if (CLOSED_TODAY_ROUTE_IDS.has(routeId)) {
      throw new Error("La ruta ya fue cerrada hoy.");
    }
    CLOSED_TODAY_ROUTE_IDS.add(routeId);
    const closure = buildClosure(routeId, today());
    MOCK_CLOSURES.unshift(closure);
    return closure;
  },
  async list(query) {
    await delay(300);
    let items = MOCK_CLOSURES;
    if (query?.routeId) items = items.filter((c) => c.routeId === query.routeId);
    if (query?.from) items = items.filter((c) => c.date >= query.from!);
    if (query?.to) items = items.filter((c) => c.date <= query.to!);
    return dailyClosureListItemSchema.array().parse(items);
  },
  async getById(id) {
    await delay(300);
    const closure = MOCK_CLOSURES.find((c) => c.id === id) ?? MOCK_CLOSURES[0]!;
    return dailyClosureSchema.parse(closure);
  },
  async getPdfBlob() {
    await delay();
    // `pdfkit` corre en el server (Node), no tiene sentido en el navegador —
    // mismo criterio que `mockCobrosService.registrarCobro`: este mock no
    // implementa un backend fake para lo que solo puede vivir en el backend real.
    throw new Error("mockClosuresService no genera PDF — usa httpClosuresService.");
  },
};

export const httpClosuresService: ClosuresService = {
  getPreview(routeId) {
    return apiFetch(`/daily-closures/preview/${routeId}`, closurePreviewSchema, {
      token: useSessionStore.getState().token,
    });
  },
  close(routeId) {
    return apiFetch(`/daily-closures/${routeId}`, dailyClosureSchema, {
      method: "POST",
      token: useSessionStore.getState().token,
    });
  },
  list(query) {
    const params = new URLSearchParams();
    if (query?.routeId) params.set("routeId", query.routeId);
    if (query?.from) params.set("from", query.from);
    if (query?.to) params.set("to", query.to);
    const qs = params.toString();
    return apiFetch(`/daily-closures${qs ? `?${qs}` : ""}`, dailyClosureListItemSchema.array(), {
      token: useSessionStore.getState().token,
    });
  },
  getById(id) {
    return apiFetch(`/daily-closures/${id}`, dailyClosureSchema, {
      token: useSessionStore.getState().token,
    });
  },
  getPdfBlob(id) {
    return apiFetchBlob(`/daily-closures/${id}/pdf`, {
      token: useSessionStore.getState().token,
    });
  },
};

// Backend real desde Fase 5.10 (5.7/5.8 lo construyeron). Los mocks quedan
// implementados por si hace falta volver atrás en un click.
export const closuresService: ClosuresService = httpClosuresService;
