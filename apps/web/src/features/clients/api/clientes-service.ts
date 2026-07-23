import {
  clienteDetailSchema,
  clienteListItemSchema,
  clienteSchema,
  type Cliente,
  type ClienteDetail,
  type ClienteListItem,
  type ClientesQuery,
  type CreateClienteRequest,
  type UpdateClienteRequest,
  type UploadFotoDocumentoResponse,
  uploadFotoDocumentoResponseSchema,
} from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { apiFetch, uploadFile } from "@/shared/api/client";

export interface ClientesService {
  listClientes(query?: ClientesQuery): Promise<ClienteListItem[]>;
  getCliente(id: string): Promise<ClienteDetail>;
  createCliente(body: CreateClienteRequest): Promise<Cliente>;
  updateCliente(id: string, body: UpdateClienteRequest): Promise<Cliente>;
  deleteCliente(id: string): Promise<void>;
  uploadFotoDocumento(file: File): Promise<UploadFotoDocumentoResponse>;
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

// Historial de pagos reciente (mock, pantalla 5c). Datos de Crédito → Fase 3.
const HISTORIAL_PAGOS: ClienteDetail["historialPagos"] = [
  { fecha: "21 jul 2026", monto: 20000, estado: "pagado" },
  { fecha: "20 jul 2026", monto: 20000, estado: "pagado" },
  { fecha: "19 jul 2026", monto: 20000, estado: "pagado" },
  { fecha: "18 jul 2026", monto: 20000, estado: "tarde" },
  { fecha: "17 jul 2026", monto: 20000, estado: "pagado" },
  { fecha: "16 jul 2026", monto: 20000, estado: "pagado" },
  { fecha: "15 jul 2026", monto: 20000, estado: "pagado" },
];

function toDetail(c: MockCliente): ClienteDetail {
  const totalPagado = MONTO_TOTAL - c.saldoPendiente;
  const cuotasPagadas = Math.round((c.porcentajePagado / 100) * CUOTAS_TOTAL);
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
    estado: c.estado,
    creditoActivo:
      c.estado === "pagado"
        ? {
            id: "CR-2041",
            producto: c.producto,
            montoTotal: MONTO_TOTAL,
            totalPagado: MONTO_TOTAL,
            saldoPendiente: 0,
            porcentajePagado: 100,
            cuotaDiaria: CUOTA_DIARIA,
            cuotasPagadas: CUOTAS_TOTAL,
            cuotasTotal: CUOTAS_TOTAL,
            fechaApertura: "18 jun 2026",
            proximoPagoHoy: false,
          }
        : {
            id: "CR-2041",
            producto: c.producto,
            montoTotal: MONTO_TOTAL,
            totalPagado,
            saldoPendiente: c.saldoPendiente,
            porcentajePagado: c.porcentajePagado,
            cuotaDiaria: CUOTA_DIARIA,
            cuotasPagadas,
            cuotasTotal: CUOTAS_TOTAL,
            fechaApertura: "18 jun 2026",
            proximoPagoHoy: true,
          },
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
};

// ---- Implementación real (se activa en el cableado, sub-fase 2.14) -----------

export const httpClientesService: ClientesService = {
  listClientes(query) {
    const token = useSessionStore.getState().token;
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.rutaId) params.set("rutaId", query.rutaId);
    const qs = params.toString();
    return apiFetch(`/clientes${qs ? `?${qs}` : ""}`, clienteListItemSchema.array(), { token });
  },
  getCliente(id) {
    return apiFetch(`/clientes/${id}`, clienteDetailSchema, { token: useSessionStore.getState().token });
  },
  createCliente(body) {
    return apiFetch("/clientes", clienteDetailSchema, {
      method: "POST",
      body,
      token: useSessionStore.getState().token,
    });
  },
  updateCliente(id, body) {
    return apiFetch(`/clientes/${id}`, clienteDetailSchema, {
      method: "PATCH",
      body,
      token: useSessionStore.getState().token,
    });
  },
  async deleteCliente(id) {
    await apiFetch(`/clientes/${id}`, clienteSchema, { method: "DELETE", token: useSessionStore.getState().token });
  },
  uploadFotoDocumento(file) {
    return uploadFile("/clientes/foto-documento", uploadFotoDocumentoResponseSchema, {
      file,
      token: useSessionStore.getState().token,
    });
  },
};

// Punto de inyección del swap mock→real (sub-fase 2.14). Bloque A: mock.
export const clientesService: ClientesService = httpClientesService;
