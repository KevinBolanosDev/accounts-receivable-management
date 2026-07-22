"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSessionStore } from "@/entities/session";

import { fetchCurrentUser } from "./auth-service";

// Confirma contra el backend (GET /auth/me) que el token guardado sigue
// siendo válido. Si el backend lo rechaza (expiró, es inválido, o el usuario
// ya no existe), limpia la sesión — RouteGuard ya se encarga de redirigir
// al login en cuanto `isAuthenticated` pasa a false.
export function useValidateSession(enabled: boolean): void {
  const token = useSessionStore((state) => state.token);
  const clearSession = useSessionStore((state) => state.clearSession);

  const query = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => fetchCurrentUser(token as string),
    enabled: enabled && !!token,
    retry: false,
  });

  useEffect(() => {
    if (query.isError) clearSession();
  }, [query.isError, clearSession]);
}
