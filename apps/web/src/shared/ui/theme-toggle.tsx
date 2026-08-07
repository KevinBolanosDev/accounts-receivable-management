"use client";

import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useTheme, type ThemePreference } from "@/shared/theme";

// DESIGN_SYSTEM.md §0 — selector de modo de las superficies Admin y Cobrador.
//
// Control segmentado y no un switch de dos estados: "Sistema" es una tercera
// opción real (seguir al SO), distinta de "Claro". Y no un `DropdownMenuItem`
// por opción: dentro del menú del Admin, un botón suelto NO cierra el menú al
// pulsarlo, así que se puede probar claro/oscuro y comparar sin reabrirlo.

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
}

const OPTIONS: ThemeOption[] = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
];

// Altura del BOTÓN (el objetivo táctil), no del contenedor: el contenedor
// suma su propio `p-1`. §2.1 — 48px es el objetivo del CTA móvil; el cobrador
// toca esto con el teléfono en una mano, caminando.
const SIZE_CLASS = {
  sm: "h-7 text-caption",
  md: "h-9 text-body-sm",
  lg: "h-12 text-body-sm",
} as const;

const ICON_CLASS = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-4",
} as const;

/**
 * Nota de contexto. El default del Cobrador es claro por una razón operativa
 * (§0: la ruta se camina bajo sol directo); decirlo acá convierte el modo
 * oscuro en una elección informada en vez de una sorpresa a media mañana.
 */
const SURFACE_HINT: Partial<Record<string, string>> = {
  collector: "El modo claro es el predeterminado: se lee mejor bajo el sol.",
  admin: "El modo oscuro es el predeterminado del panel.",
};

interface ThemeToggleProps {
  size?: keyof typeof SIZE_CLASS;
  /** Etiqueta encima del control. */
  label?: string;
  /** Muestra la nota de contexto de la superficie. */
  showHint?: boolean;
  className?: string;
}

export function ThemeToggle({
  size = "md",
  label,
  showHint = false,
  className,
}: ThemeToggleProps) {
  const { preference, setPreference, canToggle, surface } = useTheme();

  // En el Portal Cliente y en las rutas públicas no hay nada que elegir.
  if (!canToggle) return null;

  const hint = showHint ? SURFACE_HINT[surface] : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-caption text-muted-foreground uppercase">{label}</span>
      ) : null}

      <div
        role="radiogroup"
        aria-label="Modo de color"
        className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1"
      >
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = preference === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              // El punto del click alimenta el revelado circular: la
              // transición nace de donde el usuario tocó.
              onClick={(event) =>
                setPreference(option.value, {
                  x: event.clientX,
                  y: event.clientY,
                })
              }
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                SIZE_CLASS[size],
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("shrink-0", ICON_CLASS[size])} aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>

      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
