import * as React from "react";

import { cn } from "@/shared/lib/utils";

// DESIGN_SYSTEM.md §1.7 — el anillo es "el único elemento que se repite
// intencionalmente en las tres superficies, el hilo visual que conecta todo el
// producto". `ProgressRing` lo usa para mostrar un dato; este componente usa la
// MISMA geometría cuando no hay dato que mostrar: el vacío, el error y la
// espera. Así un estado vacío no es un icono genérico de librería, es la marca.
//
// No tiene `value`: el arco es decorativo y siempre el mismo. Si necesitas
// representar un porcentaje, ese es `ProgressRing`.

const SIZES = {
  sm: { px: 20, strokeWidth: 2.5 },
  md: { px: 40, strokeWidth: 3.5 },
  lg: { px: 64, strokeWidth: 4 },
} as const;

export type BrandRingSize = keyof typeof SIZES;

interface BrandRingProps extends Omit<React.ComponentProps<"span">, "children"> {
  size?: BrandRingSize;
  /** Pista punteada: dice "acá no hay nada todavía" sin necesidad de copy. */
  dashed?: boolean;
  /** Gira sobre sí mismo (spinner). */
  spinning?: boolean;
  /** Contenido centrado dentro del anillo (un icono, por ejemplo). */
  children?: React.ReactNode;
  /** Tono del arco. `muted` para vacíos, `destructive` para errores. */
  tone?: "accent" | "muted" | "destructive";
}

const ARC_CLASS: Record<NonNullable<BrandRingProps["tone"]>, string> = {
  accent: "stroke-accent",
  muted: "stroke-muted-foreground",
  destructive: "stroke-destructive",
};

function BrandRing({
  size = "md",
  dashed = false,
  spinning = false,
  tone = "accent",
  className,
  children,
  ...props
}: BrandRingProps) {
  const { px, strokeWidth } = SIZES[size];
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      data-slot="brand-ring"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: px, height: px }}
      {...props}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        aria-hidden="true"
        className={cn("-rotate-90", spinning && "motion-safe:animate-spin")}
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={dashed ? "4 6" : undefined}
          className="stroke-border"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          // Arco de ~30% de la circunferencia, igual que la marca del sidebar.
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.7}
          className={ARC_CLASS[tone]}
        />
      </svg>

      {children ? (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      ) : null}
    </span>
  );
}

export { BrandRing };
