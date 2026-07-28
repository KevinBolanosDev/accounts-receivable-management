"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { receiptsService } from "../api/receipts-service";

interface ReceiptScreenProps {
  pagoId: string;
}

// Barra superior con "volver". El recibo se abre justo después de registrar un
// cobro (`router.push`) y también desde el historial, así que la pantalla es un
// callejón sin salida sin esto: el iframe ocupa todo el alto y el tab bar queda
// tapado. `router.back()` respeta de dónde se vino en ambos casos.
function ReceiptTopBar() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-2 py-2">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Volver"
        className="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeftIcon className="size-5" />
      </button>
      <span className="text-body-sm font-semibold">Recibo</span>
    </header>
  );
}

type ReceiptState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; html: string };

// Pantalla #18c — Recibo y compartir (Cobrador, móvil).
// Envuelve el HTML server-rendered del back en un iframe con `srcDoc` para
// no perder la sesión del cobrador ni abrir nueva pestaña.
//
// Patrón `useState` + `useEffect` con fetch asíncrono: el `setState` se hace
// dentro del `.then`/`.catch` del effect, que es la forma canónica para
// cargar datos asíncronos en React 18+. La regla
// `react-hooks/set-state-in-effect` del plugin v7 todavía marca este patrón
// (es un falso positivo conocido para fetch + setState) — lo silenciamos
// localmente porque es exactamente lo que queremos hacer aquí.
function ReceiptScreenInner({ pagoId }: ReceiptScreenProps) {
  const [state, setState] = useState<ReceiptState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void receiptsService
      .getByPagoId(pagoId)
      .then((value) => {
        if (cancelled) return;
        setState({ status: "ready", html: value });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Error al cargar el recibo.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [pagoId]);

  if (state.status === "error") {
    return (
      <div className="flex flex-col">
        <ReceiptTopBar />
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-body text-destructive">{state.message}</p>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col">
        <ReceiptTopBar />
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-body text-muted-foreground">Cargando recibo…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <ReceiptTopBar />
      <iframe
        title={`Recibo ${pagoId}`}
        srcDoc={state.html}
        // `flex-1` en vez de `h-screen`: con el alto completo de viewport la
        // barra empujaba el iframe y aparecía scroll de más.
        className="min-h-[70vh] w-full flex-1 border-0 bg-background"
      />
    </div>
  );
}

export function ReceiptScreen(props: ReceiptScreenProps) {
  // La clave basada en `pagoId` fuerza remount al cambiar el pago → resetea
  // el state a "loading" sin necesidad de `setState` en un effect. Cumple
  // con la regla `set-state-in-effect` y mantiene el código simple.
  return <ReceiptScreenInner key={props.pagoId} {...props} />;
}