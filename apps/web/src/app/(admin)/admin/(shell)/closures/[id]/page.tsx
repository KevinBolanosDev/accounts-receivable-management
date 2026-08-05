import { ClosureDetailScreen } from "@/features/closures";

// DESIGN_SYSTEM.md §3.13 — Detalle del cierre (#13c).
export default async function AdminClosureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClosureDetailScreen id={id} />;
}
