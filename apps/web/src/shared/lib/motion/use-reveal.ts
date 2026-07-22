"use client";

import { useRef } from "react";

import { gsap, useGSAP } from "./gsap";
import { MOTION, type MotionToken } from "./tokens";
import { useReducedMotion } from "./reduced-motion";

interface UseRevealOptions {
  token?: MotionToken;
  /** Desplazamiento vertical de entrada, en px. */
  y?: number;
  delay?: number;
}

// Entrada sutil (fade + rise) — hero móvil, y la de bottom sheet/modal con token "overlay".
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: UseRevealOptions = {}) {
  const { token = "base", y = 16, delay = 0 } = options;
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (!ref.current) return;
      const { duration, ease } = MOTION[token];

      gsap.from(ref.current, {
        autoAlpha: 0,
        y: reduced ? 0 : y,
        duration: reduced ? 0 : duration,
        ease,
        delay: reduced ? 0 : delay,
      });
    },
    { scope: ref, dependencies: [reduced, token, y, delay] },
  );

  return ref;
}
