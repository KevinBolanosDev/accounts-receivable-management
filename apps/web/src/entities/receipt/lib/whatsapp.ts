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
  /** Enlace público firmado (`/r/:token`) — el que el cliente puede abrir. */
  publicUrl?: string | null;
}

/**
 * Mensaje del recibo: un saludo corto y el enlace, nada más. El PDF ya lleva
 * todo el detalle (producto, cuota, monto, fecha) — repetirlo acá era ruido
 * antes de que el recibo fuera un archivo, y ahora que se adjunta de verdad
 * (`shareReceiptFile`) es directamente redundante. El enlace va al final para
 * que WhatsApp genere la previsualización y quede clicable.
 */
export function buildReceiptShareText(info: ReceiptShareInfo): string {
  const saludo = info.clienteNombre
    ? `Hola, ${info.clienteNombre}, aquí te compartimos tu recibo.`
    : "Aquí te compartimos tu recibo.";

  return info.publicUrl ? `${saludo}\n\n${info.publicUrl}` : saludo;
}
