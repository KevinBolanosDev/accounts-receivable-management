"use client";

import * as React from "react";
import { toast } from "sonner";

import { printHtmlDocument } from "@/shared/lib/print";
import { fetchReceiptHtml, type ReceiptScope } from "../api/receipt-html";

export type ReceiptActionKind = "view" | "download" | "share";

interface UseReceiptActionsOptions {
  scope: ReceiptScope;
  /** Lo lee el FEATURE del store que corresponda y lo pasa acá. */
  token: string | null;
  /** Qué hacer con el HTML en la acción "ver" (ej. abrir un Dialog con iframe). */
  onHtml?: (html: string, pagoId: string) => void;
}

export interface ReceiptActionsController {
  pendingPagoId: string | null;
  pendingKind: ReceiptActionKind | null;
  view: (pagoId: string) => Promise<void>;
  download: (pagoId: string, titulo?: string) => Promise<void>;
}

/**
 * Orquesta las acciones de recibo (traer el HTML → mostrarlo o imprimirlo).
 * Una sola implementación para el Cobrador y para el Portal del Cliente; lo
 * único que cambia es el `scope` y de qué store sale el token.
 */
export function useReceiptActions({
  scope,
  token,
  onHtml,
}: UseReceiptActionsOptions): ReceiptActionsController {
  const [pending, setPending] = React.useState<{
    pagoId: string;
    kind: ReceiptActionKind;
  } | null>(null);

  const run = React.useCallback(
    async (pagoId: string, kind: ReceiptActionKind, onSuccess: (html: string) => void) => {
      setPending({ pagoId, kind });
      try {
        const html = await fetchReceiptHtml({ pagoId, scope, token });
        onSuccess(html);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo abrir el recibo.");
      } finally {
        setPending(null);
      }
    },
    [scope, token],
  );

  const view = React.useCallback(
    async (pagoId: string) => {
      await run(pagoId, "view", (html) => onHtml?.(html, pagoId));
    },
    [run, onHtml],
  );

  const download = React.useCallback(
    async (pagoId: string, titulo?: string) => {
      await run(pagoId, "download", (html) => {
        const ok = printHtmlDocument(html, { title: titulo });
        if (!ok) {
          // Único caso en que el usuario no ve nada pasar: el navegador
          // bloqueó la pestaña del fallback de iOS.
          toast.error("Tu navegador bloqueó la ventana. Habilita las ventanas emergentes.");
        }
      });
    },
    [run],
  );

  return {
    pendingPagoId: pending?.pagoId ?? null,
    pendingKind: pending?.kind ?? null,
    view,
    download,
  };
}
