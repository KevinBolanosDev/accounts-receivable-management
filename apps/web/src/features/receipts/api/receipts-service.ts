import { fetchReceiptHtml } from "@/entities/receipt";
import { useSessionStore } from "@/entities/session";

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

// Variante real: delega en `entities/receipt`, donde vive el transporte desde
// que aparecieron tres consumidores (staff, portal del cliente y el detalle de
// crédito del Cobrador). Acá solo queda resolver el token del staff — el
// `scope: "staff"` es lo que elige el endpoint protegido por rol.
export const httpReceiptsService: ReceiptsService = {
  getByPagoId(pagoId: string): Promise<string> {
    const token = useSessionStore.getState().token;
    return fetchReceiptHtml({ pagoId, scope: "staff", token });
  },
};

// Único punto de inyección (ver FASE_4_SUBFASES.md §4.6 / §4.9).
export const receiptsService: ReceiptsService = httpReceiptsService;