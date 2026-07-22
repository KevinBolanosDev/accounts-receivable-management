import { gsap } from "./gsap";
import { MOTION, type MotionToken } from "./tokens";

interface AnimateProgressRingOptions {
  token?: MotionToken;
  reduced?: boolean;
}

/**
 * Dibuja el trazo del ProgressRing (shared/ui/progress-ring.tsx) de 0 al valor objetivo y cuenta
 * el número en paralelo. Se llama desde un useGSAP({ scope }) del consumidor — no es un hook en sí
 * porque orquesta dos nodos (arco + label) ya renderizados por ProgressRing, no crea los suyos.
 */
export function animateProgressRing(
  scope: HTMLElement | null,
  options: AnimateProgressRingOptions = {},
) {
  if (!scope) return;

  const arc = scope.querySelector<SVGCircleElement>('[data-slot="progress-ring-arc"]');
  const label = scope.querySelector<HTMLElement>('[data-slot="progress-ring-value"]');
  if (!arc) return;

  const circumference = Number(arc.dataset.circumference ?? 0);
  const targetOffset = Number(arc.getAttribute("stroke-dashoffset") ?? 0);
  const targetValue = Number(scope.dataset.value ?? 0);
  const { token = "hero", reduced = false } = options;
  const { duration, ease } = MOTION[token];

  const tl = gsap.timeline();

  if (reduced) {
    tl.set(arc, { strokeDashoffset: targetOffset });
    if (label) label.textContent = `${targetValue}%`;
    return tl;
  }

  tl.fromTo(
    arc,
    { strokeDashoffset: circumference },
    { strokeDashoffset: targetOffset, duration, ease },
    0,
  );

  if (label) {
    const proxy = { value: 0 };
    tl.to(
      proxy,
      {
        value: targetValue,
        duration,
        ease,
        onUpdate: () => {
          label.textContent = `${Math.round(proxy.value)}%`;
        },
      },
      0,
    );
  }

  return tl;
}
