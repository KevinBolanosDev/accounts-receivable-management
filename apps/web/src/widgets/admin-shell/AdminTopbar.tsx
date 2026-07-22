"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BellIcon, MenuIcon, SearchIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { currentNavLabel } from "./nav-items";

interface AdminTopbarProps {
  onOpenMobileNav: () => void;
}

const emptySubscribe = () => () => {};

// `true` solo tras la hidratación en cliente. Evita calcular la fecha en el
// server (donde el reloj/zona difieren del navegador y provocarían desajuste
// de hidratación) sin usar setState dentro de un efecto.
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

// Fecha de hoy en español, con la primera letra en mayúscula.
function formatToday(): string {
  const formatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function AdminTopbar({ onOpenMobileNav }: AdminTopbarProps) {
  const pathname = usePathname();
  const today = useHydrated() ? formatToday() : "";

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Abrir menú"
        onClick={onOpenMobileNav}
      >
        <MenuIcon />
      </Button>

      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-lg leading-tight font-semibold">{currentNavLabel(pathname)}</h1>
        <p className="truncate text-caption text-muted-foreground" suppressHydrationWarning>
          {today}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="relative hidden w-64 items-center md:flex">
          <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, ruta..." aria-label="Buscar" className="pl-9" />
        </div>
        <Button variant="secondary" size="icon" className="relative" aria-label="Notificaciones">
          <BellIcon />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />
        </Button>
      </div>
    </header>
  );
}
