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

export function useCreateCredito() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCreditoRequest) => creditosService.createCredito(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditosKeys.all }),
  });
}

export function useUpdateCredito(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCreditoRequest) => creditosService.updateCredito(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditosKeys.all }),
  });
}

export function useAnularCredito() {
  const queryClient = useQueryClient();
  return useMutation<Credito, Error, string>({
    mutationFn: (id: string) => creditosService.anularCredito(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creditosKeys.all }),
  });
}
