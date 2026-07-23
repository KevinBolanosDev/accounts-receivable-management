import { ClientPaymentsScreen } from "@/features/cobros";

// DESIGN_SYSTEM.md §3.5 — Pagos del cliente (#16c): resumen del cliente +
// historial de pagos + registrar cobro. Vive bajo /collector/routes/payments
// porque el flujo siempre se entra desde una ruta (RouteDetailScreen).
export default function CollectorRoutePaymentsPage() {
  return <ClientPaymentsScreen />;
}
