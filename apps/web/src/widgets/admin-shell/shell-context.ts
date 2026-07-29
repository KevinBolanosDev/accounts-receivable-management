"use client";

import { createContext, useContext } from "react";

interface AdminShellContextValue {
  /** Abre el sheet "Más" (segundo nivel de la navegación móvil). */
  openMoreNav: () => void;
}

export const AdminShellContext = createContext<AdminShellContextValue>({
  openMoreNav: () => {},
});

export function useAdminShell() {
  return useContext(AdminShellContext);
}
