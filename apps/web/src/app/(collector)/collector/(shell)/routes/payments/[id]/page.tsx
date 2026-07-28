import { ClientPaymentsScreen } from "@/features/cobros";

// DESIGN_SYSTEM.md §3.5 — Pagos del cliente (#16c): resumen del cliente +
// créditos + historial por crédito. Vive bajo /collector/routes/payments
// porque el flujo siempre se entra desde una ruta (RouteDetailScreen).
//
// `?tab=historial` se lee ACÁ (server component) y baja como prop, no con
// `useSearchParams` en el cliente: así `TabsRoot` sigue siendo no-controlado y
// no hace falta un `<Suspense>` ni forzar render dinámico de todo el subárbol.
// Sirve para volver a la pestaña correcta desde el detalle de un crédito.
export default async function CollectorRoutePaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  return (
    <ClientPaymentsScreen
      clienteId={id}
      initialTab={tab === "historial" ? "historial" : "activos"}
    />
  );
}
