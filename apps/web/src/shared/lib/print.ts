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
  // El iframe tiene que estar RENDERIZADO y con tamaño real. Antes se ocultaba
  // con `visibility:hidden` y `0×0`: Chrome ignora un frame sin caja de
  // impresión y cae al documento de arriba, así que "Descargar recibo" abría
  // el diálogo con una captura de la PANTALLA (la app entera) en vez del
  // recibo. Se esconde sacándolo del viewport — sigue teniendo layout, que es
  // lo único que el motor de impresión mira.
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "-10000px";
  // Tamaño de hoja (A4 a 96dpi): el documento maqueta contra un ancho real y
  // no contra 0px, que es lo que producía saltos de página absurdos.
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.border = "0";
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
    // Un frame de gracia: `load` dispara con el DOM listo, pero el layout del
    // documento recién insertado puede no haberse resuelto todavía e imprimir
    // en ese instante sale en blanco.
    window.requestAnimationFrame(() => {
      try {
        win.focus();
        win.print();
      } catch {
        cleanup();
        return;
      }
      window.setTimeout(cleanup, 60_000);
    });
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  return true;
}
