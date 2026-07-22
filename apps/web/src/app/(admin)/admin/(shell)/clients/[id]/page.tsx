import { ClientDetailScreen } from "@/features/clientes";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientDetailScreen clienteId={id} />;
}
