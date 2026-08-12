"use client";

import { useSessionStore } from "@/entities/session";
import { getInitials } from "@/shared/lib/initials";
import { DataField, DataFieldList } from "@/shared/ui/data-field";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { LogoutButton } from "./LogoutButton";

// Pestaña "Perfil" del cobrador. Era un placeholder con un `<h1>`, una línea
// de "llega en fases posteriores" y el botón de salir; ahora es la pantalla de
// cuenta real: identidad, datos de contacto y apariencia.
//
// Es el hogar del selector de modo en esta superficie: el cobrador ya viene
// acá a cerrar sesión, y "Perfil → Apariencia" es donde cualquier app móvil
// pone esto. El hero no lo lleva porque compite con la acción de la pantalla.
export function CollectorProfileScreen() {
  const usuario = useSessionStore((state) => state.usuario);

  const nombre = usuario?.nombre ?? "Cobrador";

  return (
    <div className="flex flex-col pb-6">
      <CollectorHero
        title={nombre}
        subtitle="Cobrador"
        overlap={false}
        avatar={
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold ring-1 ring-white/40">
            {getInitials(nombre)}
          </span>
        }
      />

      <div className="flex flex-col gap-6 px-4 pt-5">
        <section className="flex flex-col gap-2">
          <h2 className="text-caption text-muted-foreground uppercase">Tu cuenta</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            {/* `Usuario` (@repo/types) solo trae id/nombre/documento/rol: el
                perfil no pide un endpoint nuevo, muestra lo que ya viaja en
                el JWT. Teléfono y demás datos del cobrador viven en el panel
                del Admin, que es quien los edita. */}
            <DataFieldList>
              <DataField label="Documento" value={usuario?.documento} />
              <DataField label="Rol" value="Cobrador" />
            </DataFieldList>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-caption text-muted-foreground uppercase">Apariencia</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <ThemeToggle size="lg" showHint />
          </div>
        </section>

        <LogoutButton loginPath="/collector/login" />
      </div>
    </div>
  );
}
