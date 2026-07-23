import {
  BarChart3Icon,
  CreditCardIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  SquareCheckBigIcon,
  UserIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** En la Fase 2 solo Clientes, Rutas y Cobradores están cableados. */
  enabled: boolean;
}

// DESIGN_SYSTEM.md §2.6 — orden de la sidebar del portal Admin. Todos los
// ítems se muestran por fidelidad; los deshabilitados son placeholders
// ("Pronto") hasta que su fase los active.
export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboardIcon, enabled: true },
  { label: "Clientes", href: "/admin/clients", icon: UserIcon, enabled: true },
  { label: "Rutas", href: "/admin/routes-collectors", icon: MapPinIcon, enabled: true },
  { label: "Créditos", href: "/admin/credits/new", icon: CreditCardIcon, enabled: true },
  { label: "Cierres", href: "/admin/closures", icon: SquareCheckBigIcon, enabled: false },
  { label: "Cobradores", href: "/admin/collectors", icon: UsersRoundIcon, enabled: true },
  { label: "Reportes", href: "/admin/reports", icon: BarChart3Icon, enabled: false },
];

// Un ítem está activo si es su ruta exacta o una sub-ruta suya. Dashboard
// (`/admin`) es exacto, si no marcaría activo todo el portal.
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Título de la vista actual para el topbar (el ítem de nav más específico).
export function currentNavLabel(pathname: string): string {
  const match = [...ADMIN_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "Admin";
}
