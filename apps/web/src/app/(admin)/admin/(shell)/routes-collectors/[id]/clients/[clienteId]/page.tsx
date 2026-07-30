import { AdminClientCreditsScreen } from "@/features/cobros";

// Créditos de un cliente de la ruta (Admin). Es el paso intermedio del flujo de
// cobro del admin: ruta → cliente → crédito → registrar cobro.
//
// La ruta va ANIDADA bajo la ruta de cobro (no `/admin/clients/[id]/credits`)
// por dos razones: `isNavItemActive` marca "Rutas" activa con el prefijo
// `/admin/routes-collectors`, y el `rutaId` de la URL es lo que arma el "volver"
// a la ruta correcta sin estado extra.
//
// `?tab=historial` se lee ACÁ (server component) y baja como prop, no con
// `useSearchParams`: así `TabsRoot` sigue siendo no-controlado y no hace falta
// un `<Suspense>` ni forzar render dinámico del subárbol.
export default async function AdminRouteClientCreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; clienteId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id, clienteId } = await params;
  const { tab } = await searchParams;
  return (
    <AdminClientCreditsScreen
      rutaId={id}
      clienteId={clienteId}
      initialTab={tab === "historial" ? "historial" : "activos"}
    />
  );
}
