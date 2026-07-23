"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProductoRequest,
  Producto,
  UpdateProductoRequest,
} from "@repo/types";

import { productosService } from "./productos-service";

const productosKeys = {
  all: ["productos"] as const,
  list: () => ["productos", "list"] as const,
};

export function useProductos() {
  return useQuery<Producto[]>({
    queryKey: productosKeys.list(),
    queryFn: () => productosService.listProductos(),
  });
}

export function useCreateProducto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductoRequest) => productosService.createProducto(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productosKeys.all }),
  });
}

export function useUpdateProducto(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProductoRequest) => productosService.updateProducto(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productosKeys.all }),
  });
}
