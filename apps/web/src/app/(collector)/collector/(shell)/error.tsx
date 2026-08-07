"use client";

import { useEffect } from "react";

import { ErrorState } from "@/shared/ui/error-state";

export default function CollectorShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[collector]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <ErrorState
        title="No pudimos cargar esta pantalla"
        // El cobrador está en la calle: la causa más probable es la señal, y
        // el mensaje tiene que decirle qué hacer, no qué falló técnicamente.
        description="Revisá tu conexión y volvé a intentar. Los cobros que ya registraste están guardados."
        onRetry={reset}
        className="w-full max-w-sm"
      />
    </div>
  );
}
