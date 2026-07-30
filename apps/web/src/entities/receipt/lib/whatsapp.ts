import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateTime } from "@/shared/lib/format-date";
import { toDialableE164 } from "@/shared/lib/phone";

// Construcción del enlace de WhatsApp para compartir un recibo.
//
// Reemplaza dos implementaciones divergentes: una en `ClientPaymentsScreen`
// (que nunca llegaba a ejecutarse porque el pago no traía recibo) y otra en
// `ReceiptCard` que compartía un enlace a `/client/login` — el destinatario
// tenía que tener acceso al portal y buscar el recibo a mano.

/**
 * `wa.me` quiere el número en E.164 sin `+` ni separadores. `toDialableE164`
 * resuelve el indicativo: el explícito si el teléfono se guardó con selector
 * de país, o `DEFAULT_COUNTRY` para los números legados sin `+`.
 */
function normalizePhone(phone: string): string {
  return toDialableE164(phone).replace(/\D/g, "");
}

interface BuildWhatsAppUrlOptions {
  text: string;
  /** Si viene, abre el chat de ese contacto; si no, WhatsApp pide a quién enviar. */
  phone?: string | null;
}

export function buildWhatsAppUrl({ text, phone }: BuildWhatsAppUrlOptions): string {
  const encoded = encodeURIComponent(text);
  const destino = phone ? normalizePhone(phone) : "";
  return destino ? `https://wa.me/${destino}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export interface ReceiptShareInfo {
  clienteNombre?: string | null;
  producto?: string | null;
  numeroCuota?: number | null;
  cuotasTotal?: number | null;
  monto: number;
  fecha?: string | null;
  reciboCodigo?: string | null;
  /** Enlace público firmado (`/r/:token`) — el que el cliente puede abrir. */
  publicUrl?: string | null;
}

/**
 * Mensaje del recibo. El enlace va al final para que WhatsApp genere la
 * previsualización y quede clicable.
 */
export function buildReceiptShareText(info: ReceiptShareInfo): string {
  const lineas: string[] = [];

  lineas.push(
    info.clienteNombre
      ? `Hola ${info.clienteNombre}, este es tu recibo de pago.`
      : "Este es tu recibo de pago.",
  );
  lineas.push("");

  if (info.producto) lineas.push(`Producto: ${info.producto}`);
  if (info.numeroCuota) {
    lineas.push(
      `Cuota: ${info.numeroCuota}${info.cuotasTotal ? `/${info.cuotasTotal}` : ""}`,
    );
  }
  lineas.push(`Monto: ${formatCurrency(info.monto)}`);
  if (info.fecha) lineas.push(`Fecha: ${formatDateTime(info.fecha)}`);
  if (info.reciboCodigo) lineas.push(`Recibo: ${info.reciboCodigo}`);

  if (info.publicUrl) {
    lineas.push("");
    lineas.push(info.publicUrl);
  }

  return lineas.join("\n");
}
