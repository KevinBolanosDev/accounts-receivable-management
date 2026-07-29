"use client";

import { LoginForm } from "@/features/auth";
import { useReveal } from "@/shared/lib/motion";
import { Card } from "@/shared/ui/card";

import { BrandLogo } from "./BrandLogo";

// Prototipo #1b — split de dos paneles (marca + anillo de firma a la izquierda,
// formulario a la derecha). Responsive: en < lg el panel de marca se oculta y
// el formulario ocupa la pantalla completa, centrado. Superficie oscura
// (heredada de app/(admin)/layout.tsx).
export function AdminLoginScreen() {
  const formRef = useReveal<HTMLDivElement>();

  return (
    <main className="flex min-h-dvh">
      {/* Panel de marca — solo desde lg */}
      <aside className="relative hidden w-[50%] flex-none flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        {/* Glow índigo radial */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_25%_15%,var(--color-primary),transparent_58%)] opacity-25" />

        {/* Anillo ambiente (elemento de firma, decorativo) */}
        <svg
          viewBox="0 0 360 360"
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-26 h-90 w-90 opacity-40"
        >
          <circle cx="180" cy="180" r="150" fill="none" strokeWidth="2" className="stroke-primary" />
          <circle
            cx="180"
            cy="180"
            r="112"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="703.7"
            strokeDashoffset="250"
            transform="rotate(-90 180 180)"
            className="stroke-accent"
          />
        </svg>

        <div className="relative">
          <BrandLogo />
        </div>

        <div className="relative flex flex-col mx-auto gap-3.5">
          <h1 className="text-[27px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
            Cobros diarios,
            <br />
            bajo control.
          </h1>
          <p className="max-w-62.5 text-sm leading-[1.6] text-muted-foreground">
            Clientes, rutas, créditos y cierres del día en un solo panel.
          </p>
        </div>

        <p className="relative text-[11px] font-medium text-muted-foreground">© 2026 CobroDiario</p>
      </aside>

      {/* Panel de formulario */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
        {/* Glow sutil solo en mobile, cuando el panel de marca está oculto */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-primary),transparent_60%)] opacity-15 lg:hidden" />

        <div ref={formRef} className="relative w-full max-w-85">
          <Card className="gap-0 overflow-hidden py-0">
            {/* Borde superior decorativo: índigo → cian, los dos colores de
                firma del DS §1.1. Sin hex hardcodeados — los tokens resuelven
                a los valores de la superficie que envuelve la pantalla. */}
            <div aria-hidden="true" className="h-0.75 w-full bg-linear-to-r from-primary to-accent" />

            <div className="flex flex-col gap-6 p-6">
              <BrandLogo />

              <div className="flex flex-col gap-1.5">
                <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
                  Iniciar sesión
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ingresa a tu panel de administración.
                </p>
              </div>

              {/* Solo ADMIN: una cuenta de cobrador acá se rechaza con un
                  mensaje, no se le abre sesión. */}
              <LoginForm allowedRoles={["ADMIN"]} redirectTo="/admin" />
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
