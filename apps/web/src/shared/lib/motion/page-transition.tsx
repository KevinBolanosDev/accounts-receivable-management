"use client";

import { useRef } from "react";

import { gsap, useGSAP } from "./gsap";
import { useReducedMotion } from "./reduced-motion";
import { MOTION } from "./tokens";

// DESIGN_SYSTEM.md §1.8 — "Transición de ruta: fade/slide corto entre vistas
// (token `base`)". Se monta desde un `template.tsx`: a diferencia de
// `layout.tsx`, Next re-monta el `template` en cada navegación, que es
// justamente lo que hace posible animar la entrada.
//
// Va en el `template.tsx` de DENTRO del route-group `(shell)`, no en el de
// afuera: así el shell (sidebar, tab bar, header) permanece montado y solo
// entra el contenido de la vista. Si envolviera al shell, la barra de
// navegación parpadearía en cada click, que es lo contrario de dar
// continuidad.
//
// GOTCHA (por eso no usa `useReveal` directamente): `gsap.from` deja el
// `transform` inline puesto al terminar, y **un ancestro con `transform`
// deja de ser el viewport para sus descendientes `position: fixed`** — pasan
// a posicionarse contra ese ancestro. Tres pantallas del Admin
// (`ClientsListScreen`, `CollectorsScreen`, `RoutesListScreen`) montan su FAB
// móvil con `className="fixed right-4 ..."` DENTRO del contenido de la página,
// así que sin `clearProps` el botón dejaría de estar fijo y scrollearía con la
// lista. `clearProps` borra las propiedades al terminar y el wrapper vuelve a
// ser transparente para el layout.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (!ref.current) return;
      const { duration, ease } = MOTION.base;

      gsap.from(ref.current, {
        autoAlpha: 0,
        y: reduced ? 0 : 8,
        duration: reduced ? 0 : duration,
        ease,
        clearProps: "transform,visibility,opacity",
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
