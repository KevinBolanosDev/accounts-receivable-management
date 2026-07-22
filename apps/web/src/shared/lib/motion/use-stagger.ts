"use client";

import { useRef } from "react";

import { gsap, useGSAP } from "./gsap";
import { MOTION, type MotionToken } from "./tokens";
import { useReducedMotion } from "./reduced-motion";

interface UseStaggerOptions {
  token?: MotionToken;
  y?: number;
  /** Segundos entre ítems — DESIGN_SYSTEM.md §1.8 pide ≤ 40ms. */
  each?: number;
}

// Entrada en stagger corto, solo en el primer montaje (deps vacío) — nunca en re-render.
export function useStagger<T extends HTMLElement = HTMLDivElement>(
  itemSelector: string,
  options: UseStaggerOptions = {},
) {
  const { token = "base", y = 12, each = 0.04 } = options;
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (!ref.current) return;
      const { duration, ease } = MOTION[token];
      const items = gsap.utils.toArray<Element>(itemSelector, ref.current);
      if (items.length === 0) return;

      gsap.from(items, {
        autoAlpha: 0,
        y: reduced ? 0 : y,
        duration: reduced ? 0 : duration,
        ease,
        stagger: reduced ? 0 : each,
      });
    },
    { scope: ref, dependencies: [reduced] },
  );

  return ref;
}
