import { LogoutButton } from "@/features/auth";

export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-3 px-8">
      <p className="text-caption text-muted-foreground uppercase">Portal Admin</p>
      <h1 className="text-h1">Dashboard</h1>
      <p className="text-body text-muted-foreground max-w-md">
        Las pantallas de Admin llegan en las próximas fases. Esta ruta solo confirma que la
        superficie abre en modo oscuro por defecto.
      </p>
      <LogoutButton loginPath="/admin/login" />
    </main>
  );
}
