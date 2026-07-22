import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LoginResponse, Usuario } from "@repo/types";

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  isAuthenticated: boolean;
  // `false` hasta que zustand termina de leer localStorage en el cliente
  // (en SSR/primer render no hay localStorage). Sin esto, un RouteGuard que
  // decide antes de tiempo puede rebotar a un usuario ya autenticado.
  hasHydrated: boolean;
  setSession: (session: LoginResponse) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      isAuthenticated: false,
      hasHydrated: false,
      setSession: ({ token, usuario }) => set({ token, usuario, isAuthenticated: true }),
      clearSession: () => set({ token: null, usuario: null, isAuthenticated: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "session-storage",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
