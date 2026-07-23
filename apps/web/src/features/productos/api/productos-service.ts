import { useSessionStore } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";
import {
  productoSchema,
  type CreateProductoRequest,
  type Producto,
  type UpdateProductoRequest,
} from "@repo/types";

export interface ProductosService {
  listProductos(): Promise<Producto[]>;
  createProducto(body: CreateProductoRequest): Promise<Producto>;
  updateProducto(id: string, body: UpdateProductoRequest): Promise<Producto>;
}

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

// Catálogo demo (alimenta el Select del alta de crédito, 9c). Coherente con
// los productos sembrados en la Fase 3.6.
const MOCK_PRODUCTOS: Producto[] = [
  { id: "prod-nevera", nombre: "Nevera", precioBase: 1_800_000 },
  { id: "prod-tv", nombre: "Televisor", precioBase: 1_200_000 },
  { id: "prod-estufa", nombre: "Estufa", precioBase: 950_000 },
  { id: "prod-lavadora", nombre: "Lavadora", precioBase: 1_450_000 },
  { id: "prod-licuadora", nombre: "Licuadora", precioBase: 380_000 },
];

export const mockProductosService: ProductosService = {
  async listProductos() {
    await delay();
    return MOCK_PRODUCTOS.map((p) => productoSchema.parse(p));
  },
  async createProducto(body) {
    await delay();
    return productoSchema.parse({
      id: `prod-${Math.random().toString(36).slice(2, 8)}`,
      nombre: body.nombre,
      precioBase: body.precioBase,
    });
  },
  async updateProducto(id, body) {
    await delay();
    const current = MOCK_PRODUCTOS.find((p) => p.id === id) ?? MOCK_PRODUCTOS[0]!;
    return productoSchema.parse({
      id,
      nombre: body.nombre ?? current.nombre,
      precioBase: body.precioBase ?? current.precioBase,
    });
  },
};

export const httpProductosService: ProductosService = {
  listProductos() {
    return apiFetch("/productos", productoSchema.array(), {
      token: useSessionStore.getState().token,
    });
  },
  createProducto(body) {
    return apiFetch("/productos", productoSchema, {
      method: "POST",
      body,
      token: useSessionStore.getState().token,
    });
  },
  updateProducto(id, body) {
    return apiFetch(`/productos/${id}`, productoSchema, {
      method: "PATCH",
      body,
      token: useSessionStore.getState().token,
    });
  },
};

// Bloque A (Fase 3.2) — mock. El swap a http se hace en 3.10 en un solo punto.
// Bloque C (Fase 3.10) — se activa `httpProductosService` para hablar con el
// backend real de `apps/api`. Los hooks de TanStack Query ya apuntan a este
// `productosService`, así que el cambio es **un solo punto** por feature.
export const productosService: ProductosService = httpProductosService;
