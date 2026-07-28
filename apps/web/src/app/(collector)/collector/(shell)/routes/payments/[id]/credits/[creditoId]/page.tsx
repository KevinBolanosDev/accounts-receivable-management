import { CollectorCreditDetailScreen } from "@/features/cobros";

// Detalle de un crédito del cliente (historial modular): info del crédito +
// las cuotas de ESE crédito, con recibo descargable y compartible.
//
// La ruta va ANIDADA bajo el cliente y no plana (`/collector/credits/[id]`)
// porque `widgets/collector-shell/nav-items.ts` marca la pestaña activa con
// `pathname.startsWith("/collector/routes")`: una ruta plana no encendería
// ninguna pestaña del tab bar. Anidada también da los dos ids sin query string,
// así el "volver" se arma sin estado extra.
export default async function CollectorCreditDetailPage({
  params,
}: {
  params: Promise<{ id: string; creditoId: string }>;
}) {
  const { id, creditoId } = await params;

  return <CollectorCreditDetailScreen clienteId={id} creditoId={creditoId} />;
}
