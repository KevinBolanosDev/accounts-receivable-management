"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  ClientAuthUser,
  ClientLoginRequest,
  ClientLoginResponse,
} from "@repo/types";

import { useClientSessionStore } from "@/entities/session";

import { clientAuthService } from "./client-auth-service";

// Hooks del feature `client-auth` (Fase 4). El patrón es el mismo que el
// resto de features: `useMutation`/`useQuery` + invalidaciones manuales
// cuando aplica. Sin optimistic updates — la mutación de login solo dispara
// una navegación, no toca cache.

// `useClientLogin` solo escribe el store local; NO invalida queries porque
// el portal empieza vacío (no hay `clientPortalKeys` aún en 4.4).
export function useClientLogin() {
  return useMutation<ClientLoginResponse, Error, ClientLoginRequest>({
    mutationFn: (body) => clientAuthService.login(body),
    onSuccess: (response) => {
      useClientSessionStore.getState().setSession({
        token: response.token,
        cliente: response.cliente,
      });
    },
  });
}

// Cambio de contraseña. Tras éxito, actualiza el perfil en el store con la
// versión que devuelve el backend (donde `mustChangePassword=false`); esto
// hace que `ClientGuard` deje de forzar `/client/change-password`.
export function useClientChangePassword() {
  return useMutation<ClientAuthUser, Error, { currentPassword: string; newPassword: string }>({
    mutationFn: ({ currentPassword, newPassword }) => {
      const token = useClientSessionStore.getState().token;
      if (!token) throw new Error("Sesión expirada.");
      return clientAuthService.changePassword({ currentPassword, newPassword }, token);
    },
    onSuccess: (cliente) => {
      useClientSessionStore.getState().updateCliente(cliente);
    },
  });
}

// `useClientMe` — valida el token contra el backend. Se usa en el `ClientGuard`
// cuando ya hay sesión pero queremos confirmar que sigue vigente. Si el
// backend lo rechaza, limpiamos el store (el guard redirige).
export function useClientMe(enabled: boolean) {
  const token = useClientSessionStore((state) => state.token);
  const clearSession = useClientSessionStore((state) => state.clearSession);

  const query = useQuery({
    queryKey: ["client-auth", "me", token],
    queryFn: () => clientAuthService.fetchMe(token as string),
    enabled: enabled && !!token,
    retry: false,
  });

  // Side-effect: si falla la validación, limpiamos.
  // (Sigue el patrón de `useValidateSession` del staff.)
  useEffect(() => {
    if (query.isError) clearSession();
  }, [query.isError, clearSession]);

  return query;
}