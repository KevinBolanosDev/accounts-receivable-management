"use client";

import { useRouter } from "next/navigation";

import { useSessionStore } from "@/entities/session";
import { Button } from "@/shared/ui/button";

interface LogoutButtonProps {
  loginPath: string;
}

export function LogoutButton({ loginPath }: LogoutButtonProps) {
  const router = useRouter();
  const clearSession = useSessionStore((state) => state.clearSession);

  function handleLogout() {
    clearSession();
    router.push(loginPath);
  }

  return (
    <Button variant="secondary" onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
