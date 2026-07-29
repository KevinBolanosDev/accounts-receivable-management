"use client";

import { useState } from "react";

import { AdminBottomNav } from "./AdminBottomNav";
import { AdminMoreSheet } from "./AdminMoreSheet";
import { AdminSidebar } from "./AdminSidebar";
import { AdminShellContext } from "./shell-context";

// DESIGN_SYSTEM.md §2.6 — contenedor de navegación del portal Admin. Las dos
// superficies son composiciones distintas, no una adaptación de la otra:
//
//   ≥ lg  sidebar fija a la izquierda (`AdminSidebar`)
//   < lg  bottom tab bar (`AdminBottomNav`) + sheet "Más" (`AdminMoreSheet`)
//
// El sidebar NO se reutiliza en móvil: traía la marca, los ítems primarios
// duplicados con las pestañas y su propio pie de usuario. El header de cada
// vista lo pone la propia pantalla con <AdminPageHeader>. Envuelve las vistas
// autenticadas del route-group `(shell)`; el login queda fuera.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <AdminShellContext.Provider value={{ openMoreNav: () => setMoreOpen(true) }}>
      <div className="flex min-h-screen bg-background text-foreground lg:h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
          <AdminSidebar />
        </aside>

        {/* `overflow-x-clip` y NO `overflow-x-hidden`: con `overflow-y` visible,
            `hidden` computa a `auto` y crea un contenedor de scroll que rompe
            el `sticky` del AdminPageHeader. `clip` contiene el desborde sin
            crear ese contenedor. Es una red de seguridad — el ancho de cada
            pantalla debe arreglarse en la pantalla, porque acá se RECORTA:
            lo que se desborde se ve cortado, no scrollea.

            El `pb` reserva la altura de la bottom tab bar fija (4rem más el
            inset de gestos de iOS), que si no taparía el final de la vista. */}
        <main className="flex min-w-0 flex-1 flex-col overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))] lg:overflow-y-auto lg:pb-0">
          {children}
        </main>

        <AdminBottomNav />
        <AdminMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      </div>
    </AdminShellContext.Provider>
  );
}
