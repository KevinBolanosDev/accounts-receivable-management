"use client";

import { useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useSessionStore, useClientSessionStore } from "@/entities/session";
import { ApiError } from "@/shared/api/client";
import { resolveSurface } from "@/shared/theme";

// Un 401 significa que ESTE token ya no sirve: expiró, el usuario dejó de
// existir, o quedó viejo para la versión actual del backend (ej. los JWT
// pre-multi-tenancy, sin claim `adminId`). Reintentar no lo arregla; solo
// volver a iniciar sesión.
//
// Antes esto no se manejaba en ningún lado: `useValidateSession` solo mira
// GET /auth/me, y ese endpoint no valida el tenant — un token viejo pasaba la
// validación y luego TODAS las demás pantallas fallaban para siempre, sin que
// nada limpiara la sesión ni mandara al login.
function handleAuthError(error: unknown): void {
  if (!(error instanceof ApiError) || error.status !== 401) return;

  // Cuál de las dos sesiones limpiar se decide por la superficie en la que
  // está el usuario, no por el error: staff y cliente pueden convivir en el
  // mismo navegador (claves de localStorage distintas) y un 401 en una no
  // debe cerrar la otra. `resolveSurface` es la misma función que usa el tema
  // — una sola definición de "qué superficie es esta ruta".
  if (resolveSurface(window.location.pathname) === "client") {
    useClientSessionStore.getState().clearSession();
  } else {
    useSessionStore.getState().clearSession();
  }
}

// Los 4xx son deterministas: el mismo request vuelve a fallar igual. Reintentar
// solo multiplica la carga y consume el rate-limit del backend — con el retry
// por defecto (3), un par de pantallas rotas bastaban para convertir un 401 en
// una cascada de 429 que tapaba el error real.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // useState evita recrear el QueryClient en cada render y que se comparta
  // entre requests distintas durante el renderizado en servidor.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleAuthError }),
        mutationCache: new MutationCache({ onError: handleAuthError }),
        defaultOptions: { queries: { retry: shouldRetry } },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
