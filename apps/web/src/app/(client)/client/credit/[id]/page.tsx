import { ClientCreditDetailScreen } from "@/features/client-portal";

// DESIGN_SYSTEM.md §5.2 — `#21c`, detalle de un crédito puntual. Next 16:
// `params` llega como Promise, se resuelve con `await`.
export default async function ClientCreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientCreditDetailScreen creditoId={id} />;
}
