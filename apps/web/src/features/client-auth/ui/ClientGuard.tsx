"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useClientSessionStore } from "@/entities/session";

import { useClientMe } from "../api/use-client-auth";

interface ClientGuardProps {
  children: React.ReactNode;
}

const LOGIN_PATH = "/client/login";
const CHANGE_PASSWORD_PATH = "/client/change-password";
const CREDIT_PATH = "/client/credit";

// Protege el route-group `(client)` por estado de sesión:
// - sin sesión → /client/login
// - con sesión y `mustChangePassword=true` → /client/change-password (bloquea
//   el resto hasta que cambie la temporal)
// - con sesión válida → render children
//
// `useClientMe` valida el token contra el backend en cada navegación dentro
// del portal: si el backend lo rechaza, limpiamos el store y el guard
// redirige. El `hasHydrated` evita el flash inicial (mismo patrón que
// `RouteGuard` del staff).
export function ClientGuard({ children }: ClientGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const hasHydrated = useClientSessionStore((state) => state.hasHydrated);
  const isAuthenticated = useClientSessionStore(
    (state) => state.token !== null && state.cliente !== null,
  );
  const mustChangePassword = useClientSessionStore(
    (state) => state.cliente?.mustChangePassword ?? false,
  );

  const isOnLoginPath = pathname === LOGIN_PATH;
  const isOnChangePasswordPath = pathname === CHANGE_PASSWORD_PATH;

  // Valida el token contra el backend cuando hay sesión. NO en login
  // (no hay nada que rehidratar) ni en change-password (estamos justo
  // cambiándola — el token es válido por construcción).
  useClientMe(hasHydrated && isAuthenticated && !isOnLoginPath && !isOnChangePasswordPath);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isOnLoginPath) {
      // Si ya hay sesión válida, mandamos al portal — no tiene sentido
      // mostrarle el login a quien ya entró.
      if (isAuthenticated && !mustChangePassword) {
        router.replace(CREDIT_PATH);
      }
      return;
    }

    if (isOnChangePasswordPath) {
      // Si no hay sesión, no puede cambiar la contraseña.
      if (!isAuthenticated) {
        router.replace(LOGIN_PATH);
        return;
      }
      // Si ya cambió la contraseña, redirigir al portal.
      if (!mustChangePassword) {
        router.replace(CREDIT_PATH);
      }
      return;
    }

    // Resto del portal.
    if (!isAuthenticated) {
      router.replace(LOGIN_PATH);
      return;
    }
    if (mustChangePassword) {
      router.replace(CHANGE_PASSWORD_PATH);
    }
  }, [
    hasHydrated,
    isAuthenticated,
    mustChangePassword,
    isOnLoginPath,
    isOnChangePasswordPath,
    router,
  ]);

  // Antes de hidratar no sabemos si hay sesión — no renderizar evita un
  // parpadeo entre login y portal que luego se autocorrige.
  if (!hasHydrated) return null;

  if (isOnLoginPath) {
    return isAuthenticated && !mustChangePassword ? null : <>{children}</>;
  }

  if (!isAuthenticated) return null;
  if (mustChangePassword && !isOnChangePasswordPath) return null;

  return <>{children}</>;
}