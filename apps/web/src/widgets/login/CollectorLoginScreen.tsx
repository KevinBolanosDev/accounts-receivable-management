"use client";

import { LoginForm } from "@/features/auth";
import { useReveal } from "@/shared/lib/motion";

import { BrandLogo } from "./BrandLogo";

// Prototipo #14c — hero de marca a pantalla ancha + tarjeta tipo bottom sheet
// superpuesta. Responsive: en mobile ocupa toda la pantalla (edge-to-edge); en
// >= lg la composición se centra como una tarjeta con ancho máximo sobre el
// fondo claro (la "versión web"). Superficie clara (de app/(collector)/layout.tsx).
export function CollectorLoginScreen() {
  const cardRef = useReveal<HTMLDivElement>();

  return (
    <main className="flex min-h-dvh flex-col bg-muted items-center justify-center p-6">
      <div
        ref={cardRef}
        className="flex flex-1 flex-col overflow-hidden h-full max-h-200 w-full max-w-110 rounded-[28px] border border-border shadow-xl"
      >
        {/* Hero de marca con gradiente primary → accent */}
        <div className="relative flex flex-none flex-col gap-6 overflow-hidden bg-[linear-gradient(155deg,var(--color-primary),var(--color-accent))] px-7 pt-14 pb-14">
          {/* Anillo ambiente blanco (decorativo) */}
          <svg
            viewBox="0 0 260 260"
            aria-hidden="true"
            className="pointer-events-none absolute -right-17.5 -top-15 h-65 w-65 opacity-35"
          >
            <circle cx="130" cy="130" r="108" fill="none" stroke="#fff" strokeWidth="2" />
            <circle
              cx="130"
              cy="130"
              r="80"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="502.4"
              strokeDashoffset="180"
              transform="rotate(-90 130 130)"
            />
          </svg>

          <div className="relative mx-auto flex w-full max-w-95 flex-col gap-6">
            <BrandLogo tone="onGradient" />

            <h1 className="max-w-60 text-[21px] font-bold leading-[1.3] tracking-[-0.01em] text-white">
              Tu ruta, tus cobros,
              <br />
              en un solo lugar.
            </h1>
          </div>
        </div>

        {/* Bottom sheet superpuesto — el contenido se centra con ancho máximo
            para que no se estire en tablet, manteniendo el hero full-bleed. */}
        <div className="min-h-155 h-full relative -mt-6 flex flex-col rounded-[26px] bg-card px-7 pt-6 pb-8 shadow-[0_-10px_24px_-18px_rgba(0,0,0,0.15)]">
          <div className="mx-auto flex w-full max-w-95 flex-col gap-5">
            <div className="mx-auto h-1 w-9 rounded-full bg-border" />

            <div className="flex flex-col gap-1.5">
              <h2 className="text-[19px] font-semibold text-foreground">Iniciar sesión</h2>
              <p className="text-sm text-muted-foreground">Ingresa para ver tu ruta de hoy.</p>
            </div>

            {/* Solo COBRADOR: una cuenta de admin acá se rechaza con un
                mensaje, no se le abre sesión. */}
            <LoginForm allowedRoles={["COBRADOR"]} redirectTo="/collector" />
          </div>
        </div>
      </div>
    </main>
  );
}
