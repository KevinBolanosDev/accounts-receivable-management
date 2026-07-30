import { AdminCreditCollectScreen } from "@/features/cobros";

// Detalle de un crédito con registro de cobro (Admin) — el final del flujo
// ruta → cliente → crédito. Muestra pagos realizados, cuotas pendientes y mora,
// y desde acá se registra el cobro y se genera el recibo.
export default async function AdminRouteClientCreditPage({
  params,
}: {
  params: Promise<{ id: string; clienteId: string; creditoId: string }>;
}) {
  const { id, clienteId, creditoId } = await params;

  return (
    <AdminCreditCollectScreen rutaId={id} clienteId={clienteId} creditoId={creditoId} />
  );
}
