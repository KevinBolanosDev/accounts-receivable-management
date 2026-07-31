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
  // El bucket de Supabase es PRIVADO (documentos de identidad): `*Path` es lo
  // que se persiste — un path dentro del bucket, no una URL — y viaja tanto en
  // requests como en responses. `*Url` es de SOLO LECTURA: una URL firmada con
  // expiración que el backend emite en cada respuesta del DETALLE (nunca en
  // listas — ver `clienteListItemSchema`) y que nunca se persiste ni se manda
  // de vuelta en un request. Mandar la URL firmada como si fuera el path
  // corrompería la columna en silencio, por eso son dos campos y no uno que
  // signifique cosas distintas según la dirección.
  fotoDocumentoFrentePath: z.string().nullable(),
  fotoDocumentoReversoPath: z.string().nullable(),
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
// `fotoDocumento*Url` siempre viene `null` en las listas: firmar N×2 URLs por
// fila sería un round-trip a Storage por cada cliente listado, y hoy ninguna
// lista pinta la foto (solo el detalle la muestra). El *Path sí viaja, por si
// el listado necesitara saber si el cliente tiene foto sin mostrarla.
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
  // Solo lo marca `POST /clients` cuando el alta reactivó a un cliente que
  // este admin había dado de baja (misma persona, mismo documento) en vez de
  // crear uno nuevo. Los `GET` nunca lo mandan — de ahí el `.default(false)`,
  // que además es la regla de lector tolerante: un campo de respuesta nuevo y
  // requerido rompe el front contra un backend que todavía no lo emite.
  //
  // Existe porque la diferencia le importa al usuario: al reactivar vuelven
  // sus créditos y su historial de pagos, y la UI tiene que decirlo en vez de
  // anunciar un alta limpia.
  reactivado: z.boolean().default(false),
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
  //
  // El `""` se normaliza a null porque es lo que emite un <select> sin opción
  // elegida, y en el contrato eso significa "sin ruta", no "una ruta cuyo id
  // es la cadena vacía". Sin esto, `""` es un string válido para el schema
  // pero falsy en JS: el backend se saltaba la validación de acceso a la ruta
  // (`if (body.rutaId)`) y le pasaba el `""` a Prisma, que reventaba contra la
  // FK — un 500 en cada alta de cliente sin ruta.
  rutaId: z
    .string()
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
  // Solo el PATH (sin `.url()`): es lo único que el request puede llevar. La
  // URL firmada es de solo lectura y sale del backend en cada `GET` — nunca
  // entra por acá.
  fotoDocumentoFrentePath: z.string().nullable().optional(),
  fotoDocumentoReversoPath: z.string().nullable().optional(),
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
// `path` es lo que el form debe guardar y volver a mandar al crear/editar el
// cliente; `url` es la firmada, solo para el preview inmediato tras subir.
export const uploadFotoDocumentoResponseSchema = z.object({
  path: z.string(),
  url: z.string().url(),
});
export type UploadFotoDocumentoResponse = z.infer<typeof uploadFotoDocumentoResponseSchema>;

// Límite y tipos compartidos entre front y back para la foto de documento.
// Antes solo existían en el pipe del backend (`ImageFileValidationPipe`); el
// frontend no los conocía y dejaba pasar cualquier archivo hasta que el
// servidor lo rechazaba — un viaje de red completo (a veces varios MB) solo
// para enterarse de que el archivo no servía.
export const MAX_DOCUMENT_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

// Fase 4.13 — respuesta de `POST /clients/:id/access` (genera/resetea la
// contraseña temporal del portal). `temporaryPassword` se muestra UNA vez al
// staff (no se persiste en claro, solo el hash) — el dialog del front debe
// copiarla antes de cerrar.
export const generateAccessResponseSchema = z.object({
  temporaryPassword: z.string(),
  expiresAt: z.string(),
});
export type GenerateAccessResponse = z.infer<typeof generateAccessResponseSchema>;
