import { MapPinIcon, ReceiptIcon, UserRoundIcon, UsersIcon, type LucideIcon } from "lucide-react";

export interface CollectorNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// DESIGN_SYSTEM.md §2.6 — bottom tab bar del cobrador (4 ítems). Un cobrador
// puede tener VARIAS rutas: la pestaña raíz es "Mis rutas" (lista) y el detalle
// de cada una vive en /collector/routes/[id].
export const COLLECTOR_NAV: CollectorNavItem[] = [
  { label: "Mis rutas", href: "/collector", icon: MapPinIcon },
  { label: "Clientes", href: "/collector/clients", icon: UsersIcon },
  { label: "Recibos", href: "/collector/receipts", icon: ReceiptIcon },
  { label: "Perfil", href: "/collector/profile", icon: UserRoundIcon },
];

export function isCollectorTabActive(pathname: string, href: string): boolean {
  if (href === "/collector") {
    // La pestaña "Mis rutas" cubre la lista y el detalle de ruta.
    return pathname === "/collector" || pathname.startsWith("/collector/routes");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
