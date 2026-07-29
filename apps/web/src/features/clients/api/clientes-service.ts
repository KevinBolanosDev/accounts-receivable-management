import {
  clienteDetailSchema,
  clienteListItemSchema,
  clienteSchema,
  clientesSummarySchema,
  generateAccessResponseSchema,
  type Cliente,
  type ClienteDetail,
  type ClienteListItem,
  type ClientesQuery,
  type ClientesSummary,
  type CreateClienteRequest,
  type GenerateAccessResponse,
  type UpdateClienteRequest,
  type UploadFotoDocumentoResponse,
  uploadFotoDocumentoResponseSchema,
} from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { apiFetch, apiFetchVoid, uploadFile } from "@/shared/api/client";

export interface ClientesService {
  listClientes(query?: ClientesQuery): Promise<ClienteListItem[]>;
  getClientesSummary(): Promise<ClientesSummary>;
  getCliente(id: string): Promise<ClienteDetail>;
  createCliente(body: CreateClienteRequest): Promise<Cliente>;
  updateCliente(id: string, body: UpdateClienteRequest): Promise<Cliente>;
  deleteCliente(id: string): Promise<void>;
  uploadFotoDocumento(file: File): Promise<UploadFotoDocumentoResponse>;
  generateAccess(id: string): Promise<GenerateAccessResponse>;
  deleteAccess(id: string): Promise<void>;
}

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Datos simulados (fieles a las pantallas 3c/5c) --------------------------

interface MockCliente {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  rutaId: string;
  rutaNombre: string;
  saldoPendiente: number;
  estado: NonNullable<ClienteListItem["estado"]>;
  porcentajePagado: number;
  producto: string;
}

const MOCK_CLIENTES: MockCliente[] = [
  { id: "cl1", nombre: "María Fernández", documento: "1.020.456.789", telefono: "300 111 2233", rutaId: "r3", rutaNombre: "Ruta 3 · Centro", saldoPendiente: 320000, estado: "activo", porcentajePagado: 68, producto: "Refrigerador" },
  { id: "cl2", nombre: "Carmen López", documento: "1.020.111.222", telefono: "301 222 3344", rutaId: "r2", rutaNombre: "Ruta 2 · Sur", saldoPendiente: 540000, estado: "mora", porcentajePagado: 25, producto: "Lavadora" },
  { id: "cl3", nombre: "Pedro Gómez", documento: "1.020.333.444", telefono: "302 333 4455", rutaId: "r3", rutaNombre: "Ruta 3 · Centro", saldoPendiente: 180000, estado: "proximo-a-vencer", porcentajePagado: 55, producto: "Televisor" },
  { id: "cl4", nombre: "José Martínez", documento: "1.020.555.666", telefono: "303 444 5566", rutaId: "r1", rutaNombre: "Ruta 1 · Norte", saldoPendiente: 0, estado: "pagado", porcentajePagado: 100, producto: "Nevera" },
  { id: "cl5", nombre: "Lucía Ramírez", documento: "1.020.777.888", telefono: "304 555 6677", rutaId: "r4", rutaNombre: "Ruta 4 · Occidente", saldoPendiente: 95000, estado: "activo", porcentajePagado: 80, producto: "Estufa" },
  { id: "cl6", nombre: "Andrés Díaz", documento: "1.020.999.000", telefono: "305 666 7788", rutaId: "r1", rutaNombre: "Ruta 1 · Norte", saldoPendiente: 410000, estado: "mora", porcentajePagado: 30, producto: "Licuadora" },
];

const RUTA_COBRADOR: Record<string, string> = {
  r1: "Carlos Ramírez",
  r2: "Ana Torres",
  r3: "Carlos Ramírez",
  r4: "Luis Gómez",
  r5: "Marta Díaz",
  r6: "Jorge Peña",
};

const MONTO_TOTAL = 1000000;
const CUOTA_DIARIA = 20000;
const CUOTAS_TOTAL = 50;

function toListItem(c: MockCliente): ClienteListItem {
  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    documento: c.documento,
    direccion: "Calle 00 # 00-00",
    fotoDocumentoFrenteUrl: null,
    fotoDocumentoReversoUrl: null,
    rutaId: c.rutaId,
    ruta: { id: c.rutaId, nombre: c.rutaNombre },
    saldoPendiente: c.saldoPendiente,
    estado: c.estado,
    porcentajePagado: c.porcentajePagado,
  };
}

// Historial de pagos reciente (mock, pantalla 5c). Enriquecido con
// `numeroCuota`/`estado`/`reciboCodigo` desde que `historialPagos` pasó a ser
// `PaymentHistoryItem[]` — el mismo shape que consume el Portal del Cliente.
// Se dejan horas distintas a propósito: el historial ahora muestra la hora.
const HISTORIAL_PAGOS: NonNullable<ClienteDetail["historialPagos"]> = [
  { id: "pg-h-7", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-21T13:05:00.000Z", numeroCuota: 7, estado: "ON_TIME", fechaVencimiento: "2026-07-21T13:00:00.000Z", fechaPago: "2026-07-21T13:05:00.000Z", diasAtraso: 0, reciboCodigo: "R-PGH7" },
  { id: "pg-h-6", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-20T15:40:00.000Z", numeroCuota: 6, estado: "LATE", fechaVencimiento: "2026-07-18T13:00:00.000Z", fechaPago: "2026-07-20T15:40:00.000Z", diasAtraso: 2, reciboCodigo: "R-PGH6" },
  { id: "pg-h-5", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-19T14:10:00.000Z", numeroCuota: 5, estado: "ON_TIME", fechaVencimiento: "2026-07-19T13:00:00.000Z", fechaPago: "2026-07-19T14:10:00.000Z", diasAtraso: 0, reciboCodigo: "R-PGH5" },
  { id: "pg-h-4", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-18T13:00:00.000Z", numeroCuota: 4, estado: "ON_TIME", fechaVencimiento: "2026-07-18T13:00:00.000Z", fechaPago: "2026-07-18T13:00:00.000Z", diasAtraso: 0, reciboCodigo: "R-PGH4" },
  { id: "pg-h-3", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-17T16:25:00.000Z", numeroCuota: 3, estado: "ON_TIME", fechaVencimiento: "2026-07-17T13:00:00.000Z", fechaPago: "2026-07-17T16:25:00.000Z", diasAtraso: 0, reciboCodigo: "R-PGH3" },
  { id: "pg-h-2", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-16T13:30:00.000Z", numeroCuota: 2, estado: "ON_TIME", fechaVencimiento: "2026-07-16T13:00:00.000Z", fechaPago: "2026-07-16T13:30:00.000Z", diasAtraso: 0, reciboCodigo: "R-PGH2" },
  { id: "pg-h-1", creditoId: "cr-2041", cobradorId: "u-1000000002", cobradorNombre: "Carlos Ramírez", reciboUrl: null, reciboPublicUrl: null, monto: 20000, fecha: "2026-07-15T13:15:00.000Z", numeroCuota: 1, estado: "ON_TIME", fechaVencimiento: "2026-07-15T13:00:00.000Z", fechaPago: "2026-07-15T13:15:00.000Z", diasAtraso: 0, reciboCodigo: "R-PGH1" },
];

function toCreditoListItem(
  c: MockCliente,
): ClienteDetail["creditosActivos"][number] {
  const totalPagado = MONTO_TOTAL - c.saldoPendiente;
  const porcentajePagado = c.porcentajePagado;
  const cuotasPagadas = Math.round((porcentajePagado / 100) * CUOTAS_TOTAL);
  return {
    id: "cr-2041",
    codigo: "CR-2041",
    clienteId: c.id,
    producto: c.producto,
    monto: MONTO_TOTAL,
    interes: 0,
    dias: CUOTAS_TOTAL,
    montoTotal: MONTO_TOTAL,
    cuotaDiaria: CUOTA_DIARIA,
    saldoPendiente: c.saldoPendiente,
    totalPagado,
    porcentajePagado,
    estado: c.estado === "pagado" ? "PAGADO" : "ACTIVO",
    fechaInicio: "2026-06-18T00:00:00.000Z",
    cuotasPagadas,
    cuotasTotal: CUOTAS_TOTAL,
  };
}

function toDetail(c: MockCliente): ClienteDetail {
  const credito = toCreditoListItem(c);
  const creditosActivos = c.estado === "pagado" ? [] : [credito];
  const creditosHistorial = c.estado === "pagado" ? [credito] : [];
  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    documento: c.documento,
    direccion: "Calle 00 # 00-00",
    fotoDocumentoFrenteUrl: null,
    fotoDocumentoReversoUrl: null,
    rutaId: c.rutaId,
    ruta: { id: c.rutaId, nombre: c.rutaNombre },
    cobradorNombre: RUTA_COBRADOR[c.rutaId] ?? null,
    tieneAccesoPortal: false,
    mustChangePassword: false,
    lastLoginAt: null,
    estado: c.estado,
    creditosActivos,
    creditosHistorial,
    historialPagos: HISTORIAL_PAGOS,
  };
}

// ---- Implementación simulada -------------------------------------------------

export const mockClientesService: ClientesService = {
  async listClientes(query) {
    await delay();
    const search = query?.search?.trim().toLowerCase();
    let items = MOCK_CLIENTES;
    if (query?.rutaId) items = items.filter((c) => c.rutaId === query.rutaId);
    if (search)
      items = items.filter(
        (c) => c.nombre.toLowerCase().includes(search) || c.documento.includes(search),
      );
    return items.map((c) => clienteListItemSchema.parse(toListItem(c)));
  },
  async getClientesSummary() {
    await delay();
    const cartera = MOCK_CLIENTES.length * MONTO_TOTAL;
    const saldo = MOCK_CLIENTES.reduce((sum, c) => sum + c.saldoPendiente, 0);
    return clientesSummarySchema.parse({
      clientes: MOCK_CLIENTES.length,
      cartera,
      cobrados: cartera - saldo,
      saldo,
    });
  },
  async getCliente(id) {
    await delay();
    const c = MOCK_CLIENTES.find((x) => x.id === id) ?? MOCK_CLIENTES[0]!;
    return clienteDetailSchema.parse(toDetail(c));
  },
  async createCliente(body) {
    await delay();
    return clienteSchema.parse({
      id: `cl${Math.floor(Math.random() * 1000)}`,
      nombre: body.nombre,
      telefono: body.telefono,
      documento: body.documento,
      direccion: body.direccion,
      fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl ?? null,
      fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl ?? null,
      rutaId: body.rutaId,
    });
  },
  async updateCliente(id, body) {
    await delay();
    const c = MOCK_CLIENTES.find((x) => x.id === id) ?? MOCK_CLIENTES[0]!;
    return clienteSchema.parse({
      id,
      nombre: body.nombre ?? c.nombre,
      telefono: body.telefono ?? c.telefono,
      documento: body.documento ?? c.documento,
      direccion: body.direccion ?? "Calle 00 # 00-00",
      fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl ?? null,
      fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl ?? null,
      rutaId: body.rutaId ?? c.rutaId,
    });
  },
  async deleteCliente() {
    await delay();
  },
  async uploadFotoDocumento() {
    await delay(600);
    return uploadFotoDocumentoResponseSchema.parse({
      fotoDocumentoUrl: "https://example.com/mock/documento.jpg",
    });
  },
  async generateAccess() {
    await delay();
    return generateAccessResponseSchema.parse({
      temporaryPassword: "Mock2Pass3word",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  },
  async deleteAccess() {
    await delay();
  },
};

// ---- Implementación real (se activa en el cableado, sub-fase 2.14) -----------

export const httpClientesService: ClientesService = {
  listClientes(query) {
    const token = useSessionStore.getState().token;
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.rutaId) params.set("rutaId", query.rutaId);
    const qs = params.toString();
    return apiFetch(`/clients${qs ? `?${qs}` : ""}`, clienteListItemSchema.array(), { token });
  },
  getClientesSummary() {
    return apiFetch("/clients/summary", clientesSummarySchema, {
      token: useSessionStore.getState().token,
    });
  },
  getCliente(id) {
    return apiFetch(`/clients/${id}`, clienteDetailSchema, { token: useSessionStore.getState().token });
  },
  createCliente(body) {
    return apiFetch("/clients", clienteDetailSchema, {
      method: "POST",
      body,
      token: useSessionStore.getState().token,
    });
  },
  updateCliente(id, body) {
    return apiFetch(`/clients/${id}`, clienteDetailSchema, {
      method: "PATCH",
      body,
      token: useSessionStore.getState().token,
    });
  },
  async deleteCliente(id) {
    await apiFetchVoid(`/clients/${id}`, { method: "DELETE", token: useSessionStore.getState().token });
  },
  uploadFotoDocumento(file) {
    return uploadFile("/clients/id-document-photo", uploadFotoDocumentoResponseSchema, {
      file,
      token: useSessionStore.getState().token,
    });
  },
  generateAccess(id) {
    return apiFetch(`/clients/${id}/access`, generateAccessResponseSchema, {
      method: "POST",
      token: useSessionStore.getState().token,
    });
  },
  async deleteAccess(id) {
    await apiFetchVoid(`/clients/${id}/access`, {
      method: "DELETE",
      token: useSessionStore.getState().token,
    });
  },
};

// Punto de inyección del swap mock→real (sub-fase 2.14). Bloque A: mock.
export const clientesService: ClientesService = httpClientesService;
