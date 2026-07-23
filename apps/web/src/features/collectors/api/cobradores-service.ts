import {
  cobradorListItemSchema,
  type CobradorListItem,
  type CreateCobradorRequest,
  type UpdateCobradorRequest,
} from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";

// Resumen de la tira superior de Cobradores (pantalla 11a). Agregado de UI.
export interface CobradoresSummary {
  cobradoresActivos: number;
  cobradoresTotal: number;
  clientesCubiertos: number;
  cobradoHoyEquipo: number;
}

export interface CobradoresService {
  listCobradores(): Promise<CobradorListItem[]>;
  getCobradoresSummary(): Promise<CobradoresSummary>;
  createCobrador(body: CreateCobradorRequest): Promise<CobradorListItem>;
  updateCobrador(id: string, body: UpdateCobradorRequest): Promise<CobradorListItem>;
}

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Datos simulados (fieles a la pantalla 11a) ------------------------------

const MOCK_COBRADORES: CobradorListItem[] = [
   { id: "c2", nombre: "Ana Torres", documento: "1.002.000.002", rol: "COBRADOR", telefono: null, activo: true, rutas: [{ id: "r2", nombre: "Ruta 2 · Sur" }], clientesCount: 22, cobradoHoy: 310000 },
   { id: "c1", nombre: "Carlos Ramírez", documento: "1.001.000.001", rol: "COBRADOR", telefono: null, activo: true, rutas: [{ id: "r3", nombre: "Ruta 3 · Centro" }, { id: "r1", nombre: "Ruta 1 · Norte" }], clientesCount: 62, cobradoHoy: 980000 },
   { id: "c6", nombre: "Diana Reyes", documento: "1.006.000.006", rol: "COBRADOR", telefono: null, activo: false, rutas: [], clientesCount: 0, cobradoHoy: 0 },
   { id: "c5", nombre: "Jorge Peña", documento: "1.005.000.005", rol: "COBRADOR", telefono: null, activo: true, rutas: [{ id: "r6", nombre: "Ruta 6 · Kennedy" }], clientesCount: 15, cobradoHoy: 0 },
   { id: "c4", nombre: "Luis Gómez", documento: "1.004.000.004", rol: "COBRADOR", telefono: null, activo: true, rutas: [{ id: "r4", nombre: "Ruta 4 · Occidente" }], clientesCount: 19, cobradoHoy: 240000 },
   { id: "c3", nombre: "Marta Díaz", documento: "1.003.000.003", rol: "COBRADOR", telefono: null, activo: true, rutas: [{ id: "r5", nombre: "Ruta 5 · Oriente" }], clientesCount: 26, cobradoHoy: 180000 },
];

// ---- Implementación simulada -------------------------------------------------

export const mockCobradoresService: CobradoresService = {
  async listCobradores() {
    await delay();
    return MOCK_COBRADORES.map((c) => cobradorListItemSchema.parse(c));
  },
  async getCobradoresSummary() {
    await delay();
    return { cobradoresActivos: 5, cobradoresTotal: 6, clientesCubiertos: 144, cobradoHoyEquipo: 1710000 };
  },
  async createCobrador(body) {
    await delay();
    return cobradorListItemSchema.parse({
      id: `c${Math.floor(Math.random() * 1000)}`,
      nombre: body.nombre,
      documento: body.documento,
      rol: "COBRADOR",
      telefono: null,
      activo: true,
      rutas: [],
      clientesCount: 0,
      cobradoHoy: 0,
    });
  },
  async updateCobrador(id, body) {
    await delay();
    const item = MOCK_COBRADORES.find((c) => c.id === id) ?? MOCK_COBRADORES[0]!;
    return cobradorListItemSchema.parse({
      ...item,
      nombre: body.nombre ?? item.nombre,
      telefono: body.telefono ?? item.telefono,
      activo: body.activo ?? item.activo,
    });
  },
};

// ---- Implementación real (se activa en el cableado, sub-fase 2.14) -----------

export const httpCobradoresService: CobradoresService = {
  listCobradores() {
    return apiFetch("/users?rol=COBRADOR", cobradorListItemSchema.array(), { token: useSessionStore.getState().token });
  },
  async getCobradoresSummary() {
    const cobradores = await apiFetch("/users?rol=COBRADOR", cobradorListItemSchema.array(), { token: useSessionStore.getState().token });
    return {
      cobradoresActivos: cobradores.filter((c) => c.activo).length,
      cobradoresTotal: cobradores.length,
      clientesCubiertos: cobradores.reduce((sum, c) => sum + c.clientesCount, 0),
      cobradoHoyEquipo: cobradores.reduce((sum, c) => sum + c.cobradoHoy, 0),
    };
  },
  createCobrador(body) {
    return apiFetch("/users", cobradorListItemSchema, { method: "POST", body, token: useSessionStore.getState().token });
  },
  updateCobrador(id, body) {
    return apiFetch(`/users/${id}`, cobradorListItemSchema, { method: "PATCH", body, token: useSessionStore.getState().token });
  },
};

// Punto de inyección del swap mock→real (sub-fase 2.14). Bloque A: mock.
export const cobradoresService: CobradoresService = httpCobradoresService;
