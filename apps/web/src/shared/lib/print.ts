// Impresión de un documento HTML suelto (el recibo server-rendered).
//
// "Descargar recibo" = abrir el diálogo de impresión del navegador y dejar que
// el usuario elija "Guardar como PDF". No genera un PDF en el server (eso es
// Fase 5): cero dependencias nuevas y funciona igual en móvil, que es donde
// vive la app del cobrador.

interface PrintOptions {
  title?: string;
}

// iOS Safari no imprime de forma fiable desde un iframe oculto (y a veces
// tampoco dispara `afterprint`). Ahí conviene abrir el documento en una
// pestaña y dejar que el usuario use el menú Compartir → Imprimir.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ se reporta como Mac; se distingue por el táctil.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function printInNewTab(html: string): boolean {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return false; // popup bloqueado
  }
  // No se revoca de inmediato: la pestaña todavía está cargando el blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/**
 * Imprime un documento HTML completo sin sacar al usuario de la página actual.
 * Devuelve `false` si el navegador bloqueó el fallback de pestaña nueva —
 * quien llama debe avisarle al usuario en ese caso.
 */
export function printHtmlDocument(html: string, options: PrintOptions = {}): boolean {
  if (typeof window === "undefined") return false;

  if (isIOS()) {
    return printInNewTab(html);
  }

  const iframe = document.createElement("iframe");
  // Fuera de pantalla en vez de `display:none`: algunos navegadores no
  // renderizan (y por tanto no imprimen) un iframe sin layout.
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  if (options.title) iframe.title = options.title;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    // `afterprint` es el camino normal; el timeout es la red de seguridad para
    // los navegadores que no lo emiten (si no, el iframe queda huérfano).
    win.addEventListener("afterprint", cleanup);
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    window.setTimeout(cleanup, 60_000);
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  return true;
}
