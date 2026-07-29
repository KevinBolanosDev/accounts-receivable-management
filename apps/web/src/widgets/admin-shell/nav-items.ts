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
  // `/admin/credits` redirige a `/admin/credits/new` (ver su `page.tsx`): el
  // destino es el mismo, pero con el href del padre `isNavItemActive` sí marca
  // el ítem en `/admin/credits/new` y `/admin/credits/[id]`.
  { label: "Créditos", href: "/admin/credits", icon: CreditCardIcon, enabled: true },
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

// Los 4 destinos con pestaña propia en la bottom bar móvil. El resto de
// `ADMIN_NAV` cae bajo "Más" (el Sheet lateral), que además incluye la ficha
// de usuario y "Cerrar sesión". Se deriva de `ADMIN_NAV` en vez de duplicar
// labels/iconos: agregar un ítem a la sidebar lo hace aparecer en "Más" solo.
const MOBILE_TAB_HREFS = ["/admin", "/admin/clients", "/admin/routes-collectors", "/admin/credits"];

export const ADMIN_MOBILE_TABS: AdminNavItem[] = MOBILE_TAB_HREFS.map((href) =>
  ADMIN_NAV.find((item) => item.href === href),
).filter((item): item is AdminNavItem => item !== undefined && item.enabled);

export const ADMIN_MORE_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !MOBILE_TAB_HREFS.includes(item.href),
);

// La pestaña "Más" se marca activa cuando la vista actual pertenece a alguno
// de los ítems que quedaron dentro del Sheet.
export function isMoreTabActive(pathname: string): boolean {
  return ADMIN_MORE_NAV.some((item) => isNavItemActive(pathname, item.href));
}

// Título de la vista actual para el topbar (el ítem de nav más específico).
export function currentNavLabel(pathname: string): string {
  const match = [...ADMIN_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "Admin";
}
