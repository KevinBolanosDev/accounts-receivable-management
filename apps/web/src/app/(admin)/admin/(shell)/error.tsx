"use client";

import { useEffect } from "react";

import { ErrorState } from "@/shared/ui/error-state";

// Antes de esta fase la app no tenía NINGÚN `error.tsx`: una excepción no
// capturada en cualquier pantalla del panel tumbaba el árbol entero y el
// usuario se quedaba con una pantalla en blanco, sin forma de volver.
//
// `reset()` de Next re-intenta renderizar el segmento — es exactamente el
// "Reintentar" de §2.9, así que el botón de `ErrorState` lo llama directo.
export default function AdminShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sin servicio de errores todavía (Fase 6): al menos queda en la consola
    // del navegador con el `digest` que permite cruzarlo con el log del server.
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <ErrorState
        title="Algo salió mal en esta pantalla"
        description="El resto del panel sigue funcionando. Podés reintentar o navegar a otra sección."
        onRetry={reset}
        className="max-w-md"
      />
    </div>
  );
}
