// Modo oscuro por defecto para la superficie Admin (DESIGN_SYSTEM.md §0) — fijo en el server, sin FOUC.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark bg-background text-foreground min-h-screen">{children}</div>;
}
