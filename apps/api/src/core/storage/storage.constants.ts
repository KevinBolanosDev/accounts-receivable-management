// TTL de la URL firmada de la foto de documento. Corta a propósito: es un
// documento de identidad, no un asset público — cuanto menos vive la firma,
// menos daño hace una URL filtrada (log, captura de pantalla, historial del
// navegador). El detalle del cliente vuelve a firmar en cada request, así
// que el costo de que expire pronto es solo un round-trip extra a Storage,
// no una degradación visible.
export const DOCUMENT_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;
