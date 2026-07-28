"use client";

import { useQuery } from "@tanstack/react-query";
import type { ClientCreditDetail, ClientCreditListItem, ClientCreditSummary } from "@repo/types";

import { clientCreditService } from "./client-credit-service";

// Fase 4 — query keys jerárquicas del portal del cliente. El prefijo
// `client-portal` las aísla de las queries de staff (`creditos`, `clientes`,
// `rutas`) que invalidan desde `useRegistrarCobro`.
export const clientPortalKeys = {
  all: ["client-portal"] as const,
  credits: () => [...clientPortalKeys.all, "credits"] as const,
  detail: (id: string) => [...clientPortalKeys.all, "credits", id] as const,
  summary: () => [...clientPortalKeys.all, "summary"] as const,
};

export function useMyCredits() {
  return useQuery<ClientCreditListItem[]>({
    queryKey: clientPortalKeys.credits(),
    queryFn: () => clientCreditService.getMyCredits(),
  });
}

export function useMyCreditDetail(id: string) {
  return useQuery<ClientCreditDetail>({
    queryKey: clientPortalKeys.detail(id),
    queryFn: () => clientCreditService.getCreditDetail(id),
    enabled: !!id,
  });
}

export function useMySummary() {
  return useQuery<ClientCreditSummary>({
    queryKey: clientPortalKeys.summary(),
    queryFn: () => clientCreditService.getSummary(),
  });
}
