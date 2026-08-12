import { cn } from "@/shared/lib/utils";

import { BrandRing, type BrandRingSize } from "./brand-ring";

// Indicador de espera de la app. Es el anillo de firma girando, no el
// `Loader2Icon` de lucide: DESIGN_SYSTEM.md §1.7 pide que el anillo sea el
// hilo visual del producto, y la espera es donde más se mira.
//
// Regla de §2.9: el spinner es para esperas PUNTUALES (dentro de un botón, un
// bloque que se recarga). Para una pantalla que carga van skeletons con la
// forma real del contenido, nunca un spinner centrado.

interface SpinnerProps {
  size?: BrandRingSize;
  /** Texto para lectores de pantalla (default "Cargando"). */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label = "Cargando", className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      {/* `motion-safe:animate-spin` dentro de BrandRing: con
          `prefers-reduced-motion` el anillo queda quieto y el `role=status`
          sigue anunciando la espera. */}
      <BrandRing size={size} spinning />
      <span className="sr-only">{label}</span>
    </span>
  );
}
