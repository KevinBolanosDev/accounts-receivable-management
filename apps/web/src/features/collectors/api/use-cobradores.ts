"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCobradorRequest, UpdateCobradorRequest } from "@repo/types";

import { cobradoresService } from "./cobradores-service";

const cobradoresKeys = {
  all: ["cobradores"] as const,
  summary: ["cobradores", "summary"] as const,
};

export function useCobradores() {
  return useQuery({ queryKey: cobradoresKeys.all, queryFn: () => cobradoresService.listCobradores() });
}

export function useCobradoresSummary() {
  return useQuery({
    queryKey: cobradoresKeys.summary,
    queryFn: () => cobradoresService.getCobradoresSummary(),
  });
}

export function useCreateCobrador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCobradorRequest) => cobradoresService.createCobrador(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.all });
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.summary });
    },
  });
}

export function useUpdateCobrador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCobradorRequest }) =>
      cobradoresService.updateCobrador(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.all });
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.summary });
    },
  });
}

export function useDeleteCobrador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cobradoresService.deleteCobrador(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.all });
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.summary });
      // Cross-feature: sus rutas quedan sin cobrador, y el detalle del cliente
      // muestra `cobradorNombre`.
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useDeleteCobradorPermanent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cobradoresService.deleteCobradorPermanent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.all });
      queryClient.invalidateQueries({ queryKey: cobradoresKeys.summary });
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
