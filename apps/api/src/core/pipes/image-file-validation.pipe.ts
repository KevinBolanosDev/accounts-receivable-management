import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException("La imagen no puede superar 5 MB.");
    }
    return file;
  }
}
