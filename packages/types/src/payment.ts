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
  // Un pago mal registrado se ANULA, nunca se edita ni se borra (mismo
  // patrón que `Credito.estado = ANULADO`): el registro queda, el saldo del
  // crédito se devuelve, y la corrección es un pago NUEVO. `.default(false)`
  // porque es un campo de respuesta nuevo (lector tolerante, ver CLAUDE.md
  // raíz) — un backend viejo que todavía no lo manda no debe romper el parse.
  anulado: z.boolean().default(false),
  anuladoAt: z.string().nullable().optional(),
  anuladoPorNombre: z.string().nullable().optional(),
});
export type Pago = z.infer<typeof pagoSchema>;
