import { CreateCreditoScreen } from "@/features/creditos";

export default async function AdminEditCreditoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreateCreditoScreen creditoId={id} />;
}
