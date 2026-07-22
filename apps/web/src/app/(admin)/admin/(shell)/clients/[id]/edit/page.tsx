import { ClientFormScreen } from "@/features/clients";

export default async function AdminEditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientFormScreen clienteId={id} />;
}
