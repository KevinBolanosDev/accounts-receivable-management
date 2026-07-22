"use client";

import { useRef } from "react";

import { gsap, useGSAP } from "./gsap";
import { MOTION, type MotionToken } from "./tokens";
import { useReducedMotion } from "./reduced-motion";

interface UseCountUpOptions {
  token?: MotionToken;
  format?: (value: number) => string;
}

const defaultFormat = (value: number) => String(Math.round(value));

// Count-up tabular para montos/saldos — DESIGN_SYSTEM.md §1.8 (token "hero" por defecto).
export function useCountUp(value: number, options: UseCountUpOptions = {}) {
  const { token = "hero", format = defaultFormat } = options;
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (!ref.current) return;

      if (reduced) {
        ref.current.textContent = format(value);
        return;
      }

      const { duration, ease } = MOTION[token];
      const proxy = { value: 0 };

      gsap.to(proxy, {
        value,
        duration,
        ease,
        onUpdate: () => {
          if (ref.current) ref.current.textContent = format(proxy.value);
        },
      });
    },
    { scope: ref, dependencies: [value, reduced, token] },
  );

  return ref;
}
