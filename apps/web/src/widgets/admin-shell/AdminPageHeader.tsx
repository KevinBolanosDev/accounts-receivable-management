"use client";

import { MenuIcon } from "lucide-react";

import { useSessionStore } from "@/entities/session";
import { getInitials } from "@/shared/lib/initials";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

import { useAdminShell } from "./shell-context";

interface AdminPageHeaderProps {
  /** Breadcrumb/eyebrow encima del título (ej. "Rutas / Ruta 3 · Centro"). */
  eyebrow?: React.ReactNode;
  title: string;
  /** Línea secundaria bajo el título (ej. "142 clientes · 7 rutas"). */
  subtitle?: React.ReactNode;
  /** Acciones a la derecha (botones de página), antes del avatar. */
  actions?: React.ReactNode;
  className?: string;
}

// Header por-página del portal Admin: breadcrumb + título a la izquierda;
// acciones + avatar del usuario a la derecha. Es la barra superior del shell,
// que cada pantalla configura (el prototipo la muestra distinta por vista).
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: AdminPageHeaderProps) {
  const { openMobileNav } = useAdminShell();
  const usuario = useSessionStore((state) => state.usuario);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Abrir menú"
        onClick={openMobileNav}
      >
        <MenuIcon />
      </Button>

      <div className="flex min-w-0 flex-col">
        {eyebrow ? <div className="truncate text-caption text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
        {subtitle ? (
          <div className="truncate text-caption text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {actions}
        <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground sm:flex">
          {getInitials(usuario?.nombre ?? "Admin")}
        </span>
      </div>
    </header>
  );
}
