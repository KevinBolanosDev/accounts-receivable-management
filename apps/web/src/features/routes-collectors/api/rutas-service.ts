import {
  rutaListItemSchema,
  rutaDetailSchema,
  rutaSchema,
  type CreateRutaRequest,
  type Ruta,
  type RutaDetail,
  type RutaListItem,
  type UpdateRutaRequest,
} from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";

// Resumen de la tira superior de la lista de rutas (pantalla 6c). Es un
// agregado de UI; el mock lo fija a los valores del prototipo.
export interface RutasSummary {
  rutasAbiertas: number;
  rutasTotal: number;
  cobradoHoy: number;
  clientesEnRuta: number;
}

export interface RutasService {
  listRutas(): Promise<RutaListItem[]>;
  getRutasSummary(): Promise<RutasSummary>;
  getRuta(id: string): Promise<RutaDetail>;
  createRuta(body: CreateRutaRequest): Promise<Ruta>;
  updateRuta(id: string, body: UpdateRutaRequest): Promise<Ruta>;
  deleteRuta(id: string): Promise<void>;
}

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Datos simulados (fieles a las pantallas 6c/8c) --------------------------

const MOCK_RUTAS: RutaListItem[] = [
  { id: "r3", nombre: "Ruta 3 · Centro", activa: true, cobradorId: "c1", cobrador: { id: "c1", nombre: "Carlos Ramírez" }, clientesCount: 34, totalCobradoHoy: 560000, avanceDelDia: 82, estadoDia: "abierta" },
  { id: "r1", nombre: "Ruta 1 · Norte", activa: true, cobradorId: "c1", cobrador: { id: "c1", nombre: "Carlos Ramírez" }, clientesCount: 28, totalCobradoHoy: 420000, avanceDelDia: 78, estadoDia: "abierta" },
  { id: "r2", nombre: "Ruta 2 · Sur", activa: true, cobradorId: "c2", cobrador: { id: "c2", nombre: "Ana Torres" }, clientesCount: 22, totalCobradoHoy: 310000, avanceDelDia: 64, estadoDia: "abierta" },
  { id: "r5", nombre: "Ruta 5 · Oriente", activa: true, cobradorId: "c3", cobrador: { id: "c3", nombre: "Marta Díaz" }, clientesCount: 26, totalCobradoHoy: 180000, avanceDelDia: 41, estadoDia: "abierta" },
  { id: "r4", nombre: "Ruta 4 · Occidente", activa: true, cobradorId: "c4", cobrador: { id: "c4", nombre: "Luis Gómez" }, clientesCount: 19, totalCobradoHoy: 240000, avanceDelDia: 100, estadoDia: "cerrada" },
  { id: "r6", nombre: "Ruta 6 · Kennedy", activa: false, cobradorId: "c5", cobrador: { id: "c5", nombre: "Jorge Peña" }, clientesCount: 15, totalCobradoHoy: 0, avanceDelDia: 0, estadoDia: "cerrada" },
];

const COBRADOR_TELEFONO: Record<string, string> = {
  c1: "301 445 6789",
  c2: "302 118 4420",
  c3: "310 552 9087",
  c4: "300 774 1265",
  c5: "315 660 3311",
};

// Muestra de clientes de la ruta (pantalla 8c). Saldo/estado/avance son datos
// de Crédito (Fase 3): el mock los provee para fidelidad.
function sampleClientes(rutaId: string, rutaNombre: string): RutaDetail["clientes"] {
  const base = [
    { nombre: "Rosa Gómez", saldoPendiente: 480000, porcentajePagado: 30, estado: "mora" as const },
    { nombre: "Luisa Peña", saldoPendiente: 220000, porcentajePagado: 55, estado: "proximo-a-vencer" as const },
    { nombre: "María Fernández", saldoPendiente: 320000, porcentajePagado: 68, estado: "activo" as const },
    { nombre: "Andrés Ruiz", saldoPendiente: 410000, porcentajePagado: 45, estado: "activo" as const },
    { nombre: "José Martínez", saldoPendiente: 150000, porcentajePagado: 85, estado: "activo" as const },
    { nombre: "Pedro Lara", saldoPendiente: 90000, porcentajePagado: 91, estado: "pagado" as const },
  ];
  return base.map((c, i) => ({
    id: `${rutaId}-cl${i + 1}`,
    nombre: c.nombre,
    telefono: "300 000 0000",
    documento: `1.0${i}0.000.00${i}`,
    direccion: "Calle 00 # 00-00",
    fotoDocumentoFrenteUrl: null,
    fotoDocumentoReversoUrl: null,
    rutaId,
    ruta: { id: rutaId, nombre: rutaNombre },
    saldoPendiente: c.saldoPendiente,
    estado: c.estado,
    porcentajePagado: c.porcentajePagado,
    cobroHoy: null,
  }));
}

function buildRutaDetail(item: RutaListItem): RutaDetail {
  return {
    ...item,
    cobradorTelefono: item.cobradorId ? (COBRADOR_TELEFONO[item.cobradorId] ?? null) : null,
    enMora: 3,
    saldoTotal: 4900000,
    cierres: [
      { fecha: "20 jul", total: 540000 },
      { fecha: "19 jul", total: 520000 },
      { fecha: "18 jul", total: 560000 },
      { fecha: "17 jul", total: 500000 },
      { fecha: "16 jul", total: 480000 },
    ],
    cobradoHoy: item.totalCobradoHoy,
    clientes: sampleClientes(item.id, item.nombre),
  };
}

// ---- Implementación simulada -------------------------------------------------

export const mockRutasService: RutasService = {
  async listRutas() {
    await delay();
    return MOCK_RUTAS.map((r) => rutaListItemSchema.parse(r));
  },
  async getRutasSummary() {
    await delay();
    return { rutasAbiertas: 4, rutasTotal: 6, cobradoHoy: 1470000, clientesEnRuta: 129 };
  },
  async getRuta(id) {
    await delay();
    const item = MOCK_RUTAS.find((r) => r.id === id) ?? MOCK_RUTAS[0]!;
    return rutaDetailSchema.parse(buildRutaDetail(item));
  },
  async createRuta(body) {
    await delay();
    return rutaSchema.parse({
      id: `r${Math.floor(Math.random() * 1000)}`,
      nombre: body.nombre,
      activa: body.activa ?? true,
      cobradorId: body.cobradorId ?? null,
    });
  },
  async updateRuta(id, body) {
    await delay();
    const item = MOCK_RUTAS.find((r) => r.id === id) ?? MOCK_RUTAS[0]!;
    return rutaSchema.parse({
      id,
      nombre: body.nombre ?? item.nombre,
      activa: body.activa ?? item.activa,
      cobradorId: body.cobradorId ?? item.cobradorId,
    });
  },
  async deleteRuta() {
    await delay();
  },
};

// ---- Implementación real (se activa en el cableado, sub-fase 2.14) -----------

export const httpRutasService: RutasService = {
  listRutas() {
    return apiFetch("/routes", rutaListItemSchema.array(), { token: useSessionStore.getState().token });
  },
  async getRutasSummary() {
    const rutas = await apiFetch("/routes", rutaListItemSchema.array(), { token: useSessionStore.getState().token });
    const abiertas = rutas.filter((r) => r.estadoDia === "abierta");
    return {
      rutasAbiertas: abiertas.length,
      rutasTotal: rutas.length,
      cobradoHoy: abiertas.reduce((sum, r) => sum + r.totalCobradoHoy, 0),
      clientesEnRuta: rutas.reduce((sum, r) => sum + r.clientesCount, 0),
    };
  },
  getRuta(id) {
    return apiFetch(`/routes/${id}`, rutaDetailSchema, { token: useSessionStore.getState().token });
  },
  createRuta(body) {
    return apiFetch("/routes", rutaSchema, { method: "POST", body, token: useSessionStore.getState().token });
  },
  updateRuta(id, body) {
    return apiFetch(`/routes/${id}`, rutaSchema, { method: "PATCH", body, token: useSessionStore.getState().token });
  },
  async deleteRuta(id) {
    await apiFetch(`/routes/${id}`, rutaSchema, { method: "DELETE", token: useSessionStore.getState().token });
  },
};

// Punto de inyección del swap mock→real (sub-fase 2.14). Bloque A: mock.
export const rutasService: RutasService = httpRutasService;
