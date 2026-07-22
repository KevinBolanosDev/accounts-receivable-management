"use client";

import { createContext, useContext } from "react";

interface AdminShellContextValue {
  openMobileNav: () => void;
}

export const AdminShellContext = createContext<AdminShellContextValue>({
  openMobileNav: () => {},
});

export function useAdminShell() {
  return useContext(AdminShellContext);
}
