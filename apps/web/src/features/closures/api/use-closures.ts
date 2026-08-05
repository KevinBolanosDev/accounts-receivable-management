"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DailyClosure, DailyClosureListQuery } from "@repo/types";

import { closuresService } from "./closures-service";

export const closuresKeys = {
  all: ["closures"] as const,
  preview: (routeId: string) => [...closuresKeys.all, "preview", routeId] as const,
  list: (query?: DailyClosureListQuery) => [...closuresKeys.all, "list", query] as const,
  detail: (id: string) => [...closuresKeys.all, "detail", id] as const,
};

export function useClosurePreview(routeId: string) {
  return useQuery({
    queryKey: closuresKeys.preview(routeId),
    queryFn: () => closuresService.getPreview(routeId),
    enabled: !!routeId,
  });
}

export function useCloseRoute(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation<DailyClosure, Error, void>({
    mutationFn: () => closuresService.close(routeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: closuresKeys.all });
      // Cross-feature: cerrar la ruta cambia su `estadoDia` (Fase 5.9/5.10).
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
    },
  });
}

export function useClosuresList(query?: DailyClosureListQuery) {
  return useQuery({
    queryKey: closuresKeys.list(query),
    queryFn: () => closuresService.list(query),
  });
}

export function useClosureDetail(id: string) {
  return useQuery({
    queryKey: closuresKeys.detail(id),
    queryFn: () => closuresService.getById(id),
    enabled: !!id,
  });
}
