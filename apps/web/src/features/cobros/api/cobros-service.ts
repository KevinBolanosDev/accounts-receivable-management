import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";
import {
  cobroResponseSchema,
  creditoListItemSchema,
  type CobroResponse,
  type CreateCobroRequest,
} from "@repo/types";
import type { ClienteListItem } from "@repo/types";

// Respuesta de "Mi ruta de hoy" (pantalla 15c). Una lista de clientes con sus
// créditos. La forma exacta se amplía en 3.5; en 3.2 sólo necesitamos una
// lista cruda con la información mínima.
export interface RutaHoyItem extends ClienteListItem {
  creditos: import("@repo/types").CreditoListItem[];
  cobroDelDia?: {
    creditoId: string;
    monto: number;
    fecha: string;
  };
}

export interface CobrosService {
  getRutaHoy(): Promise<RutaHoyItem[]>;
  registrarCobro(body: CreateCobroRequest): Promise<CobroResponse>;
}

const delay = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

// Datos demo (cl1 + cl5 del servicio de clientes), coherentes con la ruta del
// cobrador demo. La pantalla 15c los ordenará por pendientes primero.
const MOCK_RUTA_HOY: RutaHoyItem[] = [
  {
    id: "cl1",
    nombre: "María Fernández",
    telefono: "300 111 2233",
    documento: "1.020.456.789",
    direccion: "Calle 00 # 00-00",
    fotoDocumentoFrenteUrl: null,
    fotoDocumentoReversoUrl: null,
    rutaId: "r3",
    ruta: { id: "r3", nombre: "Ruta 3 · Centro" },
    saldoPendiente: 320_000,
    estado: "activo",
    porcentajePagado: 68,
    creditos: [
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
    ],
  },
  {
    id: "cl5",
    nombre: "Lucía Ramírez",
    telefono: "304 555 6677",
    documento: "1.020.777.888",
    direccion: "Calle 00 # 00-00",
    fotoDocumentoFrenteUrl: null,
    fotoDocumentoReversoUrl: null,
    rutaId: "r4",
    ruta: { id: "r4", nombre: "Ruta 4 · Occidente" },
    saldoPendiente: 95_000,
    estado: "activo",
    porcentajePagado: 80,
    creditos: [],
  },
];

const MOCK_CREDITOS: import("@repo/types").CreditoListItem[] = MOCK_RUTA_HOY.flatMap(
  (c) => c.creditos,
);
const MOCK_CREDITOS_BY_ID = new Map(MOCK_CREDITOS.map((c) => [c.id, c]));

export const mockCobrosService: CobrosService = {
  async getRutaHoy() {
    await delay();
    return MOCK_RUTA_HOY;
  },
  async registrarCobro({ creditoId, monto }) {
    await delay(450);
    // Demo del rollback optimista (3.5): un monto "999999" simula un fallo del
    // server para que se vea la reversión del saldo + toast de error.
    if (monto === 999_999) {
      throw new Error("Simulated server failure");
    }
    // Stub coherente: devuelve el CobroResponse con el crédito recalculado.
    // En 3.10 el swap a http consume el endpoint real, sin tocar este cliente.
    const credito = MOCK_CREDITOS_BY_ID.get(creditoId) ?? MOCK_CREDITOS[0]!;
    const nuevoSaldo = Math.max(0, credito.saldoPendiente - monto);
    const nuevoEstado = nuevoSaldo === 0 ? ("PAGADO" as const) : credito.estado;
    const nuevoTotalPagado = credito.totalPagado + monto;
    const recalculado: import("@repo/types").CreditoListItem = {
      ...credito,
      saldoPendiente: nuevoSaldo,
      totalPagado: nuevoTotalPagado,
      porcentajePagado: Math.round((nuevoTotalPagado / credito.montoTotal) * 100),
      estado: nuevoEstado,
      cuotasPagadas: Math.round(nuevoTotalPagado / credito.cuotaDiaria),
    };
    const response: CobroResponse = {
      pago: {
        id: `pg-${Date.now()}`,
        creditoId,
        monto,
        fecha: new Date().toISOString(),
        cobradorId: "u-1000000002",
        reciboUrl: null,
      },
      credito: recalculado,
    };
    return cobroResponseSchema.parse(response);
  },
};

export const httpCobrosService: CobrosService = {
  getRutaHoy() {
    // La forma exacta se cierra en 3.5; aquí dejamos la respuesta cruda.
    const rutaHoyListSchema = creditoListItemSchema.array();
    return apiFetch("/cobros/ruta-hoy", rutaHoyListSchema, {
      token: useSessionStore.getState().token,
    }) as unknown as Promise<RutaHoyItem[]>;
  },
  registrarCobro(body) {
    return apiFetch("/cobros", cobroResponseSchema, {
      method: "POST",
      body,
      token: useSessionStore.getState().token,
    });
  },
};

// Bloque A (Fase 3.2) — mock. El swap a http se hace en 3.10 en un solo punto.
// Bloque C (Fase 3.10) — swap activo. La actualización optimista (`onMutate`)
// reconcilia con el `CobroResponse` real (pago + crédito recalculado) y
// `onSettled` invalida las queries dependientes. Ver `use-cobros.ts`.
export const cobrosService: CobrosService = httpCobrosService;
