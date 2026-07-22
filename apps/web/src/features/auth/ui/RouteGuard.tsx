"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Rol } from "@repo/types";

import { useSessionStore } from "@/entities/session";

import { useValidateSession } from "../api/use-validate-session";

interface RouteGuardProps {
  allowedRoles: Rol[];
  loginPath: string;
  children: React.ReactNode;
}

function dashboardPathFor(rol: Rol): string {
  return rol === "ADMIN" ? "/admin" : "/collector";
}

// Protege un route-group completo por rol, leyendo el store de sesión y
// validándolo contra el backend (useValidateSession). Se monta en el layout
// del grupo, así que también envuelve su propia pantalla de login — por eso
// compara el pathname contra `loginPath`: ahí no bloquea (y si ya hay sesión
// con el rol correcto, redirige al panel en vez de mostrar el login de nuevo).
export function RouteGuard({ allowedRoles, loginPath, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const usuario = useSessionStore((state) => state.usuario);

  const isOnLoginPath = pathname === loginPath;
  const hasAllowedRole = !!usuario && allowedRoles.includes(usuario.rol);

  // Valida el token guardado contra el backend (GET /auth/me) una vez
  // hidratado, solo en páginas protegidas (no en el login, donde no hay
  // nada que rehidratar todavía).
  useValidateSession(hasHydrated && isAuthenticated && !isOnLoginPath);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isOnLoginPath) {
      // Cualquier sesión activa (sea cual sea su rol) se manda a su propio
      // panel — no tiene sentido mostrarle un login ajeno a quien ya entró.
      if (isAuthenticated && usuario) {
        router.replace(dashboardPathFor(usuario.rol));
      }
      return;
    }

    if (!isAuthenticated) {
      router.replace(loginPath);
      return;
    }

    if (!hasAllowedRole && usuario) {
      // Rol equivocado para esta superficie: bloquea, redirige a su propia área.
      router.replace(dashboardPathFor(usuario.rol));
    }
  }, [hasHydrated, isOnLoginPath, isAuthenticated, hasAllowedRole, usuario, router, loginPath]);

  // Antes de hidratar no se puede saber si hay sesión — no renderizar nada
  // evita un parpadeo (mostrar login o dashboard) que luego se corrige solo.
  if (!hasHydrated) return null;

  if (isOnLoginPath) {
    return isAuthenticated ? null : <>{children}</>;
  }

  if (!isAuthenticated || !hasAllowedRole) return null;

  return <>{children}</>;
}
