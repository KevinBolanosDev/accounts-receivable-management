import { z } from "zod";

// Módulo HOJA a propósito: no importa ningún otro archivo de este paquete.
//
// `pagoSchema` lo necesitan tanto `./credito` (para `creditoDetailSchema.pagos`)
// como `./cobro` (para `cobroResponseSchema.pago`), y `./cobro` a su vez necesita
// `creditoListItemSchema` de `./credito`. Mientras `pagoSchema` vivió en
// `./cobro` eso formaba un ciclo `cobro ↔ credito` que en CommonJS dejaba
// `cobroResponseSchema.shape.credito === undefined` (el valor se captura al
// construir el literal, cuando `./credito` todavía está a medio evaluar), y
// `POST /collections` devolvía 500 tras haber guardado el pago. Ver
// `ESTADO_ACTUAL.md` §7.2. Al sacarlo a una hoja el grafo queda lineal:
// `payment → credito → cobro`.
export const pagoSchema = z.object({
  id: z.string(),
  creditoId: z.string(),
  monto: z.number(),
  fecha: z.string(),
  cobradorId: z.string(),
  cobradorNombre: z.string().nullable().optional(), // nombre del cobrador (columna del detalle #10a)
  reciboUrl: z.string().url().nullable(),
});
export type Pago = z.infer<typeof pagoSchema>;
