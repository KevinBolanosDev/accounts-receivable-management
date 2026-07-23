"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CobroResponse, CreateCobroRequest } from "@repo/types";

import { cobrosService, type RutaHoyItem } from "./cobros-service";

const cobrosKeys = {
  rutaHoy: () => ["cobros", "ruta-hoy"] as const,
};

export function useRutaHoy() {
  return useQuery<RutaHoyItem[]>({
    queryKey: cobrosKeys.rutaHoy(),
    queryFn: () => cobrosService.getRutaHoy(),
  });
}

export function useRegistrarCobro() {
  const queryClient = useQueryClient();
  return useMutation<CobroResponse, Error, CreateCobroRequest, { previous: RutaHoyItem[] | undefined }>({
    mutationFn: (body) => cobrosService.registrarCobro(body),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: cobrosKeys.rutaHoy() });
      const previous = queryClient.getQueryData<RutaHoyItem[]>(cobrosKeys.rutaHoy());
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cobrosKeys.rutaHoy(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cobrosKeys.rutaHoy() });
    },
  });
}
