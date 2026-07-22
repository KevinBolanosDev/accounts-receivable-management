import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

// Pipe genérico para validar el body de un endpoint contra un schema de
// @repo/types — el mismo esquema que valida en el frontend, sin duplicarlo.
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }

    return result.data;
  }
}
