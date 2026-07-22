// Placeholder del Dashboard. Las métricas reales llegan en la Fase 5 (dependen
// de cobros y cierres). El shell de navegación ya lo envuelve.
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground uppercase">Portal Admin</p>
      <h1 className="text-h1">Dashboard</h1>
      <p className="text-body text-muted-foreground max-w-md">
        Las métricas del dashboard llegan en la Fase 5. Usa la navegación lateral para gestionar
        Clientes, Rutas y Cobradores.
      </p>
    </div>
  );
}
