// Código legible de un recibo, derivado del `pagoId` (no hay tabla `Recibo`
// separada). Compartido por `cobros` (arma la URL al registrar el cobro),
// `receipts` (lo repite en el HTML) y `client-portal` (historial enriquecido)
// — vive en `core/domain` para que ninguno de los tres importe el service de
// otro.
export function buildReciboCodigo(pagoId: string): string {
  return `R-${pagoId.slice(0, 8).toUpperCase()}`;
}
