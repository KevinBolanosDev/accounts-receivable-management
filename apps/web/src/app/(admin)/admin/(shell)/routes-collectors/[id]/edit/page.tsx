import { RouteFormScreen } from "@/features/rutas";

export default async function AdminEditRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RouteFormScreen rutaId={id} />;
}
