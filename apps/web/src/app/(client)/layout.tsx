"use client";

import { useClientSessionStore } from "@/entities/session";
import { ChangePasswordDialog, ClientGuard } from "@/features/client-auth";

// Modo claro por defecto para el Portal Cliente (DESIGN_SYSTEM.md §0) —
// público, prioriza lectura instantánea. El `ClientGuard` envuelve TODO el
// route-group: redirige según estado de sesión y `mustChangePassword`.
//
// El `ChangePasswordDialog` se monta aquí (no en cada page) para que el
// modal bloqueante aparezca automáticamente cuando `mustChangePassword=true`,
// sin importar en qué ruta del portal esté el cliente.
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const mustChangePassword = useClientSessionStore(
    (state) => state.cliente?.mustChangePassword ?? false,
  );

  return (
    <div className="bg-background text-foreground min-h-screen">
      <ClientGuard>{children}</ClientGuard>
      <ChangePasswordDialog open={mustChangePassword} blocking={mustChangePassword} />
    </div>
  );
}
