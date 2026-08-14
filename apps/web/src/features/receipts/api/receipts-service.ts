import { receiptSchema, type Receipt } from "@repo/types";

import { fetchReceiptPdf } from "@/entities/receipt";
import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";

export interface ReceiptsService {
  // Devuelve el PDF del recibo (no JSON). El front lo monta en un iframe con
  // un object URL. Requiere JWT del staff.
  getByPagoId(pagoId: string): Promise<Blob>;
  // Contraparte JSON del mismo recibo — lo que necesita `ReceiptScreen` para
  // armar el mensaje de WhatsApp (cliente, producto, monto, `reciboPublicUrl`)
  // justo después de cobrar, cuando solo tiene el `pagoId` en la URL.
  getData(pagoId: string): Promise<Receipt>;
}

// Mock — mantenido por la convención "mocks no se borran", pero `getByPagoId`
// ya no puede devolver algo útil: el recibo es un PDF generado con `pdfkit`,
// que es server-only. Mismo criterio que `mockCobrosService.registrarCobro` y
// `mockClosuresService.getPdfBlob` — no tiene sentido fingir en el navegador
// algo que solo corre en el servidor.
export const mockReceiptsService: ReceiptsService = {
  getByPagoId(): Promise<Blob> {
    return Promise.reject(
      new Error("El PDF del recibo lo genera el backend (pdfkit); no hay mock en el navegador."),
    );
  },
  async getData(pagoId: string): Promise<Receipt> {
    return receiptSchema.parse({
      id: pagoId,
      pagoId,
      codigo: `R-${pagoId.slice(0, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      credito: {
        codigo: "CR-2041",
        clienteNombre: "Cliente mock",
        productoNombre: "Producto mock",
        capital: 200000,
        interes: 20,
        montoTotal: 240000,
        cuotaValor: 20000,
        cuotas: 12,
        frecuencia: "DIARIO",
      },
      monto: 20000,
      saldoRestante: 180000,
      fecha: new Date().toISOString(),
      cobradorNombre: "Cobrador mock",
      numeroCuota: 3,
      cuotasPagadas: 3,
      cuotasRestantes: 9,
      cuotasPagadasDetalle: [],
      reciboPublicUrl: null,
      clienteTelefono: null,
    });
  },
};

// Variante real: delega en `entities/receipt`, donde vive el transporte desde
// que aparecieron tres consumidores (staff, portal del cliente y el detalle de
// crédito del Cobrador). Acá solo queda resolver el token del staff — el
// `scope: "staff"` es lo que elige el endpoint protegido por rol.
export const httpReceiptsService: ReceiptsService = {
  getByPagoId(pagoId: string): Promise<Blob> {
    const token = useSessionStore.getState().token;
    return fetchReceiptPdf({ pagoId, scope: "staff", token });
  },
  getData(pagoId: string): Promise<Receipt> {
    return apiFetch(`/payments/${pagoId}`, receiptSchema, {
      token: useSessionStore.getState().token,
    });
  },
};

// Único punto de inyección (ver FASE_4_SUBFASES.md §4.6 / §4.9).
export const receiptsService: ReceiptsService = httpReceiptsService;