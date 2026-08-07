import { cn } from "@/shared/lib/utils";

// DESIGN_SYSTEM.md §1.8 — el barrido de marca (`.skeleton-shimmer`, definido
// en globals.css) reemplaza al `animate-pulse` de Tailwind: el gradiente
// índigo→cian del hero recorre la pieza en diagonal en vez de latir en gris.
// El gate de `prefers-reduced-motion` vive en el CSS, no acá.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
