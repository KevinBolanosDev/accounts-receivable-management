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

// DESIGN_SYSTEM.md §3.5 — actualización optimista del cobro.
// 1. `onMutate`: baja el saldo al instante en `rutaHoy` con el delta del monto.
// 2. `onError`: revierte el cache al snapshot capturado por `onMutate`.
// 3. `onSuccess`: reconcilia con el `CobroResponse` real del server.
// 4. `onSettled`: invalida `rutaHoy`, `creditos` y `clientes` para que el
//    Admin (ruta/detalle de cliente) y el Cobrador vean la nueva realidad.
//    La decisión sobre Realtime vs. polling (PLAN_DESARROLLO.md §7) queda
//    en refetch/invalidación; Supabase Realtime es una mejora opcional
//    multi-dispositivo que se documenta en `FASE_3_SUBFASES.md §3.10`.
export function useRegistrarCobro() {
  const queryClient = useQueryClient();
  return useMutation<CobroResponse, Error, CreateCobroRequest, { previous: RutaHoyItem[] | undefined }>({
    mutationFn: (body) => cobrosService.registrarCobro(body),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: cobrosKeys.rutaHoy() });
      const previous = queryClient.getQueryData<RutaHoyItem[]>(cobrosKeys.rutaHoy());

      if (previous) {
        const next = previous.map((cliente) => {
          if (!cliente.creditos.some((c) => c.id === variables.creditoId)) return cliente;
          const creditos = cliente.creditos.map((c) =>
            c.id === variables.creditoId
              ? {
                  ...c,
                  saldoPendiente: Math.max(0, c.saldoPendiente - variables.monto),
                  totalPagado: c.totalPagado + variables.monto,
                }
              : c,
          );
          const nuevoSaldo = creditos.reduce((sum, c) => sum + c.saldoPendiente, 0);
          return {
            ...cliente,
            saldoPendiente: nuevoSaldo,
            creditos,
          };
        });
        queryClient.setQueryData<RutaHoyItem[]>(cobrosKeys.rutaHoy(), next);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cobrosKeys.rutaHoy(), context.previous);
      }
    },
    onSuccess: (response) => {
      const previous = queryClient.getQueryData<RutaHoyItem[]>(cobrosKeys.rutaHoy());
      if (previous) {
        const next = previous.map((cliente) => {
          if (!cliente.creditos.some((c) => c.id === response.credito.id)) return cliente;
          return {
            ...cliente,
            creditos: cliente.creditos.map((c) =>
              c.id === response.credito.id ? { ...c, ...response.credito } : c,
            ),
          };
        });
        queryClient.setQueryData<RutaHoyItem[]>(cobrosKeys.rutaHoy(), next);
      }
    },
    onSettled: (_data, _err, _vars) => {
      queryClient.invalidateQueries({ queryKey: cobrosKeys.rutaHoy() });
      // Invalida también las queries de créditos y clientes para que el Admin
      // (ruta y detalle #5c) y el detalle #10a reflejen el saldo nuevo tras
      // el cobro.
      queryClient.invalidateQueries({ queryKey: ["creditos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
