"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { ADMIN_MOBILE_TABS, isMoreTabActive, isNavItemActive } from "./nav-items";
import { useAdminShell } from "./shell-context";

// DESIGN_SYSTEM.md §2.6 + §6 — navegación móvil del portal Admin: bottom tab
// bar fija con las 4 vistas principales + "Más", que abre el Sheet con el
// resto de la sidebar (Cobradores, Cierres, Reportes y cerrar sesión). Desde
// `lg` desaparece: ahí la navegación es la sidebar fija.
//
// El `<main>` del AdminShell compensa la altura con `pb-16`; la barra es
// `fixed` y no `sticky` porque en <lg el contenedor del shell no crea contexto
// de scroll propio (`lg:overflow-y-auto`), scrollea el body.

// 44px de área táctil mínima (§6) y 24px de icono en navegación (§1.6).
const TAB_CLASS =
  "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-caption transition-colors";

/** Barrita superior que marca la pestaña activa. */
function ActiveMark() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
    />
  );
}

export function AdminBottomNav() {
  const pathname = usePathname();
  const { openMoreNav } = useAdminShell();
  const moreActive = isMoreTabActive(pathname);

  return (
    <nav
      // `env(safe-area-inset-bottom)` para que la barra no quede bajo el
      // indicador de gestos en iOS.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-border bg-background/95 backdrop-blur lg:hidden"
      aria-label="Navegación principal"
    >
      {ADMIN_MOBILE_TABS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(TAB_CLASS, active ? "text-primary" : "text-muted-foreground")}
          >
            {active ? <ActiveMark /> : null}
            <Icon className="size-6 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={openMoreNav}
        aria-haspopup="dialog"
        className={cn(TAB_CLASS, moreActive ? "text-primary" : "text-muted-foreground")}
      >
        {moreActive ? <ActiveMark /> : null}
        <MoreHorizontalIcon className="size-6 shrink-0" />
        <span className="truncate">Más</span>
      </button>
    </nav>
  );
}
