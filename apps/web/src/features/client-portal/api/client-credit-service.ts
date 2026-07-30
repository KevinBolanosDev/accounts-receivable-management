import { apiFetch } from "@/shared/api/client";
import { useClientSessionStore } from "@/entities/session";
import {
  DIAS_PARA_MORA,
  clientCreditDetailSchema,
  clientCreditListItemSchema,
  clientCreditSummarySchema,
  type ClientCreditDetail,
  type ClientCreditListItem,
  type ClientCreditSummary,
  type PaymentHistoryItem,
} from "@repo/types";

export interface ClientCreditService {
  getMyCredits(): Promise<ClientCreditListItem[]>;
  getCreditDetail(id: string): Promise<ClientCreditDetail>;
  getSummary(): Promise<ClientCreditSummary>;
}

// ---- Datos simulados (Fase 4.10 — mock hasta que 4.11 conecte el back) ------
// 3 créditos: uno con historial rico (LATE + MISSED, para poder diseñar/
// revisar los 3 estados del historial sin esperar al back), uno activo simple
// (variedad en la lista) y uno pagado (para probar el tab Historial).

const DIA_MS = 24 * 60 * 60 * 1000;

function mockReciboCodigo(pagoId: string): string {
  return `R-${pagoId.slice(0, 8).toUpperCase()}`;
}

// --- Crédito 1: CR-2041 · Nevera · ACTIVO, con LATE + MISSED -----------------
const CR_2041_FECHA_INICIO = new Date(Date.now() - 14 * DIA_MS);
const CR_2041_CUOTA_DIARIA = 55_000;
const CR_2041_DIAS = 30;
const CR_2041_PAGOS_REALES = 12; // días 1-11 a tiempo, día 12 tarde

function diaEsperadoCr2041(numeroCuota: number): Date {
  return new Date(CR_2041_FECHA_INICIO.getTime() + (numeroCuota - 1) * DIA_MS);
}

function buildCr2041Pagos(): PaymentHistoryItem[] {
  const pagos: PaymentHistoryItem[] = [];
  for (let n = 1; n <= CR_2041_PAGOS_REALES; n++) {
    const esperado = diaEsperadoCr2041(n);
    // La última cuota (12) llegó 2 días tarde — demo del estado LATE.
    const fecha = n === CR_2041_PAGOS_REALES ? new Date(esperado.getTime() + 2 * DIA_MS) : esperado;
    const id = `mockpago${String(n).padStart(2, "0")}`;
    const atraso = n === CR_2041_PAGOS_REALES ? 2 : 0;
    pagos.push({
      id,
      creditoId: "mock-credito-1",
      monto: CR_2041_CUOTA_DIARIA,
      fecha: fecha.toISOString(),
      cobradorId: "mock-cobrador-1",
      cobradorNombre: "Cobrador Demo",
      reciboUrl: null,
      numeroCuota: n,
      estado: atraso > 0 ? "LATE" : "ON_TIME",
      fechaVencimiento: esperado.toISOString(),
      fechaPago: fecha.toISOString(),
      diasAtraso: atraso,
      reciboCodigo: mockReciboCodigo(id),
    });
  }

  // Días transcurridos desde fechaInicio (tope en CR_2041_DIAS) sin pago
  // registrado todavía → filas sintéticas sin pagar, que escalan con el tiempo.
  const diasTranscurridos = Math.min(
    Math.floor((Date.now() - CR_2041_FECHA_INICIO.getTime()) / DIA_MS) + 1,
    CR_2041_DIAS,
  );
  const cuotasFaltantes = Math.max(0, diasTranscurridos - CR_2041_PAGOS_REALES);
  for (let i = 0; i < cuotasFaltantes; i++) {
    const numeroCuota = CR_2041_PAGOS_REALES + i + 1;
    const vencimiento = diaEsperadoCr2041(numeroCuota);
    const diasAtraso = Math.max(0, Math.floor((Date.now() - vencimiento.getTime()) / DIA_MS));
    pagos.push({
      id: `mock-credito-1-unpaid-${numeroCuota}`,
      creditoId: "mock-credito-1",
      monto: 0,
      fecha: vencimiento.toISOString(),
      cobradorId: "",
      cobradorNombre: null,
      reciboUrl: null,
      numeroCuota,
      estado: diasAtraso === 0 ? "PENDING" : diasAtraso >= DIAS_PARA_MORA ? "DEFAULTED" : "OVERDUE",
      fechaVencimiento: vencimiento.toISOString(),
      fechaPago: null,
      diasAtraso,
      reciboCodigo: null,
    });
  }

  return pagos.sort((a, b) => b.numeroCuota - a.numeroCuota);
}

const CR_2041_MONTO_TOTAL = 1_650_000;
const CR_2041_TOTAL_PAGADO = CR_2041_PAGOS_REALES * CR_2041_CUOTA_DIARIA;

const CR_2041: ClientCreditListItem = {
  id: "mock-credito-1",
  codigo: "CR-2041",
  clienteId: "mock-client-1",
  producto: "Nevera",
  monto: 1_500_000,
  interes: 10,
  frecuencia: "DIARIO",
  dias: CR_2041_DIAS,
  montoTotal: CR_2041_MONTO_TOTAL,
  cuotaDiaria: CR_2041_CUOTA_DIARIA,
  saldoPendiente: CR_2041_MONTO_TOTAL - CR_2041_TOTAL_PAGADO,
  totalPagado: CR_2041_TOTAL_PAGADO,
  porcentajePagado: Number(((CR_2041_TOTAL_PAGADO / CR_2041_MONTO_TOTAL) * 100).toFixed(2)),
  estado: "ACTIVO",
  fechaInicio: CR_2041_FECHA_INICIO.toISOString(),
  cuotasPagadas: CR_2041_PAGOS_REALES,
  cuotasTotal: CR_2041_DIAS,
  proximaFechaCuota: diaEsperadoCr2041(CR_2041_PAGOS_REALES + 1).toISOString(),
};

// --- Crédito 2: CR-2055 · Estufa a gas · ACTIVO, sin sorpresas ---------------
const CR_2055_FECHA_INICIO = new Date(Date.now() - 5 * DIA_MS);
const CR_2055_CUOTA_DIARIA = 15_000;
const CR_2055_DIAS = 24;
const CR_2055_PAGOS_REALES = 5;
const CR_2055_MONTO_TOTAL = 360_000;
const CR_2055_TOTAL_PAGADO = CR_2055_PAGOS_REALES * CR_2055_CUOTA_DIARIA;

const CR_2055: ClientCreditListItem = {
  id: "mock-credito-2",
  codigo: "CR-2055",
  clienteId: "mock-client-1",
  producto: "Estufa a gas",
  monto: 320_000,
  interes: 12.5,
  frecuencia: "DIARIO",
  dias: CR_2055_DIAS,
  montoTotal: CR_2055_MONTO_TOTAL,
  cuotaDiaria: CR_2055_CUOTA_DIARIA,
  saldoPendiente: CR_2055_MONTO_TOTAL - CR_2055_TOTAL_PAGADO,
  totalPagado: CR_2055_TOTAL_PAGADO,
  porcentajePagado: Number(((CR_2055_TOTAL_PAGADO / CR_2055_MONTO_TOTAL) * 100).toFixed(2)),
  estado: "ACTIVO",
  fechaInicio: CR_2055_FECHA_INICIO.toISOString(),
  cuotasPagadas: CR_2055_PAGOS_REALES,
  cuotasTotal: CR_2055_DIAS,
  proximaFechaCuota: new Date(CR_2055_FECHA_INICIO.getTime() + CR_2055_PAGOS_REALES * DIA_MS).toISOString(),
};

function buildCr2055Pagos(): PaymentHistoryItem[] {
  const pagos: PaymentHistoryItem[] = [];
  for (let n = 1; n <= CR_2055_PAGOS_REALES; n++) {
    const fecha = new Date(CR_2055_FECHA_INICIO.getTime() + (n - 1) * DIA_MS);
    const id = `mockpago2${String(n).padStart(2, "0")}`;
    pagos.push({
      id,
      creditoId: "mock-credito-2",
      monto: CR_2055_CUOTA_DIARIA,
      fecha: fecha.toISOString(),
      cobradorId: "mock-cobrador-1",
      cobradorNombre: "Cobrador Demo",
      reciboUrl: null,
      numeroCuota: n,
      estado: "ON_TIME",
      fechaVencimiento: fecha.toISOString(),
      fechaPago: fecha.toISOString(),
      diasAtraso: 0,
      reciboCodigo: mockReciboCodigo(id),
    });
  }
  return pagos.sort((a, b) => b.numeroCuota - a.numeroCuota);
}

// --- Crédito 3: CR-2010 · Televisor · PAGADO (para el tab Historial) --------
const CR_2010_DIAS = 20;
const CR_2010: ClientCreditListItem = {
  id: "mock-credito-3",
  codigo: "CR-2010",
  clienteId: "mock-client-1",
  producto: "Televisor",
  monto: 500_000,
  interes: 8,
  frecuencia: "DIARIO",
  dias: CR_2010_DIAS,
  montoTotal: 540_000,
  cuotaDiaria: 27_000,
  saldoPendiente: 0,
  totalPagado: 540_000,
  porcentajePagado: 100,
  estado: "PAGADO",
  fechaInicio: new Date(Date.now() - 40 * DIA_MS).toISOString(),
  cuotasPagadas: CR_2010_DIAS,
  cuotasTotal: CR_2010_DIAS,
  proximaFechaCuota: null,
};

const MOCK_CREDITOS: ClientCreditListItem[] = [CR_2041, CR_2055, CR_2010];

const MOCK_DETALLE: Record<string, ClientCreditDetail> = {
  "mock-credito-1": {
    ...CR_2041,
    cliente: { id: "mock-client-1", nombre: "María Fernández", ruta: { id: "mock-ruta-centro", nombre: "Ruta Centro" } },
    pagos: buildCr2041Pagos(),
  },
  "mock-credito-2": {
    ...CR_2055,
    cliente: { id: "mock-client-1", nombre: "María Fernández", ruta: { id: "mock-ruta-centro", nombre: "Ruta Centro" } },
    pagos: buildCr2055Pagos(),
  },
  "mock-credito-3": {
    ...CR_2010,
    cliente: { id: "mock-client-1", nombre: "María Fernández", ruta: { id: "mock-ruta-centro", nombre: "Ruta Centro" } },
    pagos: [],
  },
};

function simulateNetworkDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockClientCreditService: ClientCreditService = {
  async getMyCredits() {
    await simulateNetworkDelay();
    return clientCreditListItemSchema.array().parse(MOCK_CREDITOS);
  },
  async getCreditDetail(id) {
    await simulateNetworkDelay();
    const detalle = MOCK_DETALLE[id] ?? MOCK_DETALLE["mock-credito-1"]!;
    return clientCreditDetailSchema.parse(detalle);
  },
  async getSummary() {
    await simulateNetworkDelay();
    const activos = MOCK_CREDITOS.filter((c) => c.estado === "ACTIVO" || c.estado === "MORA");
    return clientCreditSummarySchema.parse({
      saldoTotal: activos.reduce((acc, c) => acc + c.saldoPendiente, 0),
      proximaCuota: activos[0]?.cuotaDiaria ?? null,
      porcentajePagado: activos[0]?.porcentajePagado ?? 0,
      creditosActivos: activos.length,
    });
  },
};

// Variante real — apunta al módulo `client-portal` del back (Fase 4.11). El
// token del cliente se lee del store local (mismo patrón que `receipts-service`
// del staff: `shared` no puede importar `entities/session`, así que el token
// se resuelve aquí, en la capa de feature).
export const httpClientCreditService: ClientCreditService = {
  getMyCredits() {
    const token = useClientSessionStore.getState().token;
    return apiFetch("/client-portal/credits", clientCreditListItemSchema.array(), { token });
  },
  getCreditDetail(id) {
    const token = useClientSessionStore.getState().token;
    return apiFetch(`/client-portal/credits/${id}`, clientCreditDetailSchema, { token });
  },
  getSummary() {
    const token = useClientSessionStore.getState().token;
    return apiFetch("/client-portal/summary", clientCreditSummarySchema, { token });
  },
};

// Único punto de inyección (ver FASE_4_SUBFASES.md §4.10 / §4.11). El módulo
// `client-portal` del back está completo y probado por e2e desde 4.11 — swap
// activado tras la auditoría de Fase 4 (quedaba en mock pese a que el
// backend ya funcionaba, ver ESTADO_ACTUAL.md §8.1).
export const clientCreditService: ClientCreditService = httpClientCreditService;
