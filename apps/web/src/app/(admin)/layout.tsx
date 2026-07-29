import { RouteGuard } from "@/features/auth";
import { SurfaceMode } from "@/shared/ui/surface-mode";

// Modo oscuro por defecto para la superficie Admin (DESIGN_SYSTEM.md §0) — fijo en el server, sin FOUC.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-background text-foreground min-h-screen">
      {/* La clase de arriba cubre el árbol de la página; `SurfaceMode` la
          replica en <html> para que los overlays portalizados a `body`
          (Sheet, Dialog, DropdownMenu, Select, Toaster) no se pinten claros. */}
      <SurfaceMode mode="dark" />
      <RouteGuard allowedRoles={["ADMIN"]} loginPath="/admin/login">
        {children}
      </RouteGuard>
    </div>
  );
}
