"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { applyTheme, resolveSurface, resolveTheme } from "./theme";
import { useSystemTheme, useThemePreference } from "./theme-store";

/**
 * Mantiene `<html>` en el modo correcto DESPUÉS de la carga inicial. El
 * script inline (`ThemeScript`) resuelve el primer paint; este componente
 * cubre los tres casos que el script no puede ver porque ya no corre:
 *
 * 1. Navegación soft entre superficies (`/admin/...` → `/collector/...`).
 * 2. El usuario cambia el tema del sistema operativo con la app abierta y su
 *    preferencia es `"system"`.
 * 3. Otra pestaña cambió la preferencia (evento `storage`).
 *
 * El cambio disparado por el propio selector NO pasa por acá: lo aplica
 * `useTheme().setPreference` dentro de la View Transition. `applyTheme` es
 * idempotente, así que este efecto queda en no-op.
 */
export function ThemeSync() {
  const pathname = usePathname();
  const surface = resolveSurface(pathname);
  const preference = useThemePreference(surface);
  const system = useSystemTheme();

  useEffect(() => {
    applyTheme(resolveTheme(surface, preference, system));
  }, [surface, preference, system]);

  return null;
}
