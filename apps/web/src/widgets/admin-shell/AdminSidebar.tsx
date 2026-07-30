"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/lib/utils";

import { ADMIN_NAV, isNavItemActive } from "./nav-items";
import { UserMenu } from "./UserMenu";

// Marca "anillo + CobroDiario" (DESIGN_SYSTEM.md §1.7, elemento de firma).
function SidebarBrand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="block">
        <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3.5" className="stroke-border" />
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="81.7"
          strokeDashoffset="24.5"
          transform="rotate(-90 16 16)"
          className="stroke-accent"
        />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">CobroDiario</span>
    </div>
  );
}

// Navegación de escritorio del portal Admin. Solo se monta desde `lg`: en
// móvil la navegación es la bottom tab bar + el sheet "Más", que se componen
// aparte en vez de reutilizar este sidebar.
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Navegación principal">
        {ADMIN_NAV.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;

          const base =
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className={cn(base, "cursor-default text-muted-foreground")}
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                base,
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <UserMenu variant="row" />
      </div>
    </div>
  );
}
