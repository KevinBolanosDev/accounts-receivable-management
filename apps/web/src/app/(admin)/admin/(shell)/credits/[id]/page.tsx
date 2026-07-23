import { CreditoDetailScreen } from "@/features/creditos";

export default async function AdminCreditoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreditoDetailScreen creditoId={id} />;
}
