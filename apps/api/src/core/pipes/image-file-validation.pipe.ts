import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ALLOWED_DOCUMENT_PHOTO_MIME, MAX_DOCUMENT_PHOTO_BYTES } from "@repo/types";

// Comparte constantes con el frontend (`@repo/types`) para que el límite y
// los tipos permitidos no puedan divergir entre las dos validaciones.
const ALLOWED_MIME_TYPES = new Set<string>(ALLOWED_DOCUMENT_PHOTO_MIME);

type ImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class ImageFileValidationPipe implements PipeTransform {
  transform(file: ImageFile | undefined): ImageFile {
    if (!file) throw new BadRequestException("Debes adjuntar una imagen.");
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Solo se permiten imágenes JPEG, PNG o WebP.");
    }
    // Este check SÍ es alcanzable: el límite de Multer (ver
    // `clientes.controller.ts`) se dejó 1MB por encima a propósito para que
    // el 400 en español de acá gane siempre sobre el 413 "File too large"
    // en inglés que lanzaría Multer si ambos límites coincidieran.
    if (file.size > MAX_DOCUMENT_PHOTO_BYTES) {
      throw new BadRequestException("La imagen no puede superar 5 MB.");
    }
    return file;
  }
}
