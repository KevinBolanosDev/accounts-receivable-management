import * as React from "react";

import { cn } from "@/shared/lib/utils";

import { BrandRing } from "./brand-ring";

// DESIGN_SYSTEM.md §2.9 — "Vacío: título que nombra el espacio ('Aún no hay
// clientes en esta ruta'), una línea de contexto, botón de acción con verbo
// ('Agregar cliente')."
//
// Antes había cuatro `EmptyState` locales con firmas distintas (uno con
// `{text}`, otro con `{title, description}`, dos con estilos propios) y ~31
// `<div border-dashed>` sueltos. Ninguno aceptaba una acción, así que la
// tercera parte de la regla de §2.9 no se cumplía en ninguna pantalla.
//
// `title` es OBLIGATORIO y `description`/`action` opcionales: la API empuja a
// escribir la frase que nombra el espacio en vez de un "No hay datos".

interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  /** Nombra el espacio: "Aún no hay clientes en esta ruta". */
  title: React.ReactNode;
  /** Una línea de contexto: por qué está vacío o qué lo llena. */
  description?: React.ReactNode;
  /** Botón/enlace con verbo. */
  action?: React.ReactNode;
  /**
   * Icono dentro del anillo de marca. Sin él queda solo el anillo punteado,
   * que ya dice "acá no hay nada todavía".
   */
  icon?: React.ReactNode;
  /**
   * `card` (default) para un bloque que ocupa el área de contenido;
   * `inline` para un hueco dentro de una lista o pestaña, sin tanto aire.
   */
  size?: "card" | "inline";
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  size = "card",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-center",
        size === "card" ? "p-10" : "p-6",
        className,
      )}
      {...props}
    >
      <BrandRing
        size={size === "card" ? "lg" : "md"}
        dashed
        tone="muted"
        className="mb-1 opacity-80"
      >
        {icon ? (
          <span className="text-muted-foreground [&_svg]:size-5" aria-hidden>
            {icon}
          </span>
        ) : null}
      </BrandRing>

      <p className="text-sm font-medium text-balance">{title}</p>

      {description ? (
        <p className="max-w-prose text-caption text-muted-foreground text-balance">{description}</p>
      ) : null}

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
