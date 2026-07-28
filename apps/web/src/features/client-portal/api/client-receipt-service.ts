import { fetchReceiptHtml } from "@/entities/receipt";
import { useClientSessionStore } from "@/entities/session";

// Fase 4.12 — el cliente ve el recibo de sus propios pagos a través de un
// endpoint scoped por pertenencia (`GET /client-portal/payments/:pagoId/receipt`),
// NO por el endpoint de staff (`/payments/:pagoId/receipt` — otro rol, otro
// scoping). Esa distinción ahora la expresa el `scope` de la entity.
//
// El transporte se mudó a `entities/receipt` al aparecer el TERCER consumidor:
// el detalle de crédito del Cobrador también baja el HTML del recibo, y
// `features/cobros` no puede importar `features/receipts` (acoplamiento
// horizontal). Acá solo queda resolver el token, que es lo propio de esta
// feature.
export function getClientReceiptHtml(pagoId: string): Promise<string> {
  const token = useClientSessionStore.getState().token;
  return fetchReceiptHtml({ pagoId, scope: "client", token });
}
