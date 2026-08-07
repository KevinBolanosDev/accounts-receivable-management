import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import type { ClienteListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { PRESS_SCALE } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { CopyButton } from "@/shared/ui/copy-button";
import { ProgressRing } from "@/shared/ui/progress-ring";

import { getInitials } from "@/shared/lib/initials";

// Estados de crédito que la card sabe pintar (subconjunto de los badges §2.3).
type EstadoCredito = "activo" | "proximo-a-vencer" | "mora" | "pagado";

const ESTADO_LABEL: Record<EstadoCredito, string> = {
  activo: "Activo",
  "proximo-a-vencer": "Próximo a vencer",
  mora: "Mora",
  pagado: "Pagado",
};

interface ClientCardProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  cliente: Pick<ClienteListItem, "nombre" | "ruta">;
  /**
   * Documento y teléfono con botón de copiar. Sustituye a la línea de la ruta
   * cuando se pasa: dentro del detalle de una ruta el nombre de esa misma ruta
   * es información redundante, mientras que el contacto es lo que el cobrador
   * necesita a mano.
   */
  contacto?: { documento?: string | null; telefono?: string | null };
  /** Línea secundaria libre. Se ignora si se pasa `contacto`. */
  subtitle?: React.ReactNode;
  /** Cifra de la derecha. */
  amount?: number;
  /** Etiqueta bajo la cifra: "saldo", "cobrado hoy", … */
  amountLabel?: string;
  estado?: EstadoCredito;
  /** Badge propio; tiene prioridad sobre el derivado de `estado`. */
  badge?: React.ReactNode;
  porcentajePagado?: number;
  /**
   * Navega al pulsar la tarjeta. Se implementa como "stretched link" (un
   * `<Link>` absoluto que cubre la tarjeta) y NO envolviendo la tarjeta: dentro
   * hay botones de copiar, y un `<button>` dentro de un `<a>` es HTML inválido
   * además de disparar la navegación al copiar.
   */
  href?: string;
  /** Atenúa la tarjeta (sección "Cobrados hoy"). */
  muted?: boolean;
  /** Estilos de hover/cursor cuando la fila entera es tappable. */
  interactive?: boolean;
}

// DESIGN_SYSTEM.md §2.4 — Client card: avatar/iniciales, nombre, línea de
// contacto (o ruta), cifra, anillo mini y badge de estado.
function ClientCard({
  cliente,
  contacto,
  subtitle,
  amount,
  amountLabel,
  estado,
  badge,
  porcentajePagado,
  href,
  muted,
  interactive,
  className,
  ...props
}: ClientCardProps) {
  const tieneContacto = Boolean(contacto?.documento || contacto?.telefono);

  return (
    <div
      data-slot="client-card"
      className={cn(
        "relative flex items-center gap-3 rounded-lg border border-border bg-card p-4",
        // El hundido al pulsar solo tiene sentido si la tarjeta hace algo.
        // En el móvil del cobrador no hay hover: es la única confirmación
        // táctil de que el toque entró (§2.1).
        (interactive || href) && cn("transition-colors hover:bg-muted", PRESS_SCALE),
        muted && "opacity-60",
        className,
      )}
      {...props}
    >
      {href ? (
        <Link
          href={href}
          aria-label={cliente.nombre}
          className="absolute inset-0 z-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      ) : null}

      <Avatar className="z-10">
        <AvatarFallback>{getInitials(cliente.nombre)}</AvatarFallback>
      </Avatar>

      <div className="z-10 flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{cliente.nombre}</span>
        {tieneContacto ? (
          <div className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            {contacto?.documento ? (
              <span className="inline-flex items-center gap-0.5">
                <span className="truncate">CC {contacto.documento}</span>
                <CopyButton
                  value={contacto.documento}
                  label="Copiar documento"
                  successMessage="Documento copiado"
                  className="size-5"
                />
              </span>
            ) : null}
            {contacto?.telefono ? (
              <span className="inline-flex items-center gap-0.5">
                <span className="truncate">{contacto.telefono}</span>
                <CopyButton
                  value={contacto.telefono}
                  label="Copiar teléfono"
                  successMessage="Teléfono copiado"
                  className="size-5"
                />
              </span>
            ) : null}
          </div>
        ) : (
          <span className="truncate text-caption text-muted-foreground">
            {subtitle ?? cliente.ruta?.nombre ?? "Sin ruta"}
          </span>
        )}
      </div>

      <div className="z-10 flex flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">
          {amount != null ? formatCurrency(amount) : "—"}
        </span>
        {amountLabel ? (
          <span className="text-caption text-muted-foreground">{amountLabel}</span>
        ) : null}
        {badge ?? (estado ? <Badge status={estado}>{ESTADO_LABEL[estado]}</Badge> : null)}
        {!badge && !estado && !amountLabel ? (
          <span className="text-caption text-muted-foreground">Sin crédito</span>
        ) : null}
      </div>

      {porcentajePagado != null && (
        <ProgressRing value={porcentajePagado} size="mini" className="z-10" />
      )}

      {/* Chevron de afordancia: sin él nada distingue visualmente una tarjeta
          que navega de una que solo informa. Mismo indicador que ya usaban las
          tarjetas de ruta. */}
      {href ? (
        <ChevronRightIcon className="z-10 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  );
}

export { ClientCard };
export type { ClientCardProps };
