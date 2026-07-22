// DESIGN_SYSTEM.md §1.8 — una sola fuente de duraciones/easings, como los tokens de color.
export const MOTION = {
  micro: { duration: 0.14, ease: "power2.out" },
  base: { duration: 0.28, ease: "power3.out" },
  overlay: { duration: 0.33, ease: "power3.inOut" },
  hero: { duration: 0.6, ease: "power3.out" },
} as const;

export type MotionToken = keyof typeof MOTION;
