import { cn } from "@/shared/lib/utils";

import { Skeleton } from "./skeleton";

// DESIGN_SYSTEM.md §2.9 — "Carga: skeletons que imitan la FORMA REAL del
// contenido (no solo un spinner)".
//
// Las pantallas venían resolviendo la espera con `<Skeleton className="h-40
// w-full" />`: un rectángulo gris que no anticipa nada, así que al llegar los
// datos el layout salta. Estas composiciones reproducen la anatomía de los
// bloques que el producto realmente usa — fila con avatar, tarjeta con anillo,
// tira de métricas, tabla, ficha de detalle — para que el esqueleto ocupe el
// mismo espacio que el contenido final.
//
// Regla al usarlas: `rows`/`columns` deben coincidir con lo que la pantalla
// suele mostrar (una ruta con 2 tarjetas no pide 6 filas de esqueleto).

interface CountProps {
  rows?: number;
  className?: string;
}

/** Filas tipo "cliente": disco de iniciales + dos líneas + monto a la derecha. */
export function SkeletonList({ rows = 4, className }: CountProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Tarjetas de ruta/crédito: icono, dos líneas, monto y anillo. */
export function SkeletonCardList({ rows = 3, className }: CountProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="size-8 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Tira de métricas (dashboard, resumen de ruta). */
export function SkeletonMetrics({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
        >
          <Skeleton className="size-11 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-2.5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tabla del Admin: encabezado + filas con celdas de anchos distintos. */
export function SkeletonTable({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  // Anchos alternados: una tabla real no tiene todas las celdas iguales, y un
  // esqueleto de columnas idénticas se lee como una grilla vacía, no como una
  // tabla que está por llegar.
  const widths = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4"];

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-b border-border px-4 py-3.5">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1">
              <Skeleton className={cn("h-3.5", widths[(rowIndex + colIndex) % widths.length])} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Ficha de detalle: encabezado con avatar + pares etiqueta/valor. */
export function SkeletonDetail({ rows = 5, className }: CountProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Formulario: pares etiqueta + campo. */
export function SkeletonForm({ rows = 5, className }: CountProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  );
}
