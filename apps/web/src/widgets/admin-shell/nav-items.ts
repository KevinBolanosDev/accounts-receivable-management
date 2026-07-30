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
  /**
   * Prefijo contra el que se decide el estado activo, si es distinto de
   * `href`. Existe por "Créditos": el Link navega directo a
   * `/admin/credits/new` (ver el gotcha más abajo), pero el ítem debe seguir
   * marcado activo en `/admin/credits/[id]` también.
   */
  match?: string;
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
  // El Link navega DIRECTO a "nuevo", no a `/admin/credits`: esa ruta no es
  // una pantalla, es un `page.tsx` que solo hace `redirect("/admin/credits/new")`
  // (ver su comentario). Pasar por ahí en cada click hace que Next dispare esa
  // redirección como una transición de cliente, y React 19.2 la trata como un
  // fiber "errored" (el `redirect()` de Next funciona lanzando un throw) — su
  // instrumentación nueva de DevTools (Performance "Components" track) llama
  // `performance.measure()` sin try/catch y, en esa combinación específica,
  // revienta con "cannot have a negative time stamp". `match` conserva el
  // ítem activo también en `/admin/credits/[id]` sin tener que pasar por el
  // redirect para llegar ahí.
  {
    label: "Créditos",
    href: "/admin/credits/new",
    match: "/admin/credits",
    icon: CreditCardIcon,
    enabled: true,
  },
  { label: "Cierres", href: "/admin/closures", icon: SquareCheckBigIcon, enabled: false },
  { label: "Cobradores", href: "/admin/collectors", icon: UsersRoundIcon, enabled: true },
  { label: "Reportes", href: "/admin/reports", icon: BarChart3Icon, enabled: false },
];

// Un ítem está activo si es su ruta exacta o una sub-ruta suya. Dashboard
// (`/admin`) es exacto, si no marcaría activo todo el portal.
export function isNavItemActive(
  pathname: string,
  item: Pick<AdminNavItem, "href" | "match">,
): boolean {
  const prefix = item.match ?? item.href;
  if (prefix === "/admin") return pathname === "/admin";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Los 4 destinos con pestaña propia en la bottom bar móvil. El resto de
// `ADMIN_NAV` cae bajo "Más" (el Sheet lateral), que además incluye la ficha
// de usuario y "Cerrar sesión". Se deriva de `ADMIN_NAV` en vez de duplicar
// labels/iconos: agregar un ítem a la sidebar lo hace aparecer en "Más" solo.
const MOBILE_TAB_HREFS = [
  "/admin",
  "/admin/clients",
  "/admin/routes-collectors",
  "/admin/credits/new",
];

export const ADMIN_MOBILE_TABS: AdminNavItem[] = MOBILE_TAB_HREFS.map((href) =>
  ADMIN_NAV.find((item) => item.href === href),
).filter((item): item is AdminNavItem => item !== undefined && item.enabled);

export const ADMIN_MORE_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !MOBILE_TAB_HREFS.includes(item.href),
);

// La pestaña "Más" se marca activa cuando la vista actual pertenece a alguno
// de los ítems que quedaron dentro del Sheet.
export function isMoreTabActive(pathname: string): boolean {
  return ADMIN_MORE_NAV.some((item) => isNavItemActive(pathname, item));
}

// Título de la vista actual para el topbar (el ítem de nav más específico).
export function currentNavLabel(pathname: string): string {
  const match = [...ADMIN_NAV]
    .sort((a, b) => (b.match ?? b.href).length - (a.match ?? a.href).length)
    .find((item) => isNavItemActive(pathname, item));
  return match?.label ?? "Admin";
}
