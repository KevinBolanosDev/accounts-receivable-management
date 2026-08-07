// DESIGN_SYSTEM.md §0 — el modo de color es una decisión POR SUPERFICIE, no
// global: el Admin trabaja en oficina (oscuro), el Cobrador en la calle bajo
// sol directo (claro) y el Cliente lee un saldo de un vistazo (claro). Esos
// siguen siendo los defaults; lo que agrega este módulo es que el usuario
// pueda sobrescribirlos en Admin y Cobrador, con su preferencia guardada
// aparte para cada superficie.
//
// Este archivo no toca el DOM ni React: son los tipos, las constantes y las
// funciones puras que consumen el script inline, el provider y el selector.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type Surface = "admin" | "collector" | "client" | "public";

/** Modo por defecto de cada superficie hasta que el usuario elija otro. */
export const SURFACE_DEFAULTS: Record<Surface, ResolvedTheme> = {
  admin: "dark",
  collector: "light",
  client: "light",
  public: "light",
};

/**
 * Superficies con selector. El Portal Cliente queda fijo en claro: es público
 * y de una sola lectura (el saldo), no tiene shell donde colgar el control ni
 * sesión larga que justifique la elección.
 */
export const THEMEABLE_SURFACES: readonly Surface[] = ["admin", "collector"];

export const STORAGE_PREFIX = "theme:";

/** Color de la barra del navegador (`<meta name="theme-color">`) por modo. */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#fafafa", // = --background claro
  dark: "#101014", // = --background oscuro
};

/**
 * Superficie a la que pertenece una ruta. Es la MISMA pregunta que se hace
 * `providers.tsx` para decidir qué sesión limpiar ante un 401 — vive acá una
 * sola vez en vez de repetir `pathname.startsWith("/client")` suelto.
 */
export function resolveSurface(pathname: string): Surface {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/collector" || pathname.startsWith("/collector/")) return "collector";
  if (pathname === "/client" || pathname.startsWith("/client/")) return "client";
  return "public";
}

export function themeStorageKey(surface: Surface): string {
  return `${STORAGE_PREFIX}${surface}`;
}

export function isThemeable(surface: Surface): boolean {
  return THEMEABLE_SURFACES.includes(surface);
}

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Preferencia guardada, o `null` si el usuario nunca eligió (o el storage
 * está bloqueado). `null` NO es lo mismo que `"system"`: sin elección manda
 * el default de la superficie (§0); `"system"` es una elección explícita de
 * seguir al sistema operativo.
 */
export function readPreference(surface: Surface): ThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(themeStorageKey(surface));
    return isPreference(raw) ? raw : null;
  } catch {
    // Modo incógnito o storage bloqueado por política: no es un error, es
    // simplemente "no hay preferencia".
    return null;
  }
}

export function writePreference(surface: Surface, preference: ThemePreference): void {
  try {
    window.localStorage.setItem(themeStorageKey(surface), preference);
  } catch {
    // Idem: la preferencia no sobrevive a la recarga, pero la sesión actual sí.
  }
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Preferencia + superficie → modo real. Mismo algoritmo que el script inline
 * de `theme-script.tsx` (ver el gotcha ahí).
 *
 * `system` se pasa por parámetro para que el hook pueda inyectar el valor al
 * que está suscrito y el modo cambie en vivo cuando el usuario cambia el tema
 * del sistema operativo.
 */
export function resolveTheme(
  surface: Surface,
  preference: ThemePreference | null,
  system: ResolvedTheme = systemTheme(),
): ResolvedTheme {
  // El Portal Cliente no tiene selector: ni la preferencia ni el SO deciden
  // por él. Si el SO mandara, el portal se pondría oscuro para un cliente que
  // solo quiere leer su saldo — justo lo que §0 descarta.
  if (!isThemeable(surface)) return SURFACE_DEFAULTS[surface];
  if (preference === null) return SURFACE_DEFAULTS[surface];
  if (preference === "system") return system;
  return preference;
}

/**
 * Escribe el modo en el DOM. `<html>` es la ÚNICA fuente de verdad: los
 * overlays de Radix (Sheet, Dialog, DropdownMenu, Select, Toaster) se
 * portalizan a `body`, así que una clase puesta en un div de route-group no
 * los alcanza — ese era el bug que parcheaba el viejo `SurfaceMode`.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  if (root.classList.contains("dark") === (resolved === "dark")) return;

  // Sin esto, cada elemento con `transition-colors` interpola a su ritmo y el
  // cambio se ve sucio (el fondo llega antes que el texto). Se libera en el
  // siguiente frame, cuando los colores nuevos ya están pintados.
  root.classList.add("theme-switching");
  root.classList.toggle("dark", resolved === "dark");
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.remove("theme-switching"));
  });

  applyThemeColor(resolved);
}

/**
 * Barra del navegador (Android/PWA). Sin esto queda blanca sobre una app
 * oscura — se nota sobre todo en el Cobrador, que vive en el teléfono.
 */
export function applyThemeColor(resolved: ResolvedTheme): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[resolved];
}
