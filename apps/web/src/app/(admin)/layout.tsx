import { RouteGuard } from "@/features/auth";

// El modo de color de esta superficie ya NO se decide acá. Vive en
// `shared/theme`: el default sigue siendo oscuro (DESIGN_SYSTEM.md §0) pero el
// usuario puede cambiarlo, y la clase la escribe el script inline del root
// layout sobre `<html>` antes del primer paint.
//
// Antes había tres fuentes de verdad para el mismo dato: este `className="dark"`
// (que resolvía el SSR), `SurfaceMode` (que replicaba la clase en `<html>` para
// los overlays portalizados a `body`) y el toggle propio de `/dev/ui`. Ahora la
// única es `<html>`, que es la que ven tanto el árbol de la página como los
// portales de Radix.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <RouteGuard allowedRoles={["ADMIN"]} loginPath="/admin/login">
        {children}
      </RouteGuard>
    </div>
  );
}
