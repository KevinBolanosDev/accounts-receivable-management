"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, RefreshCwIcon, SearchXIcon, WifiOffIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { BrandRing } from "./brand-ring";
import { Button } from "./button";

// DESIGN_SYSTEM.md §2.9 — "Error de red: mensaje + botón 'Reintentar'".
//
// Y sobre todo: **`ErrorState` y `NotFoundState` son cosas distintas**. El
// patrón `isError || !entity → "no existe o fue eliminado"` que usaban casi
// todas las pantallas mezcla dos situaciones opuestas:
//
//   - la entidad NO existe (404) → no hay nada que reintentar, hay que volver
//   - la petición falló (red caída, 500, o un `ZodError` porque el backend
//     cambió el shape) → la entidad puede existir perfectamente
//
// Ese merge ya causó un bug real documentado en `apps/web/CLAUDE.md`: cuando
// `frecuencia` llegó como campo requerido, `clienteDetailSchema.parse` lanzaba
// y las pantallas decían "este cliente no existe". Separarlo en dos
// componentes obliga a decidir cuál es cuál al escribir la pantalla.

interface ErrorStateProps extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Sin esto no hay botón: un error sin salida es una pantalla muerta. */
  onRetry?: () => void;
  retryLabel?: string;
  size?: "card" | "inline";
}

export function ErrorState({
  title = "No se pudo cargar la información",
  description = "Revisá tu conexión e intentá de nuevo.",
  onRetry,
  retryLabel = "Reintentar",
  size = "card",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-destructive/40 bg-card text-center",
        size === "card" ? "p-10" : "p-6",
        className,
      )}
      {...props}
    >
      <BrandRing size={size === "card" ? "lg" : "md"} tone="destructive" className="mb-1">
        <WifiOffIcon className="size-5 text-destructive-strong" aria-hidden />
      </BrandRing>

      <p className="text-sm font-medium text-balance">{title}</p>

      {description ? (
        <p className="max-w-prose text-caption text-muted-foreground text-balance">{description}</p>
      ) : null}

      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCwIcon />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

interface NotFoundStateProps extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  /** Qué no se encontró, en singular y con artículo: "el cliente", "la ruta". */
  entity: string;
  description?: React.ReactNode;
  /** Ruta del nivel de arriba. Sin salida, el usuario queda encerrado. */
  backHref?: string;
  backLabel?: string;
  size?: "card" | "inline";
}

export function NotFoundState({
  entity,
  description = "Puede que se haya eliminado o que no tengas acceso.",
  backHref,
  backLabel = "Volver",
  size = "card",
  className,
  ...props
}: NotFoundStateProps) {
  return (
    <div
      data-slot="not-found-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-center",
        size === "card" ? "p-10" : "p-6",
        className,
      )}
      {...props}
    >
      <BrandRing size={size === "card" ? "lg" : "md"} dashed tone="muted" className="mb-1">
        <SearchXIcon className="size-5 text-muted-foreground" aria-hidden />
      </BrandRing>

      <p className="text-sm font-medium text-balance">No encontramos {entity}</p>

      {description ? (
        <p className="max-w-prose text-caption text-muted-foreground text-balance">{description}</p>
      ) : null}

      {backHref ? (
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href={backHref}>
            <ArrowLeftIcon />
            {backLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
