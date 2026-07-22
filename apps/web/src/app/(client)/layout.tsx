// Modo claro por defecto para el Portal Cliente (DESIGN_SYSTEM.md §0) — público, prioriza lectura instantánea.
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-background text-foreground min-h-screen">{children}</div>;
}
