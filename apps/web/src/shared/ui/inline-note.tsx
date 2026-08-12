import * as React from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

// Aviso en línea: la explicación que evita que el usuario interprete mal lo
// que está viendo. Distinto de un toast (que confirma una acción y se va) y de
// un `EmptyState` (que ocupa el lugar del contenido ausente) — esto acompaña a
// contenido que SÍ está.
//
// Casos reales que hoy se resolvían con un `<div>` a medida en cada pantalla:
// "No disponible para cierres anteriores a esta función", "El día del
// desembolso no se cobra", "Este cliente tiene créditos abiertos".

type NoteTone = "info" | "warning" | "success";

const TONE: Record<NoteTone, { icon: LucideIcon; className: string; iconClass: string }> = {
  info: {
    icon: InfoIcon,
    className: "border-border bg-muted/60 text-foreground",
    iconClass: "text-muted-foreground",
  },
  warning: {
    icon: TriangleAlertIcon,
    className: "border-warning/30 bg-warning/10 text-foreground",
    iconClass: "text-warning-strong",
  },
  success: {
    icon: CircleCheckIcon,
    className: "border-success/30 bg-success/10 text-foreground",
    iconClass: "text-success-strong",
  },
};

interface InlineNoteProps extends React.ComponentProps<"div"> {
  tone?: NoteTone;
  /** Reemplaza el icono del tono. */
  icon?: React.ReactNode;
}

export function InlineNote({
  tone = "info",
  icon,
  className,
  children,
  ...props
}: InlineNoteProps) {
  const { icon: ToneIcon, className: toneClass, iconClass } = TONE[tone];

  return (
    <div
      data-slot="inline-note"
      data-tone={tone}
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-body-sm",
        toneClass,
        className,
      )}
      {...props}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", iconClass)} aria-hidden>
        {icon ?? <ToneIcon />}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
