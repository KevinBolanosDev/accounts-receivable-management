"use client";

import { useSyncExternalStore } from "react";

import {
  readPreference,
  systemTheme,
  writePreference,
  type ResolvedTheme,
  type Surface,
  type ThemePreference,
} from "./theme";

// Dos fuentes externas a React: `localStorage` (la preferencia) y `matchMedia`
// (el tema del sistema). `useSyncExternalStore` es lo correcto acá y no un
// `zustand` con `persist`: `persist` hidrata en un efecto y necesita el flag
// `hasHydrated` — como los dos session stores del proyecto — y eso es
// exactamente el frame de retraso que estamos evitando. Además React llama a
// `getServerSnapshot` durante la hidratación y re-renderiza solo si el valor
// real difiere, sin warning de mismatch.

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * `getSnapshot` tiene que devolver un valor estable entre llamadas o React
 * entra en bucle: se cachea la lectura de `localStorage` y se invalida al
 * escribir o al recibir un evento `storage` de otra pestaña.
 */
const cache = new Map<Surface, ThemePreference | null>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPreferenceSnapshot(surface: Surface): ThemePreference | null {
  if (!cache.has(surface)) cache.set(surface, readPreference(surface));
  return cache.get(surface) ?? null;
}

export function setThemePreference(surface: Surface, preference: ThemePreference): void {
  writePreference(surface, preference);
  cache.set(surface, preference);
  emit();
}

// Otra pestaña cambió la preferencia: el evento `storage` solo se dispara en
// las pestañas que NO hicieron el cambio, que es justo lo que se necesita.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null) {
      // `localStorage.clear()` desde otra pestaña: se descarta todo el caché.
      cache.clear();
      emit();
      return;
    }
    if (!event.key.startsWith("theme:")) return;
    cache.clear();
    emit();
  });
}

export function useThemePreference(surface: Surface): ThemePreference | null {
  return useSyncExternalStore(
    subscribe,
    () => getPreferenceSnapshot(surface),
    // En el servidor no hay preferencia posible: manda el default de la
    // superficie, que es lo que el script inline también asume.
    () => null,
  );
}

// --- Tema del sistema operativo -------------------------------------------

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}

export function useSystemTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeSystem, systemTheme, () => "light" as const);
}
