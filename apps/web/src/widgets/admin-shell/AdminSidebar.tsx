"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import type { Rol } from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { ADMIN_NAV, isNavItemActive } from "./nav-items";

interface AdminSidebarProps {
  /** Se llama al navegar (cierra el Sheet en móvil). */
  onNavigate?: () => void;
}

const ROL_LABEL: Record<Rol, string> = {
  ADMIN: "Administrador",
  COBRADOR: "Cobrador",
};

function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts[parts.length - 1];
  if (parts.length === 1 || !last) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

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

// Ficha de usuario al pie del sidebar: avatar de iniciales + nombre + rol, y
// menú con "Cerrar sesión".
function SidebarUser() {
  const router = useRouter();
  const usuario = useSessionStore((state) => state.usuario);
  const clearSession = useSessionStore((state) => state.clearSession);

  const nombre = usuario?.nombre ?? "Admin";

  function handleLogout() {
    clearSession();
    router.push("/admin/login");
  }

  return (
    <div className="shrink-0 border-t border-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials(nombre)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{nombre}</span>
              <span className="truncate text-caption text-muted-foreground">
                {ROL_LABEL[usuario?.rol ?? "ADMIN"]}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel>{nombre}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
            <LogOutIcon />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <SidebarBrand />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Navegación principal">
        {ADMIN_NAV.map((item) => {
          const active = isNavItemActive(pathname, item.href);
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
              onClick={onNavigate}
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

      <SidebarUser />
    </div>
  );
}
