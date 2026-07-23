import * as React from "react";
import type { ClienteListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
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

interface ClientCardProps extends React.ComponentProps<"div"> {
  cliente: Pick<ClienteListItem, "nombre" | "ruta">;
  // --- Datos de Crédito (Fase 3). Opcionales: sin ellos la card muestra un
  // placeholder neutro. La Fase 3 solo los pasa, no reescribe el componente.
  saldoPendiente?: number;
  estado?: EstadoCredito;
  porcentajePagado?: number;
  /** Añade estilos de hover/cursor cuando la fila entera es tappable. */
  interactive?: boolean;
}

// DESIGN_SYSTEM.md §2.4 — Client card: avatar/iniciales, nombre, ruta, saldo,
// anillo mini y badge de estado. En la Fase 2 el crédito aún no existe: saldo,
// estado y anillo van como placeholder.
function ClientCard({
  cliente,
  saldoPendiente,
  estado,
  porcentajePagado,
  interactive,
  className,
  ...props
}: ClientCardProps) {
  return (
    <div
      data-slot="client-card"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-4",
        interactive && "cursor-pointer transition-colors hover:bg-muted",
        className,
      )}
      {...props}
    >
      <Avatar>
        <AvatarFallback>{getInitials(cliente.nombre)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{cliente.nombre}</span>
        <span className="truncate text-caption text-muted-foreground">
          {cliente.ruta?.nombre ?? "Sin ruta"}
        </span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">
          {saldoPendiente != null ? formatCurrency(saldoPendiente) : "—"}
        </span>
        {estado ? (
          <Badge status={estado}>{ESTADO_LABEL[estado]}</Badge>
        ) : (
          <span className="text-caption text-muted-foreground">Sin crédito</span>
        )}
      </div>

      {porcentajePagado != null && <ProgressRing value={porcentajePagado} size="mini" />}
    </div>
  );
}

export { ClientCard };
export type { ClientCardProps };
