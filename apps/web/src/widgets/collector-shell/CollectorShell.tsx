"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/lib/utils";

import { COLLECTOR_NAV, isCollectorTabActive } from "./nav-items";

// DESIGN_SYSTEM.md §2.6 — shell móvil del cobrador: bottom tab bar siempre
// visible + área de contenido que scrollea. Modo claro (uso en la calle). El
// header lo pone cada pantalla (simple en las pestañas, hero en el alta 17c).
export function CollectorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">{children}</main>

      <nav
        className="flex h-16 shrink-0 items-stretch justify-around border-t border-border bg-background"
        aria-label="Navegación del cobrador"
      >
        {COLLECTOR_NAV.map((item) => {
          const active = isCollectorTabActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-caption",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
