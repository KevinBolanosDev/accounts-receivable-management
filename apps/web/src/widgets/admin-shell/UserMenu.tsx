"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import type { Rol } from "@repo/types";

import { useSessionStore } from "@/entities/session";
import { getInitials } from "@/shared/lib/initials";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

const ROL_LABEL: Record<Rol, string> = {
  ADMIN: "Administrador",
  COBRADOR: "Cobrador",
  // El cliente nunca llega al AdminShell (el `RouteGuard` lo bloquea), pero
  // el tipo exige cubrir el caso — mantener el `Record<Rol, string>` exhaustivo.
  CLIENTE: "Cliente",
};

interface UserMenuProps {
  /**
   * `avatar`: solo el círculo de iniciales, para el topbar. Es la única salida
   * de sesión en móvil, donde ya no hay sidebar.
   * `row`: ficha completa (iniciales + nombre + rol) al pie del sidebar.
   */
  variant: "avatar" | "row";
  /**
   * El disco va sobre el degradado del header: `bg-primary` se pierde contra
   * él, así que se cambia por un velo translúcido blanco.
   */
  onGradient?: boolean;
  className?: string;
}

// Menú de usuario del portal Admin: identidad + "Cerrar sesión". Vive en un
// solo componente y se pinta en dos sitios (topbar y pie del sidebar) para que
// el contenido del menú no se bifurque.
export function UserMenu({ variant, onGradient, className }: UserMenuProps) {
  const router = useRouter();
  const usuario = useSessionStore((state) => state.usuario);
  const clearSession = useSessionStore((state) => state.clearSession);

  const nombre = usuario?.nombre ?? "Admin";
  const rol = ROL_LABEL[usuario?.rol ?? "ADMIN"];

  function handleLogout() {
    clearSession();
    router.push("/admin/login");
  }

  const initials = (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        onGradient
          ? "bg-white/20 text-white ring-1 ring-white/30"
          : "bg-primary text-primary-foreground",
      )}
    >
      {getInitials(nombre)}
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Cuenta de ${nombre}`}
          className={cn(
            "flex items-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            variant === "row" && "w-full gap-3 rounded-md p-2 text-left hover:bg-muted",
            className,
          )}
        >
          {initials}
          {variant === "row" ? (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{nombre}</span>
              <span className="truncate text-caption text-muted-foreground">{rol}</span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={variant === "row" ? "top" : "bottom"}
        align={variant === "row" ? "start" : "end"}
        className="w-56"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{nombre}</span>
          <span className="text-caption font-normal text-muted-foreground">{rol}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOutIcon />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
