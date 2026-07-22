// Modo claro por defecto para la superficie Cobrador (DESIGN_SYSTEM.md §0) — uso en calle, bajo sol directo.
export default function CobradorLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-background text-foreground min-h-screen">{children}</div>;
}
