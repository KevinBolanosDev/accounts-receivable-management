"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

// DESIGN_SYSTEM.md §2.6 / #15c-#16c — hero de marca del portal cobrador: banda
// azul en degradado (primary → accent) con la decoración de anillos, replicada
// en TODAS las vistas del cobrador. Centralizado aquí: cada pantalla solo pasa
// título/subtítulo/acciones (y opcionalmente avatar + badge, como el detalle
// del cliente 16c); el estilo de marca vive en un único lugar. El `pb` extra
// deja espacio para la tarjeta superpuesta (`-mt-*` del hijo siguiente).

interface CollectorHeroProps {
  title: string;
  subtitle?: string;
  /** Acción a la derecha (ej. "Cerrar ruta"). */
  actions?: React.ReactNode;
  /** Flecha de regreso (vistas de detalle). */
  backHref?: string;
  /** Avatar grande junto al título (ej. iniciales del cliente, 16c). */
  avatar?: React.ReactNode;
  /** Píldora bajo el título (ej. estado del cliente, 16c). */
  badge?: React.ReactNode;
  /** Reserva espacio inferior para una tarjeta superpuesta (default true). */
  overlap?: boolean;
  className?: string;
}

export function CollectorHero({
  title,
  subtitle,
  actions,
  backHref,
  avatar,
  badge,
  overlap = true,
  className,
}: CollectorHeroProps) {
  const backLink = backHref ? (
    <Link
      href={backHref}
      aria-label="Volver"
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary-foreground/90 hover:bg-white/10"
    >
      <ArrowLeftIcon className="size-5" />
    </Link>
  ) : null;

  return (
    <header
      className={cn(
        "relative overflow-hidden bg-gradient-to-r from-primary to-accent text-primary-foreground",
        overlap ? "pb-14" : "pb-6",
        className,
      )}
    >
      {/* Decoración de marca: anillos translúcidos (screenshot 15c/16c). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full border-[16px] border-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-14 right-20 size-16 rounded-full border-8 border-white/10"
      />

      {avatar ? (
        // Variante con avatar (16c): back/acciones arriba, identidad debajo.
        <>
          <div className="relative flex items-center justify-between px-4 pt-4">
            {backLink ?? <span />}
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
          <div className="relative flex items-center gap-4 px-4 pt-2">
            {avatar}
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="truncate text-xl font-bold">{title}</h1>
              {subtitle ? (
                <p className="truncate text-body-sm text-primary-foreground/80">{subtitle}</p>
              ) : null}
              {badge}
            </div>
          </div>
        </>
      ) : (
        <div className="relative flex items-start justify-between gap-3 px-4 pt-5">
          <div className="flex min-w-0 items-start gap-2.5">
            {backLink ? <span className="mt-0.5">{backLink}</span> : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="truncate text-xl font-bold">{title}</h1>
              {subtitle ? (
                <p className="truncate text-body-sm text-primary-foreground/80">{subtitle}</p>
              ) : null}
              {badge}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
    </header>
  );
}
