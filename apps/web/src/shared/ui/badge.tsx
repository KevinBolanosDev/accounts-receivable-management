import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/shared/lib/utils";

// DESIGN_SYSTEM.md §2.3 — un estado, un color; texto siempre el tono 600/700 del mismo color de fondo.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      status: {
        activo: "bg-success/15 text-success-strong",
        "proximo-a-vencer": "bg-warning/15 text-warning-strong",
        mora: "bg-destructive/15 text-destructive-strong",
        pagado: "bg-accent/15 text-accent-strong",
        "ruta-abierta": "bg-success/15 text-success-strong",
        "ruta-cerrada": "bg-muted text-muted-foreground",
        // Fase 4 — puntualidad de cuota en el historial (Portal Cliente #21c y
        // detalle de crédito del Cobrador). Las cuotas sin pagar escalan con el
        // tiempo: `missed` (vence hoy, neutro) → `overdue` (ámbar) → `defaulted`
        // (rojo, a la semana).
        "on-time": "bg-success/15 text-success-strong",
        late: "bg-destructive/15 text-destructive-strong",
        missed: "bg-muted text-muted-foreground",
        overdue: "bg-warning/15 text-warning-strong",
        defaulted: "bg-destructive/15 text-destructive-strong",
        // Pago anulado (error de tipeo, cuota equivocada): ni bueno ni malo,
        // simplemente "esto no cuenta" — mismo tono neutro que `missed`.
        anulado: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "activo",
    },
  },
);

function Badge({
  className,
  status,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-status={status}
      className={cn(badgeVariants({ status, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
