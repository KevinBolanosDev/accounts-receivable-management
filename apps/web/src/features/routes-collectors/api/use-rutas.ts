"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRutaRequest, UpdateRutaRequest } from "@repo/types";

import { rutasService } from "./rutas-service";

const rutasKeys = {
  all: ["rutas"] as const,
  summary: ["rutas", "summary"] as const,
  detail: (id: string) => ["rutas", id] as const,
};

export function useRutas() {
  return useQuery({ queryKey: rutasKeys.all, queryFn: () => rutasService.listRutas() });
}

export function useRutasSummary() {
  return useQuery({ queryKey: rutasKeys.summary, queryFn: () => rutasService.getRutasSummary() });
}

export function useRuta(id: string) {
  return useQuery({
    queryKey: rutasKeys.detail(id),
    queryFn: () => rutasService.getRuta(id),
    enabled: !!id,
  });
}

export function useCreateRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRutaRequest) => rutasService.createRuta(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rutasKeys.all }),
  });
}

export function useUpdateRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRutaRequest) => rutasService.updateRuta(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rutasKeys.all });
      queryClient.invalidateQueries({ queryKey: rutasKeys.detail(id) });
    },
  });
}

export function useDeleteRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rutasService.deleteRuta(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rutasKeys.all }),
  });
}

// Asignar/quitar clientes de una ruta (pantalla de Ruta, §3 — cierre de Fase
// 3). Ambas mutaciones devuelven el `RutaDetail` ya refrescado — lo
// escribimos directo en la cache de `useRuta(id)` para no pedir un segundo
// round-trip — e invalidan `["clientes"]` porque cambia el `rutaId` de cada
// cliente afectado (lo ven `ClientFormScreen`/`ClientsListScreen`).
export function useAssignClientesToRuta(rutaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clienteIds: string[]) => rutasService.assignClientes(rutaId, clienteIds),
    onSuccess: (ruta) => {
      queryClient.setQueryData(rutasKeys.detail(rutaId), ruta);
      queryClient.invalidateQueries({ queryKey: rutasKeys.all });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useUnassignClienteFromRuta(rutaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clienteId: string) => rutasService.unassignCliente(rutaId, clienteId),
    onSuccess: (ruta) => {
      queryClient.setQueryData(rutasKeys.detail(rutaId), ruta);
      queryClient.invalidateQueries({ queryKey: rutasKeys.all });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
