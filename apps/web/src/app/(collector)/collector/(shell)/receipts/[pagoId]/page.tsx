import { ReceiptScreen } from "@/features/receipts";

// DESIGN_SYSTEM.md §4.5 — Recibo y compartir (Cobrador, móvil). Recibe el
// `pagoId` por URL; el front decide si usar el store efímero (4.7) o hacer
// fetch contra el back (4.9) según `searchParams.fromCobro`.
export default async function CollectorReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ pagoId: string }>;
  searchParams: Promise<{ fromCobro?: string }>;
}) {
  const { pagoId } = await params;
  const { fromCobro } = await searchParams;

  // 4.7: si `fromCobro=true` y hay datos en el store efímero, podríamos
  // construir el HTML localmente sin fetch. Por ahora siempre vamos al back;
  // cuando se implemente el store, este componente sabrá leerlo.
  void fromCobro;

  return <ReceiptScreen pagoId={pagoId} />;
}