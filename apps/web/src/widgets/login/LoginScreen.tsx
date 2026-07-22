"use client";

import { LoginForm } from "@/features/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { useReveal } from "@/shared/lib/motion";

// DESIGN_SYSTEM.md §4.1: mismo componente que Admin (§3.1), sin cambios de
// layout — solo cambia la superficie que lo envuelve (dark/light por defecto,
// ver app/(admin)/layout.tsx y app/(collector)/layout.tsx). Un único
// componente responsive de mobile a desktop para las dos superficies.
const SURFACE_LABEL = {
  admin: "Portal Admin",
  cobrador: "App Cobrador",
} as const;

interface LoginScreenProps {
  surface: keyof typeof SURFACE_LABEL;
}

export function LoginScreen({ surface }: LoginScreenProps) {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div ref={revealRef} className="w-full max-w-[400px]">
        <Card>
          <CardHeader className="text-center">
            <p className="text-caption uppercase text-muted-foreground">
              {SURFACE_LABEL[surface]}
            </p>
            <CardTitle className="text-h2 text-primary">CobroDiario</CardTitle>
            <CardDescription>Inicia sesión con tu teléfono y contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
