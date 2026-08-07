"use client";

import { useRef } from "react";

import { animateProgressRing } from "./animate-progress-ring";
import { useGSAP } from "./gsap";
import { useReducedMotion } from "./reduced-motion";
import type { MotionToken } from "./tokens";

interface UseProgressRingOptions {
  token?: MotionToken;
}

/**
 * Anima el `ProgressRing` que viva dentro del elemento al que se le pone el
 * ref. Hace las dos cosas que el producto necesita, y la diferencia entre
 * ellas es la que le da sentido al elemento de firma:
 *
 * - **Primer montaje:** el trazo se dibuja de 0 al valor (§1.8, "el trazo se
 *   dibuja de 0 al valor al entrar; el número cuenta en paralelo").
 * - **Cuando el valor cambia:** avanza desde el valor ANTERIOR, no desde 0.
 *   Es el momento de firma del producto: al registrar un cobro, el usuario ve
 *   crecer exactamente lo que acaba de hacer en vez de ver un anillo que se
 *   redibuja desde cero como si nada hubiera pasado.
 *
 * `animateProgressRing` existía desde la Fase 0.5 pero solo lo usaba la
 * galería `/dev/ui`: ninguna pantalla real animaba su anillo.
 *
 * ```tsx
 * const ringRef = useProgressRing(credito.avance);
 * return <div ref={ringRef}><ProgressRing value={credito.avance} /></div>;
 * ```
 */
export function useProgressRing<T extends HTMLElement = HTMLDivElement>(
  value: number,
  options: UseProgressRingOptions = {},
) {
  const { token = "hero" } = options;
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  // Arranca en 0 para que el primer montaje sea el dibujado completo.
  const previous = useRef(0);

  useGSAP(
    () => {
      const from = previous.current;
      previous.current = value;
      animateProgressRing(ref.current, { token, reduced, from });
    },
    { scope: ref, dependencies: [value, reduced, token] },
  );

  return ref;
}
