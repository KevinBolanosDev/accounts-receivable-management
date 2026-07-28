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

// Panel propio de cada rol. `CLIENTE` está explícito aunque hoy no pueda
// llegar acá (usa `client-session-store`, otro store y otro endpoint de login):
// con un `else` genérico, un cliente terminaría en el panel del cobrador.
const DASHBOARD_POR_ROL: Record<Rol, string> = {
  ADMIN: "/admin",
  COBRADOR: "/collector",
  CLIENTE: "/client/credit",
};

function dashboardPathFor(rol: Rol): string {
  return DASHBOARD_POR_ROL[rol];
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
      // Solo se salta el login quien YA tiene sesión válida PARA ESTA
      // superficie. Si el rol no corresponde (un admin abriendo
      // /collector/login) se le muestra el formulario para que pueda entrar
      // con la cuenta correcta: antes se lo rebotaba a su panel, así que era
      // imposible cambiar de cuenta sin cerrar sesión primero.
      if (isAuthenticated && hasAllowedRole && usuario) {
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
    // Se oculta solo mientras el efecto de arriba redirige a quien ya tiene
    // sesión válida acá; con rol ajeno el formulario se muestra normalmente.
    return isAuthenticated && hasAllowedRole ? null : <>{children}</>;
  }

  if (!isAuthenticated || !hasAllowedRole) return null;

  return <>{children}</>;
}
