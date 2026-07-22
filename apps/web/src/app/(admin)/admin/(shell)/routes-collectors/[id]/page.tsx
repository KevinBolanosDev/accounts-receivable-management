import { RouteDetailScreen } from "@/features/routes-collectors";

export default async function AdminRouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RouteDetailScreen rutaId={id} />;
}
