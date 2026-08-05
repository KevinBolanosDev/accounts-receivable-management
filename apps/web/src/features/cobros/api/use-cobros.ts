"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AnularPagoResponse, CobroResponse, CreateCobroRequest } from "@repo/types";

import { cobrosService } from "./cobros-service";

// Registrar un cobro es la única mutación propia de esta feature — la lectura
// (rutas del cobrador, detalle de cliente) vive en `routes-collectors`
// (`useRutas`/`useRuta`) y `clients` (`useCliente`), ambos ya reales y scoped
// por cobrador en el backend. No hay actualización optimista propia aquí: el
// backend responde en ~200ms (transacción simple) y tocar el cache de OTRA
// feature a mano duplicaría su forma; en su lugar invalidamos todo lo que
// depende del saldo/estado de un Crédito y dejamos que cada query se
// refetchee con datos reales.
//
// La pantalla que llamó al hook decide si navegar al recibo (típicamente
// `RegistrarCobroSheet` lo hace — ver `RegistrarCobroSheet.tsx`). El recibo
// siempre lo sirve el back (`GET /payments/:pagoId/receipt`, HTML
// server-rendered) — no hay cache local que duplique esa plantilla.
export function useRegistrarCobro() {
  const queryClient = useQueryClient();
  return useMutation<CobroResponse, Error, CreateCobroRequest>({
    mutationFn: (body) => cobrosService.registrarCobro(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
    },
  });
}

// Mismo criterio de invalidación que registrar: el saldo/estado del crédito
// cambió (se devolvió), así que todo lo que depende de eso se refetchea.
export function useAnularPago() {
  const queryClient = useQueryClient();
  return useMutation<AnularPagoResponse, Error, string>({
    mutationFn: (pagoId) => cobrosService.anularPago(pagoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["rutas"] });
    },
  });
}