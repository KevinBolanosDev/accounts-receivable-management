import { formatCurrency } from "@/shared/lib/format-currency";

// Mensaje de WhatsApp al cerrar una ruta (#19c, "Compartir por WhatsApp") —
// sin destinatario fijo (el cierre no tiene un `reciboPublicUrl` firmado como
// el pago: es un documento interno, no algo que el cliente deba ver), mismo
// patrón `buildWhatsAppUrl({text})` que ya usa `entities/receipt`.
export function buildClosureShareText(closure: {
  rutaNombre: string;
  totalCollected: number;
  collectedCount: number;
  unpaidCount: number;
}): string {
  return [
    `Cierre de ${closure.rutaNombre}`,
    `Total cobrado: ${formatCurrency(closure.totalCollected)} (${closure.collectedCount} ${closure.collectedCount === 1 ? "cobro" : "cobros"})`,
    `Clientes sin pagar: ${closure.unpaidCount}`,
  ].join("\n");
}
