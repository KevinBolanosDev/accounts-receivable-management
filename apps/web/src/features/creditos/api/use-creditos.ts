"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCreditoRequest,
  Credito,
  CreditoDetail,
  CreditoListItem,
  CreditosQuery,
  UpdateCreditoRequest,
} from "@repo/types";

import { creditosService } from "./creditos-service";

const creditosKeys = {
  all: ["creditos"] as const,
  list: (query?: CreditosQuery) => ["creditos", "list", query ?? {}] as const,
  detail: (id: string) => ["creditos", id] as const,
};

export function useCreditos(query?: CreditosQuery) {
  return useQuery<CreditoListItem[]>({
    queryKey: creditosKeys.list(query),
    queryFn: () => creditosService.listCreditos(query),
  });
}

export function useCredito(id: string) {
  return useQuery<CreditoDetail>({
    queryKey: creditosKeys.detail(id),
    queryFn: () => creditosService.getCredito(id),
    enabled: !!id,
  });
}

// `ClienteDetail` EMBEBE los créditos del cliente (`creditosActivos`,
// `creditosHistorial`, `saldoPendiente`, `estado` — los arma el backend en
// `clients.service.ts`). Invalidar solo `["creditos"]` dejaba un detalle de
// cliente ya montado mostrando datos viejos: crear un crédito desde ahí y
// volver no refrescaba nada. Mismo patrón cross-feature que `use-cobros.ts`.
function invalidateCreditoQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: creditosKeys.all });
  queryClient.invalidateQueries({ queryKey: ["clientes"] });
}

export function useCreateCredito() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCreditoRequest) => creditosService.createCredito(body),
    onSuccess: () => invalidateCreditoQueries(queryClient),
  });
}

export function useUpdateCredito(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCreditoRequest) => creditosService.updateCredito(id, body),
    onSuccess: () => invalidateCreditoQueries(queryClient),
  });
}

export function useAnularCredito() {
  const queryClient = useQueryClient();
  return useMutation<Credito, Error, string>({
    mutationFn: (id: string) => creditosService.anularCredito(id),
    // Anular mueve el crédito de "activos" a "historial" y cambia el saldo y
    // el estado del cliente: sin invalidar `["clientes"]` el detalle lo sigue
    // mostrando como activo.
    onSuccess: () => invalidateCreditoQueries(queryClient),
  });
}
