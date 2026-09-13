import { apiUrl, authHeaders } from "@/shared/api/client";

// Descarga del PDF del recibo. El backend lo genera on-demand con `pdfkit`
// (`receipt-pdf.ts` en la API) y lo sirve como `application/pdf`, así que no
// pasa por `apiFetch` — no hay JSON ni schema Zod que validar sobre bytes.
// Mismo criterio que `apiFetchBlob` para el PDF del cierre diario.
//
// Antes esto bajaba `text/html` (el recibo era una plantilla HTML
// server-rendered) y el front lo montaba con `srcDoc`. El recibo pasó a PDF en
// los TRES consumidores a la vez para que siga habiendo una sola plantilla:
// ver el comentario del módulo en `apps/api/src/modules/receipts/receipt-pdf.ts`.
//
// El TOKEN entra por parámetro y no se lee del store: `entities/receipt` no
// puede importar `entities/session` (cross-import entre entities, tan prohibido
// como uno hacia arriba). Es la misma convención que ya usa `apiFetch`. Además
// es lo que permite que UNA sola implementación sirva a los dos scopes.

export type ReceiptScope = "staff" | "client";

const RECEIPT_PATH: Record<ReceiptScope, (pagoId: string) => string> = {
  staff: (pagoId) => `/payments/${pagoId}/receipt`,
  client: (pagoId) => `/client-portal/payments/${pagoId}/receipt`,
};

interface FetchReceiptPdfOptions {
  pagoId: string;
  scope: ReceiptScope;
  token?: string | null;
}

export async function fetchReceiptPdf({
  pagoId,
  scope,
  token,
}: FetchReceiptPdfOptions): Promise<Blob> {
  const res = await fetch(apiUrl(RECEIPT_PATH[scope](pagoId)), {
    headers: { ...authHeaders(token) },
  });

  if (!res.ok) {
    // El cuerpo de error SÍ es JSON (lo arma Nest), aunque la respuesta feliz
    // sea binaria — por eso el `.json()` acá y el `.blob()` abajo.
    const message = await res
      .json()
      .then((json: { message?: string }) => json.message)
      .catch(() => undefined);
    throw new Error(message ?? `Error ${res.status} al obtener el recibo`);
  }

  return res.blob();
}

/** Nombre de archivo para guardar. Espeja `receiptPdfFilename` del backend. */
export function receiptFilename(codigo?: string | null): string {
  const slug = (codigo ?? "").replace(/[^a-zA-Z0-9-_]/g, "");
  return slug ? `recibo-${slug}.pdf` : "recibo.pdf";
}
