import type { CreditoListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";

// Helpers puros sobre las cifras que ya viajan calculadas en el contrato.
// La lógica de qué estado tiene un crédito la fija el backend (Fase 3 §3.1).

export function porcentajePagado(credito: Pick<CreditoListItem, "porcentajePagado">): number {
  return Math.min(100, Math.max(0, Math.round(credito.porcentajePagado)));
}

export function cuotasPagadasLabel(credito: Pick<CreditoListItem, "cuotasPagadas" | "cuotasTotal">): string {
  return `${credito.cuotasPagadas} / ${credito.cuotasTotal}`;
}

export function formatMontoCredito(monto: number): string {
  return formatCurrency(monto);
}

// Agregados sobre una lista de créditos, para las métricas del detalle de
// cliente ("saldo pendiente", "# de créditos", "total pagado"). Los créditos
// ANULADOS se excluyen: no representan dinero real ni cobrado ni por cobrar.
type CreditoParaAgregar = Pick<CreditoListItem, "estado" | "saldoPendiente" | "totalPagado">;

function vigentes(creditos: CreditoParaAgregar[]): CreditoParaAgregar[] {
  return creditos.filter((c) => c.estado !== "ANULADO");
}

export function saldoPendienteDeCreditos(creditos: CreditoParaAgregar[]): number {
  return Number(vigentes(creditos).reduce((sum, c) => sum + c.saldoPendiente, 0).toFixed(2));
}

export function totalPagadoDeCreditos(creditos: CreditoParaAgregar[]): number {
  return Number(vigentes(creditos).reduce((sum, c) => sum + c.totalPagado, 0).toFixed(2));
}

export function contarCreditos(creditos: CreditoParaAgregar[]): number {
  return vigentes(creditos).length;
}

// Cálculo del crédito en el front (espejo de `derivarMontos` del backend).
// montoTotal = monto + monto*interes/100 ; cuota = montoTotal/cuotas.
// Ej: 1.000.000 capital + 20% = 1.200.000 total ; /4 cuotas = 300.000 por cuota.
// La FRECUENCIA no entra: 4 cuotas semanales valen lo mismo que 4 diarias, lo
// que cambia es cuándo vencen (ver `./frecuencia.ts`).
// Es solo para la vista previa en vivo; el backend recalcula y es la autoridad.
export interface CreditoCalculo {
  interesTotal: number;
  montoTotal: number;
  cuotaDiaria: number;
  cuotas: number;
}

export function calcularCredito(monto: number, interes: number, cuotas: number): CreditoCalculo {
  const m = Number.isFinite(monto) && monto > 0 ? monto : 0;
  const i = Number.isFinite(interes) && interes > 0 ? interes : 0;
  const n = Number.isFinite(cuotas) && cuotas > 0 ? Math.floor(cuotas) : 0;
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const interesTotal = round2(m * (i / 100));
  const montoTotal = round2(m + interesTotal);
  const cuotaDiaria = n > 0 ? round2(montoTotal / n) : 0;
  return { interesTotal, montoTotal, cuotaDiaria, cuotas: n };
}
