"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/shared/theme";

const Toaster = ({ ...props }: ToasterProps) => {
  // Los colores del toast salen de los tokens (`--normal-bg` y compañía más
  // abajo), pero sonner también usa `theme` para su propia clase interna
  // (sombras, borde del botón de cerrar). Estaba fijo en "light", que era
  // correcto cuando el Admin era la única superficie oscura y el Toaster
  // heredaba la clase del `<html>`; con el modo elegible hay que seguirlo.
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      // DESIGN_SYSTEM.md §2.8 — arriba a la derecha en desktop (sonner reubica solo en mobile).
      position="top-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
