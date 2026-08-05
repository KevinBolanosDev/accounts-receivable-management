import type { CuotaEstado } from "@repo/types";

// Mapeo dominio → presentación de la puntualidad de una cuota.
//
// La FRONTERA importa: `shared/ui/badge.tsx` es dueño de los tokens visuales;
// este archivo es dueño de la traducción `CuotaEstado → token` y de las
// etiquetas en español. `shared` no puede importar `@repo/types`, así que el
// mapa no puede vivir allá.

export const CUOTA_ESTADO_LABEL: Record<CuotaEstado, string> = {
  ON_TIME: "Pagado a tiempo",
  LATE: "Pagado tarde",
  PENDING: "Pendiente",
  OVERDUE: "Vencida",
  DEFAULTED: "En mora",
  ANULADO: "Pago anulado",
};

// Para las filas compactas del móvil, donde no cabe la etiqueta larga.
export const CUOTA_ESTADO_LABEL_SHORT: Record<CuotaEstado, string> = {
  ON_TIME: "A tiempo",
  LATE: "Tarde",
  PENDING: "Pendiente",
  OVERDUE: "Vencida",
  DEFAULTED: "Mora",
  ANULADO: "Anulado",
};

export const CUOTA_ESTADO_BADGE_STATUS = {
  ON_TIME: "on-time",
  LATE: "late",
  // Vence hoy: todavía se puede cobrar, así que va neutro y no como alerta.
  PENDING: "missed",
  OVERDUE: "overdue",
  DEFAULTED: "defaulted",
  ANULADO: "anulado",
} as const satisfies Record<CuotaEstado, string>;

/** Una cuota sin pagar (no tiene `Pago` detrás: ni monto, ni recibo). */
export function esCuotaSinPagar(estado: CuotaEstado): boolean {
  return estado === "PENDING" || estado === "OVERDUE" || estado === "DEFAULTED";
}

/**
 * Una fila de auditoría (pago que existió y se anuló). Se usa para NO
 * mostrar "Cuota 0/N" (su `numeroCuota` es un sentinel, no un número real del
 * cronograma) y para decidir si corresponde ofrecer "Anular" sobre ella
 * (un pago ya anulado no se puede anular de nuevo).
 */
export function esCuotaAnulada(estado: CuotaEstado): boolean {
  return estado === "ANULADO";
}
