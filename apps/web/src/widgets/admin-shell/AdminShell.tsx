"use client";

import { useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

import { AdminSidebar } from "./AdminSidebar";
import { AdminShellContext } from "./shell-context";

// DESIGN_SYSTEM.md §2.6 — contenedor de navegación del portal Admin: sidebar
// fija a la izquierda (escritorio) y Sheet lateral (móvil). El header de cada
// vista lo pone la propia pantalla con <AdminPageHeader>. Envuelve las vistas
// autenticadas del route-group `(shell)`; el login queda fuera.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AdminShellContext.Provider value={{ openMobileNav: () => setMobileOpen(true) }}>
      <div className="flex min-h-screen bg-background text-foreground lg:h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
          <AdminSidebar />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">{children}</main>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </AdminShellContext.Provider>
  );
}
