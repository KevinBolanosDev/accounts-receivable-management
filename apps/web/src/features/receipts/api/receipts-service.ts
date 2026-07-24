import { useSessionStore } from "@/entities/session";
import { apiUrl, authHeaders } from "@/shared/api/client";

export interface ReceiptsService {
  // Devuelve el HTML server-rendered del recibo (no JSON). El front lo monta
  // en un iframe con `srcDoc`. Requiere JWT del staff.
  getByPagoId(pagoId: string): Promise<string>;
}

// Mock — devuelve un HTML placeholder con datos del seed para poder iterar
// el front sin esperar al back (se activa en 4.9). Mantenido por la
// convención "mocks no se borran".
const mockHtml = (pagoId: string): string => `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Recibo (mock)</title>
</head>
<body style="font-family: system-ui; padding: 24px; color: #1f2937;">
  <h1 style="margin: 0 0 8px; font-size: 20px;">RECIBO DE PAGO (mock)</h1>
  <p style="color:#6b7280; margin: 0 0 24px;">pagoId: ${pagoId}</p>
  <p>Este HTML es un placeholder. En 4.8 el back sirve el HTML real
     desde <code>/payments/:pagoId/receipt</code>.</p>
</body>
</html>
`;

export const mockReceiptsService: ReceiptsService = {
  async getByPagoId(pagoId: string): Promise<string> {
    return mockHtml(pagoId);
  },
};

// Variante real: hace fetch al endpoint protegido del back (4.8). El token
// del staff viaja en el header para que el `JwtAuthGuard` global lo acepte.
// Como `shared` no puede importar el store (regla FSD), lo recibe como
// parámetro desde el caller — mismo patrón que `useSessionStore.getState()`.
export const httpReceiptsService: ReceiptsService = {
  async getByPagoId(pagoId: string): Promise<string> {
    const token = useSessionStore.getState().token;
    const res = await fetch(apiUrl(`/payments/${pagoId}/receipt`), {
      headers: { ...authHeaders(token) },
    });
    if (!res.ok) {
      // Mismo manejo de errores que `apiFetch` pero devolviendo string (HTML).
      const message = await res
        .json()
        .then((j: { message?: string }) => j.message)
        .catch(() => undefined);
      throw new Error(message ?? `Error ${res.status} al obtener el recibo`);
    }
    return res.text();
  },
};

// Único punto de inyección (ver FASE_4_SUBFASES.md §4.6 / §4.9).
export const receiptsService: ReceiptsService = httpReceiptsService;