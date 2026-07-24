import { ReceiptScreen } from "@/features/receipts";

// DESIGN_SYSTEM.md §4.5 — Recibo y compartir (Cobrador, móvil). Recibe el
// `pagoId` por URL y siempre pide el HTML al back (GET /payments/:pagoId/receipt).
export default async function CollectorReceiptPage({
  params,
}: {
  params: Promise<{ pagoId: string }>;
}) {
  const { pagoId } = await params;

  return <ReceiptScreen pagoId={pagoId} />;
}
