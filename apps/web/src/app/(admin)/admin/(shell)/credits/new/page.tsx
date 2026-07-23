import { CreateCreditoScreen } from "@/features/creditos";

// El query param `clienteId` preselecciona el cliente cuando se llega desde
// la pantalla de detalle (botón "Agregar crédito" en #5c).
export default async function AdminNewCreditoPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>;
}) {
  const params = await searchParams;
  return <CreateCreditoScreen clienteIdInicial={params.clienteId} />;
}
