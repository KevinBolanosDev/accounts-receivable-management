"use client";

import { cn } from "@/shared/lib/utils";

import { UserMenu } from "./UserMenu";

// Estilo de cualquier botón que viva DENTRO del header: sobre el degradado,
// `bg-primary` se funde con el fondo y `bg-secondary` mete un bloque oscuro.
// Un velo translúcido blanco funciona sobre todo el recorrido índigo→cian.
export const HEADER_ACTION_CLASS =
  "border border-white/25 bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/50";

interface AdminPageHeaderProps {
  /** Breadcrumb/eyebrow encima del título (ej. "Rutas / Ruta 3 · Centro"). */
  eyebrow?: React.ReactNode;
  title: string;
  /** Línea secundaria bajo el título (ej. "142 clientes · 7 rutas"). */
  subtitle?: React.ReactNode;
  /** Acciones a la derecha (botones de página), antes del avatar. */
  actions?: React.ReactNode;
  className?: string;
}

// Header por-página del portal Admin: breadcrumb + título a la izquierda;
// acciones + avatar del usuario a la derecha. Es la barra superior del shell,
// que cada pantalla configura (el prototipo la muestra distinta por vista).
//
// El fondo es el degradado de firma índigo→cian (DESIGN_SYSTEM.md §1.1), que
// antes solo aparecía en los heros sueltos de algunas pantallas. Al vivir en
// el header, es la marca de la superficie Admin y las pantallas ya no
// necesitan pintar su propio bloque azul.
//
// Sobre el degradado los tokens de texto no aplican (`--foreground` es casi
// blanco en oscuro pero casi negro en claro), así que el contenido se fija a
// blanco explícito y el secundario a `text-white/70`.
export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        // `min-h-16` y no `h-16`: con una altura fija, cualquier contenido que
        // no quepa desborda en vez de crecer.
        "sticky top-0 z-10 flex min-h-16 shrink-0 items-center gap-3 overflow-hidden bg-linear-to-r from-primary to-accent px-4 py-2 text-white sm:px-6",
        className,
      )}
    >
      {/* Anillos decorativos del hero (§1.7), atenuados para no competir con
          el título. `overflow-hidden` en el header los recorta. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-8 size-32 rounded-full border-14 border-white/10"
      />

      {/* Sin hamburger: en móvil la navegación es la bottom tab bar del
          AdminShell, y su pestaña "Más" abre el mismo Sheet. */}
      <div className="relative flex min-w-0 flex-col">
        {eyebrow ? <div className="truncate text-caption text-white/70">{eyebrow}</div> : null}
        <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
        {subtitle ? <div className="truncate text-caption text-white/70">{subtitle}</div> : null}
      </div>

      <div className="relative ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {actions}
        {/* En móvil este avatar es la ÚNICA salida de sesión: la bottom tab
            bar no tiene pie de sidebar donde colgarla. */}
        <UserMenu variant="avatar" onGradient />
      </div>
    </header>
  );
}
