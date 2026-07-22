"use client";

import { useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

// DESIGN_SYSTEM.md §2.6 — contenedor de navegación del portal Admin: sidebar
// fija a la izquierda (escritorio), Sheet lateral (móvil) y topbar. Envuelve
// las vistas autenticadas del route-group `(shell)`; el login queda fuera.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground lg:h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <AdminSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:overflow-y-auto">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <AdminSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
