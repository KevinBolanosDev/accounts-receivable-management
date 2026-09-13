// Compartir el PDF del recibo como ARCHIVO ADJUNTO, vía Web Share API.
//
// Por qué existe: un enlace `wa.me?text=…` solo puede prellenar **texto**. No
// hay forma de adjuntar un archivo por URL — es un límite de WhatsApp, no del
// código. Por eso el recibo se venía mandando como un mensaje escrito con el
// link al final. `navigator.share({ files })` abre la hoja de compartir nativa
// del teléfono, donde el cobrador elige WhatsApp y el PDF va adjunto de verdad.
//
// Soporte real: Chrome en Android y Safari en iOS ≥15 — que es exactamente el
// dispositivo del cobrador. En escritorio casi nunca está, y ahí se cae al
// enlace `wa.me` de siempre.

export interface ShareReceiptFileOptions {
  pdf: Blob;
  filename: string;
  /** Mismo mensaje que se manda por `wa.me`, para que el adjunto viaje con contexto. */
  text: string;
}

/**
 * ¿Puede este navegador compartir ESTE archivo? Hay que preguntarlo con el
 * archivo en la mano: `navigator.share` puede existir sin soportar `files`
 * (Web Share Level 1), y `canShare` filtra además por tipo de archivo.
 */
export function canShareReceiptFile(pdf: Blob, filename: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [toFile(pdf, filename)] });
  } catch {
    return false;
  }
}

/** `File` y no `Blob`: `navigator.share` exige `File[]`, con nombre y tipo. */
function toFile(pdf: Blob, filename: string): File {
  return new File([pdf], filename, { type: "application/pdf" });
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

/**
 * Devuelve `"unsupported"` (no lanza) cuando el navegador no puede compartir
 * archivos, para que quien llama caiga al enlace `wa.me` sin tratarlo como
 * error. `"cancelled"` es el usuario cerrando la hoja de compartir: tampoco es
 * un error y no debe mostrar un toast rojo.
 *
 * GOTCHA de activación: `navigator.share` exige que la llamada salga de un
 * gesto del usuario todavía "fresco". Si entre el click y el `share()` hay un
 * `await` largo (bajar el PDF), Safari puede rechazarla con `NotAllowedError`.
 * Por eso quien llama debería pasar un PDF que YA tenga en memoria cuando
 * pueda (`ReceiptScreen` lo tiene: es el mismo del iframe); cuando no, el
 * `NotAllowedError` se reporta como `"unsupported"` y cae al enlace.
 */
export async function shareReceiptFile({
  pdf,
  filename,
  text,
}: ShareReceiptFileOptions): Promise<ShareResult> {
  if (!canShareReceiptFile(pdf, filename)) return "unsupported";

  try {
    await navigator.share({ files: [toFile(pdf, filename)], text });
    return "shared";
  } catch (error) {
    // `AbortError` = el usuario cerró la hoja. Es una salida normal.
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    // `NotAllowedError` = se perdió la activación por gesto (ver arriba), o el
    // navegador la bloqueó. En los dos casos conviene el enlace de siempre.
    return "unsupported";
  }
}
