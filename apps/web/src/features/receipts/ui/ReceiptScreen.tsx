"use client";

import { useEffect, useState } from "react";

import { receiptsService } from "../api/receipts-service";

interface ReceiptScreenProps {
  pagoId: string;
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
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-body text-destructive">{state.message}</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-body text-muted-foreground">Cargando recibo…</p>
      </div>
    );
  }

  return (
    <iframe
      title={`Recibo ${pagoId}`}
      srcDoc={state.html}
      className="h-screen w-full border-0 bg-background"
    />
  );
}

export function ReceiptScreen(props: ReceiptScreenProps) {
  // La clave basada en `pagoId` fuerza remount al cambiar el pago → resetea
  // el state a "loading" sin necesidad de `setState` en un effect. Cumple
  // con la regla `set-state-in-effect` y mantiene el código simple.
  return <ReceiptScreenInner key={props.pagoId} {...props} />;
}