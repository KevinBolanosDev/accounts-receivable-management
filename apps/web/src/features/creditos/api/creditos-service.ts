import { useSessionStore } from "@/entities/session";
import { calcularCredito } from "@/entities/credit";
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
    producto: "Nevera",
    monto: 1_000_000,
    interes: 20,
    dias: 60,
    montoTotal: 1_200_000,
    cuotaDiaria: 20_000,
    saldoPendiente: 840_000,
    totalPagado: 360_000,
    porcentajePagado: 30,
    estado: "ACTIVO",
    fechaInicio: "2026-06-18T00:00:00.000Z",
    cuotasPagadas: 18,
    cuotasTotal: 60,
  },
  {
    id: "cr-2050",
    codigo: "CR-2050",
    clienteId: "cl2",
    producto: "Lavadora",
    monto: 1_200_000,
    interes: 25,
    dias: 60,
    montoTotal: 1_500_000,
    cuotaDiaria: 25_000,
    saldoPendiente: 900_000,
    totalPagado: 600_000,
    porcentajePagado: 40,
    estado: "ACTIVO",
    fechaInicio: "2026-05-10T00:00:00.000Z",
    cuotasPagadas: 24,
    cuotasTotal: 60,
  },
  {
    id: "cr-2051",
    codigo: "CR-2051",
    clienteId: "cl2",
    producto: "Televisor",
    monto: 500_000,
    interes: 20,
    dias: 40,
    montoTotal: 600_000,
    cuotaDiaria: 15_000,
    saldoPendiente: 360_000,
    totalPagado: 240_000,
    porcentajePagado: 40,
    estado: "ACTIVO",
    fechaInicio: "2026-06-30T00:00:00.000Z",
    cuotasPagadas: 16,
    cuotasTotal: 40,
  },
  {
    id: "cr-2052",
    codigo: "CR-2052",
    clienteId: "cl4",
    producto: "Nevera",
    monto: 800_000,
    interes: 25,
    dias: 50,
    montoTotal: 1_000_000,
    cuotaDiaria: 20_000,
    saldoPendiente: 0,
    totalPagado: 1_000_000,
    porcentajePagado: 100,
    estado: "PAGADO",
    fechaInicio: "2026-04-01T00:00:00.000Z",
    cuotasPagadas: 50,
    cuotasTotal: 50,
  },
];

const MOCK_DETAIL: Record<string, CreditoDetail> = Object.fromEntries(
  MOCK_CREDITOS.map((c) => [
    c.id,
    {
      ...c,
      cliente: { id: c.clienteId, nombre: "Cliente demo", ruta: { id: "r1", nombre: "Ruta Centro" } },
      pagos: [
        {
          id: `pg-${c.id}-7`,
          creditoId: c.id,
          monto: c.cuotaDiaria,
          fecha: "2026-07-21T08:00:00.000Z",
          cobradorId: "u-1000000002",
          cobradorNombre: "Carlos Ramírez",
          reciboUrl: null,
        },
        {
          id: `pg-${c.id}-6`,
          creditoId: c.id,
          monto: c.cuotaDiaria,
          fecha: "2026-07-20T08:00:00.000Z",
          cobradorId: "u-1000000002",
          cobradorNombre: "Carlos Ramírez",
          reciboUrl: null,
        },
        {
          id: `pg-${c.id}-5`,
          creditoId: c.id,
          monto: c.cuotaDiaria,
          fecha: "2026-07-19T08:00:00.000Z",
          cobradorId: "u-1000000002",
          cobradorNombre: "Carlos Ramírez",
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
    const calc = calcularCredito(body.monto, body.interes, body.dias);
    return creditoListItemSchema.parse({
      id: newId,
      codigo,
      clienteId: body.clienteId,
      producto: body.producto,
      monto: body.monto,
      interes: body.interes,
      dias: body.dias,
      montoTotal: calc.montoTotal,
      cuotaDiaria: calc.cuotaDiaria,
      saldoPendiente: calc.montoTotal,
      totalPagado: 0,
      porcentajePagado: 0,
      estado: "ACTIVO",
      fechaInicio: body.fechaInicio ?? new Date().toISOString(),
      cuotasPagadas: 0,
      cuotasTotal: body.dias,
    });
  },
  async updateCredito(id, body) {
    await delay();
    const current = MOCK_CREDITOS.find((c) => c.id === id) ?? MOCK_CREDITOS[0]!;
    const monto = body.monto ?? current.monto;
    const interes = body.interes ?? current.interes;
    const dias = body.dias ?? current.dias;
    const calc = calcularCredito(monto, interes, dias);
    return creditoListItemSchema.parse({
      ...current,
      producto: body.producto ?? current.producto,
      monto,
      interes,
      dias,
      montoTotal: calc.montoTotal,
      cuotaDiaria: calc.cuotaDiaria,
      saldoPendiente: calc.montoTotal,
      cuotasTotal: dias,
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
// Bloque C (Fase 3.10) — swap activo. Los hooks de TanStack Query ya apuntan
// a `creditosService`, así que el cambio es **un solo punto** por feature.
export const creditosService: CreditosService = httpCreditosService;
