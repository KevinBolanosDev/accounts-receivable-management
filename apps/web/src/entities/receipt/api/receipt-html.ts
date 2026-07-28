import { apiUrl, authHeaders } from "@/shared/api/client";

// Descarga del HTML del recibo. El backend lo sirve como documento standalone
// (`text/html`, sin Tailwind ni SPA), así que no pasa por `apiFetch` — no hay
// JSON ni schema Zod que validar.
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

interface FetchReceiptHtmlOptions {
  pagoId: string;
  scope: ReceiptScope;
  token?: string | null;
}

export async function fetchReceiptHtml({
  pagoId,
  scope,
  token,
}: FetchReceiptHtmlOptions): Promise<string> {
  const res = await fetch(apiUrl(RECEIPT_PATH[scope](pagoId)), {
    headers: { ...authHeaders(token) },
  });

  if (!res.ok) {
    const message = await res
      .json()
      .then((json: { message?: string }) => json.message)
      .catch(() => undefined);
    throw new Error(message ?? `Error ${res.status} al obtener el recibo`);
  }

  return res.text();
}
