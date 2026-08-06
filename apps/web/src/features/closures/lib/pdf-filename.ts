// Nombre sugerido al guardar el PDF descargado. El `Content-Disposition`
// del backend no aplica acá: el archivo sale de un `Blob` armado a mano
// (`apiFetchBlob`), no de una navegación directa a la URL, así que el
// nombre que decide el navegador es el que le pongamos al `<a download>`.
export function closurePdfFilename(rutaNombre: string, date: string): string {
  const slug = rutaNombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `cierre-${slug}-${date}.pdf`;
}
