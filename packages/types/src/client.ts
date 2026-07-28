import { z } from "zod";

import { creditoListItemSchema } from "./credito";
import { paymentHistoryItemSchema } from "./payment-history";

// Estado de crédito derivado (badges §2.3). Es dato de Crédito → Fase 3.
export const estadoClienteSchema = z.enum(["activo", "proximo-a-vencer", "mora", "pagado"]);
export type EstadoCliente = z.infer<typeof estadoClienteSchema>;

// Cliente expuesto al frontend. NUNCA incluye `passwordHash`,
// `failedLoginAttempts`, `lockedUntil` ni `passwordExpiresAt` (datos
// sensibles del acceso al portal del cliente, Fase 4). El personal del staff
// accede al cliente vía `useCliente(id)`; el cliente se autentica por sí
// mismo vía `clientAuthUserSchema` (auth-cliente.ts).
export const clienteSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  telefono: z.string(),
  documento: z.string(),
  direccion: z.string(),
  fotoDocumentoFrenteUrl: z.string().url().nullable(),
  fotoDocumentoReversoUrl: z.string().url().nullable(),
  // Nullable desde el cierre de Fase 3: un cliente puede quedar "sin ruta" si
  // se lo quita desde la pantalla de Ruta (no se borra, solo se desasigna).
  rutaId: z.string().nullable(),
  // Contacto de referencia (persona a la que llamar si no se ubica al cliente).
  // Opcional: la enorme mayoría de los clientes ya dados de alta no lo tienen.
  contactoNombre: z.string().nullable().optional(),
  contactoTelefono: z.string().nullable().optional(),
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
  // Enriquecido (numeroCuota/estado/reciboCodigo/reciboPublicUrl) desde el
  // historial modular del Cobrador: es el MISMO shape que consume el portal del
  // cliente, así ambas superficies comparten los componentes de historial.
  historialPagos: z.array(paymentHistoryItemSchema).optional(),
  // Fase 4.14 — estado de acceso al Portal Cliente, visible para ADMIN/
  // COBRADOR en el detalle. Deriva de `passwordHash` sin exponerlo nunca
  // (ni `failedLoginAttempts`/`lockedUntil`/`passwordExpiresAt` — esos siguen
  // siendo exclusivos de `clientAuthUserSchema`, la vista del propio cliente).
  tieneAccesoPortal: z.boolean(),
  mustChangePassword: z.boolean(),
  lastLoginAt: z.string().nullable(),
});
export type ClienteDetail = z.infer<typeof clienteDetailSchema>;

// Body del alta de cliente (pantalla 4c / 17c). La foto del documento se
// sube aparte (ver `uploadFotoDocumentoResponseSchema`). El acceso al portal
// (password temporal) lo genera el staff por separado, en una acción
// explícita (`POST /clients/:id/access`, Fase 4).
export const createClienteRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  telefono: z.string().min(1, "El teléfono es obligatorio."),
  documento: z.string().min(1, "El documento es obligatorio."),
  direccion: z.string().min(1, "La dirección es obligatoria."),
  // Opcional/nullable: el alta puede dejar al cliente "sin ruta" (bucket
  // "Sin asignar" en Admin); se asigna después desde la pantalla de Ruta.
  rutaId: z.string().nullable().optional(),
  fotoDocumentoFrenteUrl: z.string().url().nullable().optional(),
  fotoDocumentoReversoUrl: z.string().url().nullable().optional(),
  // Contacto de referencia: ambos opcionales e independientes entre sí.
  contactoNombre: z.string().nullable().optional(),
  contactoTelefono: z.string().nullable().optional(),
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

// Resumen agregado para la tira de métricas de la vista "Clientes" del
// Cobrador (clientes / total cartera / cobrados / saldo). `cartera` y
// `cobrados` no se pueden derivar de `clienteListItemSchema` (solo trae
// `saldoPendiente`), así que el backend los agrega sobre los créditos reales
// del cliente (excluyendo créditos ANULADOS).
export const clientesSummarySchema = z.object({
  clientes: z.number().int(),
  cartera: z.number(),
  cobrados: z.number(),
  saldo: z.number(),
});
export type ClientesSummary = z.infer<typeof clientesSummarySchema>;

// Respuesta del endpoint de subida de foto. El request es multipart (lo valida
// Multer + un file-pipe en el backend), no un schema Zod de body.
export const uploadFotoDocumentoResponseSchema = z.object({
  fotoDocumentoUrl: z.string().url(),
});
export type UploadFotoDocumentoResponse = z.infer<typeof uploadFotoDocumentoResponseSchema>;

// Fase 4.13 — respuesta de `POST /clients/:id/access` (genera/resetea la
// contraseña temporal del portal). `temporaryPassword` se muestra UNA vez al
// staff (no se persiste en claro, solo el hash) — el dialog del front debe
// copiarla antes de cerrar.
export const generateAccessResponseSchema = z.object({
  temporaryPassword: z.string(),
  expiresAt: z.string(),
});
export type GenerateAccessResponse = z.infer<typeof generateAccessResponseSchema>;
