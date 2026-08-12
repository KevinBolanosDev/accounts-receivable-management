"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import type { Receipt } from "@repo/types";

import { ReceiptActions } from "@/entities/receipt";
import { printHtmlDocument } from "@/shared/lib/print";

import { receiptsService } from "../api/receipts-service";

interface ReceiptScreenProps {
  pagoId: string;
}

// Barra superior con "volver" + acciones (compartir/descargar). El recibo se
// abre justo después de registrar un cobro (`router.push`) y también desde el
// historial, así que la pantalla es un callejón sin salida sin el back — y,
// hasta acá, también sin forma de compartirlo: era la única pantalla de
// recibo sin `ReceiptActions`, así que justo después de cobrar no había cómo
// mandarlo por WhatsApp (había que ir al historial y buscar la misma fila).
function ReceiptTopBar({ actions }: { actions?: React.ReactNode }) {
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
      <span className="flex-1 text-body-sm font-semibold">Recibo</span>
      {actions}
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
  // Aparte del HTML: un fallo acá no debe tumbar la vista del recibo, solo
  // dejar "Compartir" apagado (mismo criterio que en el resto de la app — un
  // botón deshabilitado con motivo, nunca uno que promete algo que no pasa).
  const [data, setData] = useState<Receipt | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    void receiptsService
      .getData(pagoId)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        // Silencioso a propósito: `data` se queda en `null` y las acciones se
        // pintan deshabilitadas en vez de romper la pantalla.
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
          <p className="text-body text-destructive-strong">{state.message}</p>
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

  const html = state.html;

  return (
    <div className="flex min-h-full flex-col">
      <ReceiptTopBar
        actions={
          <ReceiptActions
            actions={["download", "share"]}
            onDownload={() => {
              // Reusa el MISMO HTML que ya está en pantalla (el del iframe) —
              // sin re-pedirlo — así que el PDF generado es idéntico a lo que
              // se ve. `printHtmlDocument` es el iframe fuera de pantalla con
              // layout real (ver `shared/lib/print.ts`); un `window.print()`
              // acá imprimiría también esta barra y el shell de la app.
              printHtmlDocument(html, { title: data?.codigo ?? `Recibo ${pagoId}` });
            }}
            phone={data?.clienteTelefono}
            share={
              data
                ? {
                    clienteNombre: data.credito.clienteNombre,
                    producto: data.credito.productoNombre,
                    monto: data.monto,
                    fecha: data.fecha,
                    reciboCodigo: data.codigo,
                    publicUrl: data.reciboPublicUrl,
                  }
                : undefined
            }
          />
        }
      />
      <iframe
        title={`Recibo ${pagoId}`}
        srcDoc={html}
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
