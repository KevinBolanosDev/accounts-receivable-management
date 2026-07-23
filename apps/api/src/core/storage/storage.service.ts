import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

@Injectable()
export class StorageService {
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

  async uploadImagen(buffer: Buffer, mimetype: string): Promise<string> {
    const extension = this.extensionForMime(mimetype);
    const path = `documentos/${randomUUID()}${extension}`;
    const { error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType: mimetype,
      upsert: false,
    });

    if (error) throw error;
    return this.client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  private extensionForMime(mimetype: string): string {
    if (mimetype === "image/jpeg") return ".jpg";
    if (mimetype === "image/png") return ".png";
    if (mimetype === "image/webp") return ".webp";
    return extname(mimetype) || ".bin";
  }
}
