import { apiFetch } from "@/shared/api/client";
import { useClientSessionStore } from "@/entities/session";
import {
  clienteListItemSchema,
  creditoListItemSchema,
  pagoSchema,
  type Credito,
  type CreditoListItem,
  type Pago,
} from "@repo/types";

export interface ClientCreditSummary {
  saldoTotal: number;
  proximaCuota: number | null;
  porcentajePagado: number;
  creditosActivos: number;
}

export interface ClientCreditService {
  getMyCredits(): Promise<CreditoListItem[]>;
  getMyPayments(creditoId?: string): Promise<Pago[]>;
  getSummary(): Promise<ClientCreditSummary>;
}

// Mock con datos del seed del cliente demo (María Fernández, documento
// 1000000010 — crédito CR-2041). Mantenido por la convención "mocks no se
// borran" hasta el cableado de 4.11.
const MOCK_CREDITOS: CreditoListItem[] = [
  {
    id: "mock-credito-1",
    codigo: "CR-2041",
    clienteId: "mock-client-1",
    producto: "Nevera",
    monto: 1_500_000,
    interes: 10,
    dias: 30,
    montoTotal: 1_650_000,
    cuotaDiaria: 55_000,
    saldoPendiente: 990_000,
    totalPagado: 660_000,
    porcentajePagado: 40,
    estado: "ACTIVO",
    fechaInicio: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    cuotasPagadas: 12,
    cuotasTotal: 30,
  },
];

const MOCK_PAGOS: Pago[] = [
  {
    id: "mock-pago-1",
    creditoId: "mock-credito-1",
    monto: 55_000,
    fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    cobradorId: "mock-cobrador-1",
    reciboUrl: null,
  },
  {
    id: "mock-pago-2",
    creditoId: "mock-credito-1",
    monto: 55_000,
    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    cobradorId: "mock-cobrador-1",
    reciboUrl: null,
  },
  {
    id: "mock-pago-3",
    creditoId: "mock-credito-1",
    monto: 55_000,
    fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    cobradorId: "mock-cobrador-1",
    reciboUrl: null,
  },
];

function simulateNetworkDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockClientCreditService: ClientCreditService = {
  async getMyCredits() {
    await simulateNetworkDelay();
    return creditoListItemSchema.array().parse(MOCK_CREDITOS);
  },
  async getMyPayments(creditoId) {
    await simulateNetworkDelay();
    const pagos = creditoId
      ? MOCK_PAGOS.filter((p) => p.creditoId === creditoId)
      : MOCK_PAGOS;
    return pagoSchema.array().parse(pagos);
  },
  async getSummary() {
    await simulateNetworkDelay();
    return {
      saldoTotal: MOCK_CREDITOS.reduce((acc, c) => acc + c.saldoPendiente, 0),
      proximaCuota: MOCK_CREDITOS[0]?.cuotaDiaria ?? null,
      porcentajePagado: MOCK_CREDITOS[0]?.porcentajePagado ?? 0,
      creditosActivos: MOCK_CREDITOS.filter((c) => c.estado === "ACTIVO").length,
    };
  },
};

// Variante real — apunta al módulo `client-portal` del back (4.11). El token
// del cliente se lee del store local.
export const httpClientCreditService: ClientCreditService = {
  getMyCredits() {
    const token = useClientSessionStore.getState().token;
    return apiFetch("/client-portal/credits", creditoListItemSchema.array(), { token });
  },
  getMyPayments(creditoId) {
    const token = useClientSessionStore.getState().token;
    const path = creditoId
      ? `/client-portal/payments?creditoId=${encodeURIComponent(creditoId)}`
      : "/client-portal/payments";
    return apiFetch(path, pagoSchema.array(), { token });
  },
  getSummary() {
    // El summary real se enchufa en 4.11 con su propio schema Zod. Hoy
    // reutilizamos el mock para evitar romper el wiring antes del back.
    return mockClientCreditService.getSummary();
  },
};

// Único punto de inyección (ver FASE_4_SUBFASES.md §4.10).
export const clientCreditService: ClientCreditService = mockClientCreditService;

// Re-exports de schemas para que `use-client-portal.ts` los importe sin
// duplicar el import desde `@repo/types`.
export { clienteListItemSchema };

// Tipo `Credito` re-exportado para que la UI no importe directo de `@repo/types`
// cuando lo use. Mantiene la convención de barrel.
export type { Credito };