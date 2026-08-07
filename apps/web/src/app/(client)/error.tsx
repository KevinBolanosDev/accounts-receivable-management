"use client";

import { useEffect } from "react";

import { ErrorState } from "@/shared/ui/error-state";

// El portal del cliente es la superficie con menos tolerancia a un error: no
// hay soporte del otro lado ni nada que el cliente pueda "arreglar". El copy
// evita tecnicismos y le dice a quién preguntar (§2.8: "qué pasó y qué hacer,
// sin tecnicismos").
export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[client]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6 py-8">
      <ErrorState
        title="No pudimos mostrar tu información"
        description="Intentá de nuevo en un momento. Si sigue pasando, avisale a tu cobrador."
        onRetry={reset}
        className="w-full"
      />
    </main>
  );
}
