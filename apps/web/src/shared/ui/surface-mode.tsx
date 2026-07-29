"use client";

import { useEffect } from "react";

// Propaga el modo de superficie al <html> (DESIGN_SYSTEM.md §0).
//
// El route-group ya pone `className="dark"` en su div, lo que resuelve el
// SSR sin FOUC, pero NO alcanza para los overlays: Radix portaliza Sheet,
// Dialog, DropdownMenu, Select, Tooltip y Toaster a `document.body`, que es
// hermano de ese div y por tanto lee los tokens de `:root` — los claros. En
// la superficie oscura del Admin eso pintaba cada menú y cada diálogo en
// blanco sobre negro.
//
// La clase se limpia al desmontar: al salir del Admin hacia el Cobrador o el
// Cliente (ambos claros), `<html>` no puede quedarse en oscuro.
export function SurfaceMode({ mode }: { mode: "dark" | "light" }) {
  useEffect(() => {
    if (mode !== "dark") return;

    const root = document.documentElement;
    root.classList.add("dark");
    return () => root.classList.remove("dark");
  }, [mode]);

  return null;
}
