"use client";

import { useCountUp } from "@/shared/lib/motion";

// DESIGN_SYSTEM.md §1.8 — "Montos: count-up tabular en saldos y totales
// (Dashboard, recibo, vista del cliente) — refuerza la cifra sin distraer".
//
// Vivía como componente local dentro de `DashboardScreen`, que era el único
// consumidor de `useCountUp` en toda la app. Al necesitarlo también el
// cobrador y el portal del cliente, sube a `shared/ui` en vez de copiarse.
//
// `useCountUp` escribe el texto imperativamente (GSAP), así que el `<span>`
// nace vacío: no hay contenido que hidratar de más ni riesgo de mismatch. Con
// `prefers-reduced-motion` el hook escribe el valor final de una y no anima.

interface CountUpValueProps {
  value: number;
  /** Ej. `formatCurrency`. Sin él se muestra el número redondeado. */
  format?: (value: number) => string;
  /** `base` (280ms) para tiras de métricas; `hero` para una cifra protagonista. */
  token?: "base" | "hero";
  className?: string;
}

export function CountUpValue({ value, format, token = "base", className }: CountUpValueProps) {
  const ref = useCountUp(value, { token, format });
  return <span ref={ref} className={className} />;
}
