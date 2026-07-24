import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClientAuthUser } from "@repo/types";

// Sesión del CLIENTE final (NO del staff). El cliente es un principal del JWT
// distinto (`rol: "CLIENTE"`) y nunca ve Admin/Cobrador UI. Por eso vive en
// un store separado del staff (`useSessionStore` en `entities/session`) —
// compartir store complicaría el `ClientGuard` y mezclaría tipos incompatibles.
//
// Estructura idéntica a `useSessionStore`: persist localStorage + flag
// `hasHydrated` para que `ClientGuard` no redirija antes de que termine la
// rehidratación (mismo bug que el guard del staff evitar — ver `RouteGuard`).
interface ClientSessionState {
  token: string | null;
  cliente: ClientAuthUser | null;
  hasHydrated: boolean;
  setSession: (s: { token: string; cliente: ClientAuthUser }) => void;
  // Actualiza solo el perfil del cliente. Usado por `useClientChangePassword`
  // tras un cambio de contraseña exitoso: el backend devuelve el cliente
  // actualizado y queremos reflejar `mustChangePassword=false` sin re-loggear.
  updateCliente: (c: ClientAuthUser) => void;
  clearSession: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useClientSessionStore = create<ClientSessionState>()(
  persist(
    (set) => ({
      token: null,
      cliente: null,
      hasHydrated: false,
      setSession: ({ token, cliente }) =>
        set({ token, cliente, hasHydrated: true }),
      updateCliente: (cliente) => set({ cliente }),
      clearSession: () =>
        set({ token: null, cliente: null, hasHydrated: true }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      // Clave separada de la del staff (`session-storage`) para que coexistir
      // sesiones en el mismo navegador (cliente en una pestaña, admin en otra)
      // no rompa el state global.
      name: "client-session",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);