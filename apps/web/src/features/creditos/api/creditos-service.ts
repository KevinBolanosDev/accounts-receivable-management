import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";
import {
  creditoDetailSchema,
  creditoListItemSchema,
  type CreateCreditoRequest,
  type Credito,
  type CreditoDetail,
  type CreditoListItem,
  type CreditosQuery,
  type UpdateCreditoRequest,
} from "@repo/types";

export interface CreditosService {
  listCreditos(query?: CreditosQuery): Promise<CreditoListItem[]>;
  getCredito(id: string): Promise<CreditoDetail>;
  createCredito(body: CreateCreditoRequest): Promise<Credito>;
  updateCredito(id: string, body: UpdateCreditoRequest): Promise<Credito>;
  anularCredito(id: string): Promise<Credito>;
}

const creditoListArraySchema = creditoListItemSchema.array();

const delay = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock coherente con los clientes demo de Fase 2. La Fase 3.6 lo reemplaza por
// datos reales (Prisma + seed). Un cliente puede tener VARIOS créditos activos
// a la vez, así que cl2 tiene dos.
const MOCK_CREDITOS: CreditoListItem[] = [
  {
    id: "cr-2041",
    codigo: "CR-2041",
    clienteId: "cl1",
    productoId: "prod-nevera",
    montoTotal: 1_000_000,
    cuotaDiaria: 20_000,
    saldoPendiente: 320_000,
    totalPagado: 680_000,
    porcentajePagado: 68,
    estado: "ACTIVO",
    fechaInicio: "2026-06-18T00:00:00.000Z",
    producto: { id: "prod-nevera", nombre: "Nevera" },
    cuotasPagadas: 34,
    cuotasTotal: 50,
  },
  {
    id: "cr-2050",
    codigo: "CR-2050",
    clienteId: "cl2",
    productoId: "prod-lavadora",
    montoTotal: 1_200_000,
    cuotaDiaria: 25_000,
    saldoPendiente: 540_000,
    totalPagado: 660_000,
    porcentajePagado: 55,
    estado: "ACTIVO",
    fechaInicio: "2026-05-10T00:00:00.000Z",
    producto: { id: "prod-lavadora", nombre: "Lavadora" },
    cuotasPagadas: 26,
    cuotasTotal: 48,
  },
  {
    id: "cr-2051",
    codigo: "CR-2051",
    clienteId: "cl2",
    productoId: "prod-tv",
    montoTotal: 600_000,
    cuotaDiaria: 15_000,
    saldoPendiente: 360_000,
    totalPagado: 240_000,
    porcentajePagado: 40,
    estado: "ACTIVO",
    fechaInicio: "2026-06-30T00:00:00.000Z",
    producto: { id: "prod-tv", nombre: "Televisor" },
    cuotasPagadas: 16,
    cuotasTotal: 40,
  },
  {
    id: "cr-2052",
    codigo: "CR-2052",
    clienteId: "cl4",
    productoId: "prod-nevera",
    montoTotal: 1_000_000,
    cuotaDiaria: 20_000,
    saldoPendiente: 0,
    totalPagado: 1_000_000,
    porcentajePagado: 100,
    estado: "PAGADO",
    fechaInicio: "2026-04-01T00:00:00.000Z",
    producto: { id: "prod-nevera", nombre: "Nevera" },
    cuotasPagadas: 50,
    cuotasTotal: 50,
  },
];

const MOCK_DETAIL: Record<string, CreditoDetail> = Object.fromEntries(
  MOCK_CREDITOS.map((c) => [
    c.id,
    {
      ...c,
      cliente: { id: c.clienteId, nombre: "Cliente demo" },
      pagos: [
        {
          id: `pg-${c.id}-7`,
          creditoId: c.id,
          monto: c.cuotaDiaria,
          fecha: "2026-07-21T08:00:00.000Z",
          cobradorId: "u-1000000002",
          reciboUrl: null,
        },
        {
          id: `pg-${c.id}-6`,
          creditoId: c.id,
          monto: c.cuotaDiaria,
          fecha: "2026-07-20T08:00:00.000Z",
          cobradorId: "u-1000000002",
          reciboUrl: null,
        },
        {
          id: `pg-${c.id}-5`,
          creditoId: c.id,
          monto: c.cuotaDiaria,
          fecha: "2026-07-19T08:00:00.000Z",
          cobradorId: "u-1000000002",
          reciboUrl: null,
        },
      ],
    },
  ]),
);

export const mockCreditosService: CreditosService = {
  async listCreditos(query) {
    await delay();
    let items = MOCK_CREDITOS;
    if (query?.clienteId) items = items.filter((c) => c.clienteId === query.clienteId);
    if (query?.estado) items = items.filter((c) => c.estado === query.estado);
    return creditoListArraySchema.parse(items);
  },
  async getCredito(id) {
    await delay();
    const credito = MOCK_DETAIL[id] ?? MOCK_DETAIL["cr-2041"]!;
    return creditoDetailSchema.parse(credito);
  },
  async createCredito(body) {
    await delay();
    const newId = `cr-${Math.floor(Math.random() * 9000) + 3000}`;
    const codigo = `CR-${newId.split("-")[1]}`;
    return creditoListItemSchema.parse({
      id: newId,
      codigo,
      clienteId: body.clienteId,
      productoId: body.productoId,
      montoTotal: body.montoTotal,
      cuotaDiaria: body.cuotaDiaria,
      saldoPendiente: body.montoTotal,
      totalPagado: 0,
      porcentajePagado: 0,
      estado: "ACTIVO",
      fechaInicio: body.fechaInicio ?? new Date().toISOString(),
      producto: { id: body.productoId, nombre: "Producto demo" },
      cuotasPagadas: 0,
      cuotasTotal: Math.ceil(body.montoTotal / body.cuotaDiaria),
    });
  },
  async updateCredito(id, body) {
    await delay();
    const current = MOCK_CREDITOS.find((c) => c.id === id) ?? MOCK_CREDITOS[0]!;
    return creditoListItemSchema.parse({
      ...current,
      productoId: body.productoId ?? current.productoId,
      montoTotal: body.montoTotal ?? current.montoTotal,
      cuotaDiaria: body.cuotaDiaria ?? current.cuotaDiaria,
    });
  },
  async anularCredito(id) {
    await delay();
    const current = MOCK_CREDITOS.find((c) => c.id === id) ?? MOCK_CREDITOS[0]!;
    return creditoListItemSchema.parse({ ...current, estado: "ANULADO" });
  },
};

export const httpCreditosService: CreditosService = {
  listCreditos(query) {
    const params = new URLSearchParams();
    if (query?.clienteId) params.set("clienteId", query.clienteId);
    if (query?.estado) params.set("estado", query.estado);
    const qs = params.toString();
    return apiFetch(`/creditos${qs ? `?${qs}` : ""}`, creditoListArraySchema, {
      token: useSessionStore.getState().token,
    });
  },
  getCredito(id) {
    return apiFetch(`/creditos/${id}`, creditoDetailSchema, {
      token: useSessionStore.getState().token,
    });
  },
  createCredito(body) {
    return apiFetch("/creditos", creditoListItemSchema, {
      method: "POST",
      body,
      token: useSessionStore.getState().token,
    });
  },
  updateCredito(id, body) {
    return apiFetch(`/creditos/${id}`, creditoListItemSchema, {
      method: "PATCH",
      body,
      token: useSessionStore.getState().token,
    });
  },
  async anularCredito(id) {
    return apiFetch(`/creditos/${id}`, creditoListItemSchema, {
      method: "DELETE",
      token: useSessionStore.getState().token,
    });
  },
};

// Bloque A (Fase 3.2) — mock. El swap a http se hace en 3.10 en un solo punto.
export const creditosService: CreditosService = mockCreditosService;
