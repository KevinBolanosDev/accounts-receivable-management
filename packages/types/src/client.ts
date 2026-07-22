import { z } from "zod";

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
  fotoDocumentoUrl: z.string().url().nullable(),
  rutaId: z.string(),
});
export type Cliente = z.infer<typeof clienteSchema>;

// Fila de la tabla (pantalla 3c) y forma que consume la Client card.
// `saldoPendiente`/`estado`/`porcentajePagado` son datos de Crédito (Fase 3):
// opcionales, el backend real los omite en la Fase 2; el mock los provee.
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

export const pagoSchema = z.object({
  fecha: z.string(),
  monto: z.number(),
  estado: estadoPagoSchema,
});
export type Pago = z.infer<typeof pagoSchema>;

// Crédito activo del cliente (Credit card de 3c/5c). Todo esto es de Crédito
// (Fase 3): el backend real lo entrega vacío en la Fase 2, el mock lo llena.
export const creditoActivoSchema = z.object({
  id: z.string(),
  producto: z.string(),
  montoTotal: z.number(),
  totalPagado: z.number(),
  saldoPendiente: z.number(),
  porcentajePagado: z.number(),
  cuotaDiaria: z.number(),
  cuotasPagadas: z.number(),
  cuotasTotal: z.number(),
  fechaApertura: z.string(),
  proximoPagoHoy: z.boolean(),
});
export type CreditoActivo = z.infer<typeof creditoActivoSchema>;

// Detalle de cliente (pantalla 5c) y preview de 3c. El crédito y el historial
// de pagos se enriquecen en la Fase 3 (aquí son opcionales, mock).
export const clienteDetailSchema = clienteSchema.extend({
  ruta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  cobradorNombre: z.string().nullable(),
  estado: estadoClienteSchema.optional(),
  creditoActivo: creditoActivoSchema.nullable().optional(),
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
  fotoDocumentoUrl: z.string().url().nullable().optional(),
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
