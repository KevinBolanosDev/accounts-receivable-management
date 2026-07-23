import { z } from "zod";

import { creditoListItemSchema } from "./credito";
import { pagoSchema } from "./cobro";

// Estado de crédito derivado (badges §2.3). Es dato de Crédito → Fase 3.
export const estadoClienteSchema = z.enum(["activo", "proximo-a-vencer", "mora", "pagado"]);
export type EstadoCliente = z.infer<typeof estadoClienteSchema>;

// Cliente expuesto al frontend. NUNCA incluye `tokenAcceso` (se genera en el
// servidor con cripto y es del acceso público del cliente final, Fase 4).
export const clienteSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  telefono: z.string(),
  documento: z.string(),
  direccion: z.string(),
  fotoDocumentoFrenteUrl: z.string().url().nullable(),
  fotoDocumentoReversoUrl: z.string().url().nullable(),
  rutaId: z.string(),
});
export type Cliente = z.infer<typeof clienteSchema>;

// Fila de la tabla (pantalla 3c) y forma que consume la Client card.
// `saldoPendiente`/`estado`/`porcentajePagado` son opcionales por compatibilidad
// con la Fase 2; el backend de la Fase 3 los puebla de verdad.
export const clienteListItemSchema = clienteSchema.extend({
  ruta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  saldoPendiente: z.number().optional(),
  estado: estadoClienteSchema.optional(),
  porcentajePagado: z.number().optional(),
});
export type ClienteListItem = z.infer<typeof clienteListItemSchema>;

// Estado de una cuota del historial de pagos (pantalla 5c).
export const estadoPagoSchema = z.enum(["pagado", "tarde", "pendiente"]);
export type EstadoPago = z.infer<typeof estadoPagoSchema>;

// Detalle de cliente (pantalla 5c) y preview de 3c. Extiende `clienteListItemSchema`
// (hereda `ruta`/`saldoPendiente`/`estado`/`porcentajePagado`, ya poblados de
// verdad por el backend de Fase 3 — ver su comentario) en vez del `clienteSchema`
// base, para no perder esos campos al re-parsear la respuesta en el controller.
// Refinado en la Fase 3: un cliente tiene 1:N créditos (puede tener varios
// activos a la vez), por lo que el detalle expone arrays
// `creditosActivos`/`creditosHistorial` en vez del `creditoActivo` singular de
// la Fase 2.
export const clienteDetailSchema = clienteListItemSchema.extend({
  cobradorNombre: z.string().nullable(),
  creditosActivos: z.array(creditoListItemSchema),
  creditosHistorial: z.array(creditoListItemSchema),
  historialPagos: z.array(pagoSchema).optional(),
});
export type ClienteDetail = z.infer<typeof clienteDetailSchema>;

// Body del alta de cliente (pantalla 4c / 17c). Sin `tokenAcceso` (server) y
// con la foto opcional (se sube aparte, ver `uploadFotoDocumentoResponseSchema`).
export const createClienteRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  telefono: z.string().min(1, "El teléfono es obligatorio."),
  documento: z.string().min(1, "El documento es obligatorio."),
  direccion: z.string().min(1, "La dirección es obligatoria."),
  rutaId: z.string().min(1, "Selecciona una ruta."),
  fotoDocumentoFrenteUrl: z.string().url().nullable().optional(),
  fotoDocumentoReversoUrl: z.string().url().nullable().optional(),
});
export type CreateClienteRequest = z.infer<typeof createClienteRequestSchema>;

export const updateClienteRequestSchema = createClienteRequestSchema.partial();
export type UpdateClienteRequest = z.infer<typeof updateClienteRequestSchema>;

// Filtros de la lista (pantalla 3c). El filtro por `estado` se difiere a la
// Fase 3 (depende de Crédito); aquí solo buscador y filtro por ruta.
export const clientesQuerySchema = z.object({
  search: z.string().optional(),
  rutaId: z.string().optional(),
});
export type ClientesQuery = z.infer<typeof clientesQuerySchema>;

// Respuesta del endpoint de subida de foto. El request es multipart (lo valida
// Multer + un file-pipe en el backend), no un schema Zod de body.
export const uploadFotoDocumentoResponseSchema = z.object({
  fotoDocumentoUrl: z.string().url(),
});
export type UploadFotoDocumentoResponse = z.infer<typeof uploadFotoDocumentoResponseSchema>;
