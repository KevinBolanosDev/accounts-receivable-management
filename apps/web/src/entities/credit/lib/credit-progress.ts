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
