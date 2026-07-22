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
  detail: (id: string) => ["clientes", id] as const,
};

export function useClientes(query?: ClientesQuery) {
  return useQuery({
    queryKey: clientesKeys.list(query),
    queryFn: () => clientesService.listClientes(query),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientesKeys.all }),
  });
}

export function useUploadFotoDocumento() {
  return useMutation({
    mutationFn: (file: File) => clientesService.uploadFotoDocumento(file),
  });
}
