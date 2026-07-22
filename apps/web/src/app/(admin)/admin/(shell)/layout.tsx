import { AdminShell } from "@/widgets/admin-shell/AdminShell";

// Route-group `(shell)`: envuelve las vistas autenticadas del portal Admin con
// el shell de navegación. No aporta segmento de URL, así que `/admin/login`
// (que vive fuera de este grupo) NO lleva shell. El guard de rol sigue en
// `(admin)/layout.tsx`.
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
