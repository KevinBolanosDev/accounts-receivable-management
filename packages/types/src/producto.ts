import { z } from "zod";

export const productoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  precioBase: z.number(),
});
export type Producto = z.infer<typeof productoSchema>;

export const createProductoRequestSchema = z.object({
  nombre: z.string().min(1, "El nombre del producto es obligatorio."),
  precioBase: z.number().nonnegative("El precio base no puede ser negativo."),
});
export type CreateProductoRequest = z.infer<typeof createProductoRequestSchema>;

export const updateProductoRequestSchema = z.object({
  nombre: z.string().min(1).optional(),
  precioBase: z.number().nonnegative().optional(),
  activo: z.boolean().optional(),
});
export type UpdateProductoRequest = z.infer<typeof updateProductoRequestSchema>;
