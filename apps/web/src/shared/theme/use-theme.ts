"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";

import { useReducedMotion } from "@/shared/lib/motion";

import {
  applyTheme,
  isThemeable,
  resolveSurface,
  resolveTheme,
  SURFACE_DEFAULTS,
  type ResolvedTheme,
  type Surface,
  type ThemePreference,
} from "./theme";
import { setThemePreference, useSystemTheme, useThemePreference } from "./theme-store";

/** Punto del click, para el revelado circular. */
export interface ThemeChangeOrigin {
  x: number;
  y: number;
}

export interface UseThemeResult {
  surface: Surface;
  /**
   * Lo que muestra el selector. Cuando no hay nada guardado devuelve el modo
   * por defecto de la superficie en vez de `null`: así el control siempre
   * tiene una opción marcada, sin inventar un cuarto estado "sin elegir".
   */
  preference: ThemePreference;
  resolved: ResolvedTheme;
  /** `false` en el Portal Cliente y en las rutas públicas (§0). */
  canToggle: boolean;
  setPreference: (preference: ThemePreference, origin?: ThemeChangeOrigin) => void;
}

const REVEAL_DURATION_MS = 420;
const REVEAL_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

/**
 * Revelado circular desde el punto del click con la View Transitions API del
 * navegador. NO necesita `experimental.viewTransition` de Next: eso es para
 * animar navegaciones, y esto es una mutación de DOM directa.
 */
function commitWithReveal(mutate: () => void, origin?: ThemeChangeOrigin): void {
  const doc = document as DocumentWithViewTransition;

  if (!origin || typeof doc.startViewTransition !== "function") {
    mutate();
    return;
  }

  const transition = doc.startViewTransition(mutate);

  transition.ready
    .then(() => {
      const { x, y } = origin;
      // Radio hasta la esquina más lejana: el círculo tiene que terminar de
      // cubrir la ventana, no solo llegar al borde más cercano.
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // La transición se canceló (otra empezó encima, o la pestaña se ocultó).
      // El tema ya cambió; solo se pierde la animación.
    });
}

/**
 * Modo de color de la superficie actual + cómo cambiarlo.
 *
 * La superficie sale del pathname, no de la sesión: el mismo navegador puede
 * tener sesión de staff y de cliente a la vez (claves de localStorage
 * distintas), y lo que manda para el color es en qué portal estás parado.
 */
export function useTheme(): UseThemeResult {
  const pathname = usePathname();
  const surface = resolveSurface(pathname);
  const stored = useThemePreference(surface);
  const system = useSystemTheme();
  const reduced = useReducedMotion();

  const resolved = resolveTheme(surface, stored, system);
  const canToggle = isThemeable(surface);

  const setPreference = useCallback(
    (preference: ThemePreference, origin?: ThemeChangeOrigin) => {
      if (!isThemeable(surface)) return;

      const next = resolveTheme(surface, preference, system);

      // El DOM se toca acá dentro y no se deja al efecto de `ThemeSync`: la
      // View Transition necesita que la mutación ocurra DENTRO del callback
      // para poder capturar el antes y el después. `applyTheme` es idempotente,
      // así que el efecto posterior no hace nada.
      const mutate = () => {
        setThemePreference(surface, preference);
        applyTheme(next);
      };

      if (reduced) {
        mutate();
        return;
      }
      commitWithReveal(mutate, origin);
    },
    [surface, system, reduced],
  );

  return {
    surface,
    preference: stored ?? SURFACE_DEFAULTS[surface],
    resolved,
    canToggle,
    setPreference,
  };
}
