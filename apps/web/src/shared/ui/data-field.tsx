import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { CopyButton } from "@/shared/ui/copy-button";

interface DataFieldProps extends Omit<React.ComponentProps<"div">, "title"> {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Si viene, agrega un botón de copiar con este texto crudo. */
  copyValue?: string | null;
  copyLabel?: string;
  /** Renderiza el valor como enlace (`tel:`, `https://maps…`). */
  href?: string;
  emptyText?: string;
}

function isEmpty(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Par etiqueta/valor. Existe para que "ser más declarativos con cada valor"
 * (documento, teléfono, dirección, contacto) no signifique repetir el mismo
 * bloque de markup en cada pantalla.
 */
export function DataField({
  label,
  value,
  icon,
  copyValue,
  copyLabel,
  href,
  emptyText = "—",
  className,
  ...props
}: DataFieldProps) {
  const vacio = isEmpty(value);
  const contenido = vacio ? emptyText : value;

  return (
    <div data-slot="data-field" className={cn("flex min-w-0 flex-col gap-0.5", className)} {...props}>
      <span className="text-caption text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        {href && !vacio ? (
          <a
            href={href}
            className="truncate text-body-sm font-medium hover:underline"
            // El panel puede vivir dentro de una tarjeta navegable.
            onClick={(e) => e.stopPropagation()}
          >
            {contenido}
          </a>
        ) : (
          <span className={cn("truncate text-body-sm font-medium", vacio && "text-muted-foreground")}>
            {contenido}
          </span>
        )}
        {copyValue && !vacio ? (
          <CopyButton
            value={copyValue}
            label={copyLabel ?? `Copiar ${label.toLowerCase()}`}
            successMessage={`${label} copiado`}
          />
        ) : null}
      </div>
    </div>
  );
}

interface DataFieldListProps extends React.ComponentProps<"div"> {
  columns?: 1 | 2;
}

export function DataFieldList({ columns = 2, className, ...props }: DataFieldListProps) {
  return (
    <div
      data-slot="data-field-list"
      className={cn(
        "grid gap-x-4 gap-y-3",
        columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        className,
      )}
      {...props}
    />
  );
}
