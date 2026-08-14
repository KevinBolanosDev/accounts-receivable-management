"use client";

import * as React from "react";
import { toast } from "sonner";

import { downloadBlob } from "@/shared/lib/download-blob";
import { fetchReceiptPdf, receiptFilename, type ReceiptScope } from "../api/receipt-pdf";
import { shareReceiptFile, type ShareResult } from "../lib/share-file";

export type ReceiptActionKind = "view" | "download" | "share";

interface UseReceiptActionsOptions {
  scope: ReceiptScope;
  /** Lo lee el FEATURE del store que corresponda y lo pasa acá. */
  token: string | null;
}

export interface ReceiptActionsController {
  pendingPagoId: string | null;
  pendingKind: ReceiptActionKind | null;
  /**
   * URL de objeto del recibo abierto en la previsualización, o `null`. El
   * consumidor la monta en un `<iframe src>` dentro de su propio diálogo.
   */
  previewUrl: string | null;
  view: (pagoId: string) => Promise<void>;
  closePreview: () => void;
  download: (pagoId: string, codigo?: string) => Promise<void>;
  /**
   * Comparte el PDF como ARCHIVO por la hoja nativa del teléfono. Devuelve
   * `"unsupported"` si este navegador no puede compartir archivos, para que
   * quien llama abra el enlace `wa.me` de siempre en su lugar.
   */
  share: (pagoId: string, opts: { text: string; codigo?: string }) => Promise<ShareResult>;
}

/**
 * Orquesta las acciones de recibo (traer el PDF → verlo o guardarlo). Una sola
 * implementación para el Cobrador, el Admin y el Portal del Cliente; lo único
 * que cambia es el `scope` y de qué store sale el token.
 *
 * El hook es dueño del object URL de la previsualización, en vez de pasárselo
 * al consumidor por callback como hacía con el HTML: un `URL.createObjectURL`
 * sin su `revokeObjectURL` retiene el Blob completo en memoria hasta recargar
 * la página, y repartir esa responsabilidad entre tres pantallas garantizaba
 * que alguna se la olvidara. Acá se revoca al cerrar y al desmontar, una vez.
 */
export function useReceiptActions({
  scope,
  token,
}: UseReceiptActionsOptions): ReceiptActionsController {
  const [pending, setPending] = React.useState<{
    pagoId: string;
    kind: ReceiptActionKind;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Ref espejo del state: el cleanup de desmontaje necesita la URL vigente sin
  // volverse a suscribir en cada cambio (un effect con `[previewUrl]` revocaría
  // la URL anterior en cada render, incluido el que la acaba de crear).
  const previewUrlRef = React.useRef<string | null>(null);

  const replacePreview = React.useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, []);

  const run = React.useCallback(
    async (pagoId: string, kind: ReceiptActionKind, onSuccess: (pdf: Blob) => void) => {
      setPending({ pagoId, kind });
      try {
        onSuccess(await fetchReceiptPdf({ pagoId, scope, token }));
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
      await run(pagoId, "view", (pdf) => replacePreview(URL.createObjectURL(pdf)));
    },
    [run, replacePreview],
  );

  const closePreview = React.useCallback(() => replacePreview(null), [replacePreview]);

  const download = React.useCallback(
    async (pagoId: string, codigo?: string) => {
      // Guardado directo del archivo. Antes esto era `printHtmlDocument`: un
      // iframe fuera de pantalla + `window.print()` para que el usuario
      // eligiera "Guardar como PDF" en el diálogo de impresión, con una rama
      // aparte para iOS Safari. Ahora el backend ya devuelve el PDF, así que
      // se guarda y listo — sin diálogo de impresión de por medio.
      await run(pagoId, "download", (pdf) => downloadBlob(pdf, receiptFilename(codigo)));
    },
    [run],
  );

  const share = React.useCallback(
    async (pagoId: string, opts: { text: string; codigo?: string }): Promise<ShareResult> => {
      setPending({ pagoId, kind: "share" });
      try {
        const pdf = await fetchReceiptPdf({ pagoId, scope, token });
        return await shareReceiptFile({
          pdf,
          filename: receiptFilename(opts.codigo),
          text: opts.text,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo compartir el recibo.");
        // No es `"unsupported"`: el navegador SÍ podía compartir, lo que falló
        // fue bajar el PDF. Caer al enlace `wa.me` acá mandaría un mensaje con
        // un link que probablemente tampoco funcione, encima sin avisar.
        return "cancelled";
      } finally {
        setPending(null);
      }
    },
    [scope, token],
  );

  return {
    pendingPagoId: pending?.pagoId ?? null,
    pendingKind: pending?.kind ?? null,
    previewUrl,
    view,
    closePreview,
    download,
    share,
  };
}
