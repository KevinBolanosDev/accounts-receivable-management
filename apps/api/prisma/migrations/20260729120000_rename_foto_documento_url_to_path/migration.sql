-- El bucket de Supabase pasa de público a privado (documentos de identidad):
-- ya no existe una URL pública que persistir, solo el path dentro del bucket.
-- La URL se firma al vuelo con expiración cuando se pide el detalle del
-- cliente (ver StorageService.createSignedUrls). RENAME y no DROP+ADD porque,
-- aunque hoy las dos columnas están en 0 filas no-null (nunca funcionó el
-- bucket viejo), un rename es la operación correcta para lo que es
-- semánticamente el mismo dato con un significado más preciso.
ALTER TABLE "public"."Cliente" RENAME COLUMN "fotoDocumentoFrenteUrl" TO "fotoDocumentoFrentePath";
ALTER TABLE "public"."Cliente" RENAME COLUMN "fotoDocumentoReversoUrl" TO "fotoDocumentoReversoPath";
