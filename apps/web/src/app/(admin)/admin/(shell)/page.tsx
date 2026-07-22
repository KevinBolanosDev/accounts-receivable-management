import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

// Placeholder del Dashboard. Las métricas reales llegan en la Fase 5 (dependen
// de cobros y cierres).
export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Portal Admin" title="Dashboard" />
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <p className="text-body text-muted-foreground max-w-md">
          Las métricas del dashboard llegan en la Fase 5. Usa la navegación lateral para gestionar
          Clientes, Rutas y Cobradores.
        </p>
      </div>
    </>
  );
}
