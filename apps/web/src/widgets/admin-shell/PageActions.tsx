"use client";

import Link from "next/link";
import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { HEADER_ACTION_CLASS } from "./AdminPageHeader";

export interface PageAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Navegación. Excluyente con `onSelect`. */
  href?: string;
  onSelect?: () => void;
  variant?: "secondary" | "destructive";
  disabled?: boolean;
  /** Por qué está deshabilitada. Se muestra en tooltip (desktop) y como texto del ítem (móvil). */
  disabledReason?: string;
}

// Las acciones de una página se declaran UNA vez y se pintan de dos formas
// según el ancho: botones sueltos en desktop, y un menú "…" en móvil.
//
// El detalle de cliente tiene tres acciones con texto: sumadas al hamburguesa
// y al título necesitaban ~440px, así que en un teléfono de 360px la barra
// desbordaba y arrastraba a toda la página con scroll horizontal. Colapsarlas
// resuelve el ancho sin esconder ninguna acción ni recortar sus etiquetas.
//
// El corte es `md` (768px) y no `sm`: tres botones con texto ocupan ~330px,
// que tampoco caben cómodos a 640px junto al resto del header.
export function PageActions({ actions }: { actions: PageAction[] }) {
  if (actions.length === 0) return null;

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {actions.map((action) => (
          <DesktopAction key={action.id} action={action} />
        ))}
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Más acciones"
              className={HEADER_ACTION_CLASS}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                variant={action.variant === "destructive" ? "destructive" : "default"}
                disabled={action.disabled}
                onSelect={action.onSelect}
                asChild={!!action.href && !action.disabled}
              >
                {action.href && !action.disabled ? (
                  <Link href={action.href}>
                    {action.icon}
                    {action.label}
                  </Link>
                ) : (
                  <span>
                    {action.icon}
                    {/* Sin tooltip en táctil: la razón va inline o no se lee nunca. */}
                    {action.disabled && action.disabledReason
                      ? `${action.label} — ${action.disabledReason}`
                      : action.label}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function DesktopAction({ action }: { action: PageAction }) {
  const button = (
    <Button
      variant="secondary"
      className={cn(
        HEADER_ACTION_CLASS,
        // Sobre el degradado el rojo del token no contrasta; el destructivo se
        // distingue con un velo más cálido, no con `text-destructive`.
        action.variant === "destructive" && "bg-destructive/80 hover:bg-destructive",
      )}
      disabled={action.disabled}
      onClick={action.onSelect}
      asChild={!!action.href && !action.disabled}
    >
      {action.href && !action.disabled ? (
        <Link href={action.href}>
          {action.icon}
          {action.label}
        </Link>
      ) : (
        <>
          {action.icon}
          {action.label}
        </>
      )}
    </Button>
  );

  if (!action.disabled || !action.disabledReason) return button;

  return (
    <Tooltip>
      {/* Un botón deshabilitado no emite eventos de puntero, así que el
          trigger necesita un envoltorio propio para poder recibir el hover. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>{action.disabledReason}</TooltipContent>
    </Tooltip>
  );
}
