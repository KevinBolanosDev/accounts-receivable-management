import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import { DOCUMENT_PHOTO_SIGNED_URL_TTL_SECONDS } from "./storage.constants";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>("SUPABASE_URL");
    const key = config.getOrThrow<string>("SUPABASE_SERVICE_KEY");
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
    this.bucket = config.getOrThrow<string>("SUPABASE_STORAGE_BUCKET");
  }

  // Sube la imagen y devuelve el PATH (no una URL — el bucket es privado
  // desde que guarda documentos de identidad). El path es lo que se persiste
  // en `Cliente.fotoDocumento*Path`; la URL se firma aparte, bajo demanda,
  // con `createSignedUrl(s)`.
  async uploadImagen(buffer: Buffer, mimetype: string): Promise<{ path: string }> {
    const extension = this.extensionForMime(mimetype);
    // Antes el path era `documentos/<uuid>.ext` DENTRO del bucket `documentos`,
    // así que la ruta real quedaba `documentos/documentos/<uuid>.ext` — un
    // prefijo redundante con el nombre del bucket. `id-documents/` es un
    // prefijo que describe el contenido, no el contenedor.
    const path = `id-documents/${randomUUID()}${extension}`;

    const { error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType: mimetype,
      upsert: false,
    });

    if (error) {
      // Antes esto era `throw error` crudo: un `StorageError` de supabase-js,
      // NO una `HttpException`, así que Nest lo convertía en un 500 genérico
      // sin loguear nada — un bucket mal configurado o una key sin permisos
      // eran indistinguibles de cualquier otro fallo interno. Ahora queda en
      // el log con el detalle real, y el cliente recibe un mensaje accionable.
      this.logger.error(
        `Fallo al subir a Storage (bucket="${this.bucket}", path="${path}"): ${error.message}`,
      );
      if (error.message.toLowerCase().includes("bucket not found")) {
        this.logger.error(
          `El bucket "${this.bucket}" no existe en Supabase. Verifica SUPABASE_STORAGE_BUCKET y créalo si falta.`,
        );
      }
      throw new ServiceUnavailableException("No se pudo guardar la imagen. Intenta de nuevo.");
    }

    return { path };
  }

  // Firma un solo path. Devuelve `null` si falla (path borrado a mano, bucket
  // mal configurado) en vez de lanzar: un fallo de firma no debe tumbar el
  // detalle del cliente completo, solo dejar esa foto sin mostrar.
  async createSignedUrl(path: string): Promise<string | null> {
    const result = await this.createSignedUrls([path]);
    return result.get(path) ?? null;
  }

  // Firma varios paths en UN solo round-trip a Storage (la API de Supabase lo
  // soporta nativo). Se usa siempre en batch desde `ClientsService`, nunca un
  // path a la vez, para que el detalle de un cliente con 2 fotos no dispare 2
  // llamadas separadas.
  async createSignedUrls(paths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (paths.length === 0) return result;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrls(paths, DOCUMENT_PHOTO_SIGNED_URL_TTL_SECONDS);

    if (error) {
      this.logger.warn(
        `Fallo al firmar ${paths.length} path(s) en Storage (bucket="${this.bucket}"): ${error.message}`,
      );
      return result;
    }

    for (const item of data) {
      if (item.error || !item.signedUrl) {
        this.logger.warn(`No se pudo firmar "${item.path}": ${item.error ?? "sin signedUrl"}`);
        continue;
      }
      if (item.path) result.set(item.path, item.signedUrl);
    }

    return result;
  }

  private extensionForMime(mimetype: string): string {
    if (mimetype === "image/jpeg") return ".jpg";
    if (mimetype === "image/png") return ".png";
    if (mimetype === "image/webp") return ".webp";
    return extname(mimetype) || ".bin";
  }
}
