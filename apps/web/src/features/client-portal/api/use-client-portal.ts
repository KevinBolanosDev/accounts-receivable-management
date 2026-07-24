"use client";

import { useQuery } from "@tanstack/react-query";

import { clientCreditService, type ClientCreditSummary } from "./client-credit-service";
import type { CreditoListItem, Pago } from "@repo/types";

// Fase 4 — query keys jerárquicas del portal del cliente. El prefijo
// `client-portal` las aísla de las queries de staff (`creditos`, `clientes`,
// `rutas`) que invalidan desde `useRegistrarCobro`.
export const clientPortalKeys = {
  all: ["client-portal"] as const,
  credits: () => [...clientPortalKeys.all, "credits"] as const,
  payments: (creditoId?: string) =>
    [...clientPortalKeys.all, "payments", creditoId ?? null] as const,
  summary: () => [...clientPortalKeys.all, "summary"] as const,
};

export function useMyCredits() {
  return useQuery<CreditoListItem[]>({
    queryKey: clientPortalKeys.credits(),
    queryFn: () => clientCreditService.getMyCredits(),
  });
}

export function useMyPayments(creditoId?: string) {
  return useQuery<Pago[]>({
    queryKey: clientPortalKeys.payments(creditoId),
    queryFn: () => clientCreditService.getMyPayments(creditoId),
  });
}

export function useMySummary() {
  return useQuery<ClientCreditSummary>({
    queryKey: clientPortalKeys.summary(),
    queryFn: () => clientCreditService.getSummary(),
  });
}