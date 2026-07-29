"use client";

import { cn } from "@/shared/lib/utils";

import { UserMenu } from "./UserMenu";

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
  return (
    <header
      className={cn(
        // `min-h-16` y no `h-16`: con una altura fija, cualquier contenido que
        // no quepa desborda en vez de crecer.
        "sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6",
        className,
      )}
    >
      {/* Sin hamburger: en móvil la navegación es la bottom tab bar del
          AdminShell, y su pestaña "Más" abre el mismo Sheet. */}
      <div className="flex min-w-0 flex-col">
        {eyebrow ? <div className="truncate text-caption text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
        {subtitle ? (
          <div className="truncate text-caption text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {actions}
        {/* En móvil este avatar es la ÚNICA salida de sesión: la bottom tab
            bar no tiene pie de sidebar donde colgarla. */}
        <UserMenu variant="avatar" />
      </div>
    </header>
  );
}
