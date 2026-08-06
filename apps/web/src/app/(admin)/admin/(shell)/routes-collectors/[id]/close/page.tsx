import { AdminCloseRouteScreen } from "@/features/closures";

// Cierre de ruta (#19c) en la superficie del Admin — espejo de
// `/collector/routes/[id]/close`. El Admin puede cerrar cualquier ruta de su
// tenant (incluida una que cobra en persona, "Mis rutas"), el backend ya lo
// permitía (`assertRouteOwnership` solo restringe a COBRADOR); faltaba la
// pantalla.
export default async function AdminCloseRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCloseRouteScreen rutaId={id} />;
}
