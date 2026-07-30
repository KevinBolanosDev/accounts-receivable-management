import { ReceiptScreen } from "@/features/receipts";

// Recibo del cobro registrado por el Admin. Es la misma pantalla que ve el
// Cobrador (`/collector/receipts/[pagoId]`) y el mismo endpoint
// (`GET /payments/:pagoId/receipt`, autorizado para ADMIN/COBRADOR de la ruta):
// lo único que cambia es la superficie que la envuelve, y por eso existe esta
// ruta en vez de reusar la del cobrador — el `RouteGuard` de `(collector)`
// rebota a un ADMIN al login del cobrador.
export default async function AdminReceiptPage({
  params,
}: {
  params: Promise<{ pagoId: string }>;
}) {
  const { pagoId } = await params;

  return <ReceiptScreen pagoId={pagoId} />;
}
