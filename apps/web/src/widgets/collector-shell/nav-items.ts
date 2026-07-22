import { MapPinIcon, ReceiptIcon, UserRoundIcon, UsersIcon, type LucideIcon } from "lucide-react";

export interface CollectorNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// DESIGN_SYSTEM.md §2.6 — bottom tab bar del cobrador (4 ítems).
export const COLLECTOR_NAV: CollectorNavItem[] = [
  { label: "Mi ruta", href: "/collector", icon: MapPinIcon },
  { label: "Clientes", href: "/collector/clients", icon: UsersIcon },
  { label: "Recibos", href: "/collector/receipts", icon: ReceiptIcon },
  { label: "Perfil", href: "/collector/profile", icon: UserRoundIcon },
];

export function isCollectorTabActive(pathname: string, href: string): boolean {
  if (href === "/collector") return pathname === "/collector";
  return pathname === href || pathname.startsWith(`${href}/`);
}
