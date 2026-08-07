import Link from "next/link";

import { BrandRing } from "@/shared/ui/brand-ring";
import { Button } from "@/shared/ui/button";

// 404 raíz: cubre las URLs que no caen en ninguna superficie. No usa
// `NotFoundState` porque acá no hay shell ni contexto — es una página
// completa, y el único destino sensato es la raíz (desde donde cada rol entra
// a su portal).
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandRing size="lg" dashed tone="muted" />
      <div className="flex flex-col gap-1">
        <h1 className="text-h2">Esta página no existe</h1>
        <p className="text-body-sm text-muted-foreground">
          Revisá la dirección o volvé al inicio para entrar a tu portal.
        </p>
      </div>
      <Button asChild variant="secondary">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </main>
  );
}
