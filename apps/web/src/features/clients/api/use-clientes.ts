"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientesQuery,
  CreateClienteRequest,
  UpdateClienteRequest,
} from "@repo/types";

import { clientesService } from "./clientes-service";

const clientesKeys = {
  all: ["clientes"] as const,
  list: (query?: ClientesQuery) => ["clientes", "list", query ?? {}] as const,
  summary: ["clientes", "summary"] as const,
  detail: (id: string) => ["clientes", id] as const,
};

export function useClientes(query?: ClientesQuery) {
  return useQuery({
    queryKey: clientesKeys.list(query),
    queryFn: () => clientesService.listClientes(query),
  });
}

export function useClientesSummary() {
  return useQuery({
    queryKey: clientesKeys.summary,
    queryFn: () => clientesService.getClientesSummary(),
  });
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: clientesKeys.detail(id),
    queryFn: () => clientesService.getCliente(id),
    enabled: !!id,
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClienteRequest) => clientesService.createCliente(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientesKeys.all }),
  });
}

export function useUpdateCliente(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClienteRequest) => clientesService.updateCliente(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientesKeys.all }),
  });
}

export function useDeleteCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientesService.deleteCliente(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: clientesKeys.all });
      // El detalle del cliente borrado se descarta en vez de invalidarse: si
      // solo se invalida, sigue en caché y vuelve a pedirse (404) en cuanto la
      // pestaña recupera el foco.
      queryClient.removeQueries({ queryKey: clientesKeys.detail(id) });
      // Cross-feature: la ruta muestra `clientesCount`, que acaba de cambiar.
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
    },
  });
}

export function useUploadFotoDocumento() {
  return useMutation({
    mutationFn: (file: File) => clientesService.uploadFotoDocumento(file),
  });
}

// Mismo patrón que `useDeleteCliente`: el `id` viaja en `mutate(id)`, no al
// invocar el hook — así sirve tanto al detalle (id ya conocido) como al alta
// (id recién creado, ver `FieldClientCreateScreen`).
export function useGenerateClientAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientesService.generateAccess(id),
    onSuccess: (_data, id) => queryClient.invalidateQueries({ queryKey: clientesKeys.detail(id) }),
  });
}

export function useDeleteClientAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientesService.deleteAccess(id),
    onSuccess: (_data, id) => queryClient.invalidateQueries({ queryKey: clientesKeys.detail(id) }),
  });
}
