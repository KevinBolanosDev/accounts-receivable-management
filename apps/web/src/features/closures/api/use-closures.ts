"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DailyClosure, DailyClosureListQuery } from "@repo/types";

import { downloadBlob } from "@/shared/lib/download-blob";

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
      // Cross-feature (claves crudas, no un import de `routes-collectors`/
      // `dashboard` — misma convención que `use-cobros.ts`): cerrar la ruta
      // cambia su `estadoDia` (rutas) y las métricas agregadas (dashboard).
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Descarga el PDF del cierre (Fase 5.8/5.10): fetch autenticado → Blob → guardar
// como archivo. No es un `<a href>` directo porque la ruta exige JWT.
export function useDownloadClosurePdf() {
  return useMutation<void, Error, { id: string; filename: string }>({
    mutationFn: async ({ id, filename }) => {
      const blob = await closuresService.getPdfBlob(id);
      downloadBlob(blob, filename);
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
