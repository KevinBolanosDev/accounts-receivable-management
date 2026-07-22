import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LoginResponse, Usuario } from "@repo/types";

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  isAuthenticated: boolean;
  setSession: (session: LoginResponse) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      isAuthenticated: false,
      setSession: ({ token, usuario }) => set({ token, usuario, isAuthenticated: true }),
      clearSession: () => set({ token: null, usuario: null, isAuthenticated: false }),
    }),
    {
      name: "session-storage",
    },
  ),
);
