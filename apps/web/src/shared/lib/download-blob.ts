// Dispara la descarga de un `Blob` ya en memoria (el PDF del cierre diario,
// Fase 5.8) — un `<a download>` temporal es el único mecanismo que funciona
// en todos los navegadores para "guardar como archivo" sin round-trip a un
// endpoint público (el PDF exige JWT, no es un `<a href>` directo).
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // No se revoca de inmediato: algunos navegadores todavía están escribiendo
  // el archivo a disco cuando este código sigue ejecutando.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
