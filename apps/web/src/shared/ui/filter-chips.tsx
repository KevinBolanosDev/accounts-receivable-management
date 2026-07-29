"use client";

import { cn } from "@/shared/lib/utils";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  /** Contador opcional a la derecha de la etiqueta. */
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: FilterChipOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Etiqueta accesible del grupo (ej. "Filtrar por estado"). */
  label: string;
  className?: string;
}

// Fila de chips de filtro con scroll horizontal (DESIGN_SYSTEM.md §2.5 —
// en móvil los filtros son chips, no un select). Semántica de filtro
// (`aria-pressed`) y no de tabs: no cambia de panel, acota una lista.
//
// Nada de sangrado con márgenes negativos: dentro de un grid o un flex, un
// hijo más ancho que su columna estira la pista entera, y como el `<main>` del
// AdminShell es `overflow-x-clip`, ese excedente se RECORTA en vez de
// scrollear — se ve como si la lista y los filtros estuvieran cortados. El
// `min-w-0` obliga al contenedor a ceder ante su propio scroll interno.
export function FilterChips<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <span className="whitespace-nowrap">{option.label}</span>
            {option.count !== undefined ? (
              <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-70")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
