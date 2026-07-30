import type { CreditoListItem } from "@repo/types";

import { isToday } from "@/shared/lib/format-date";

import { fechaVencimientoCuota } from "./frecuencia";

// Proyección de las cuotas que TODAVÍA no se han pagado, para el bloque
// "Próximas cuotas" del detalle de crédito (#10a).
//
// El backend no expone el cronograma en `GET /credits/:id` (solo `pagos`), así
// que se proyecta acá. La regla es la misma que aplica
// `core/domain/payment-schedule.util.ts`: **una cuota por período** (`frecuencia`)
// desde `fechaInicio`, sin descansos, así que la cuota N vence
// `N - 1` períodos después del inicio. Esto es una PROYECCIÓN de lectura: no
// calcula dinero nuevo (usa `cuotaDiaria` tal cual viaja en el contrato) y no
// decide estados de mora — de eso sigue siendo autoridad el backend.
//
// El paso del calendario vive en `./frecuencia.ts` (una sola implementación
// para todo el front). Si algún día el negocio salta fines de semana o
// feriados, ese helper y el del backend hay que cambiarlos juntos.

export interface UpcomingInstallment {
  numero: number;
  /** ISO. Cuándo TOCA pagarla. */
  fechaVencimiento: string;
  monto: number;
  esHoy: boolean;
}

export interface UpcomingInstallments {
  /** Las próximas `limit` cuotas sin pagar, la más cercana primero. */
  items: UpcomingInstallment[];
  /** Cuántas cuotas quedan en total (no solo las listadas). */
  restantes: number;
  /** La última cuota del crédito, para anclar el final del plazo. */
  ultima: { numero: number; fechaVencimiento: string } | null;
}

type CreditoParaCronograma = Pick<
  CreditoListItem,
  "fechaInicio" | "cuotaDiaria" | "cuotasPagadas" | "cuotasTotal" | "frecuencia"
>;

function vencimientoDeCuota(credito: CreditoParaCronograma, numero: number): string {
  return fechaVencimientoCuota(credito.fechaInicio, numero, credito.frecuencia).toISOString();
}

export function upcomingInstallments(
  credito: CreditoParaCronograma,
  limit = 3,
): UpcomingInstallments {
  const restantes = Math.max(0, credito.cuotasTotal - credito.cuotasPagadas);

  if (restantes === 0 || credito.cuotasTotal <= 0) {
    return { items: [], restantes: 0, ultima: null };
  }

  const primera = credito.cuotasPagadas + 1;
  const items: UpcomingInstallment[] = [];

  for (let numero = primera; numero < primera + limit && numero <= credito.cuotasTotal; numero++) {
    const fechaVencimiento = vencimientoDeCuota(credito, numero);
    items.push({
      numero,
      fechaVencimiento,
      monto: credito.cuotaDiaria,
      esHoy: isToday(fechaVencimiento),
    });
  }

  const ultimaListada = items.at(-1)?.numero;
  // La última cuota solo se muestra si no cayó ya dentro de la lista; si no,
  // se repetiría la misma fila dos veces.
  const ultima =
    ultimaListada === credito.cuotasTotal
      ? null
      : {
          numero: credito.cuotasTotal,
          fechaVencimiento: vencimientoDeCuota(credito, credito.cuotasTotal),
        };

  return { items, restantes, ultima };
}
