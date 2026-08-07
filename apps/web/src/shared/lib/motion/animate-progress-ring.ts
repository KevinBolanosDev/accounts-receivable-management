import { gsap } from "./gsap";
import { MOTION, type MotionToken } from "./tokens";

interface AnimateProgressRingOptions {
  token?: MotionToken;
  reduced?: boolean;
  /**
   * Valor de partida (0–100). Por defecto 0: el anillo se dibuja desde cero al
   * entrar. Pasando el valor ANTERIOR, el trazo avanza desde donde estaba —
   * que es lo que convierte "registré un cobro" en algo que se ve crecer.
   */
  from?: number;
}

/**
 * Dibuja el trazo del ProgressRing (shared/ui/progress-ring.tsx) desde `from` hasta el valor
 * objetivo y cuenta el número en paralelo. Se llama desde un useGSAP({ scope }) del consumidor —
 * no es un hook en sí porque orquesta dos nodos (arco + label) ya renderizados por ProgressRing,
 * no crea los suyos. El hook `useProgressRing` envuelve esa ceremonia.
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
  const { token = "hero", reduced = false, from = 0 } = options;
  const { duration, ease } = MOTION[token];

  const startValue = Math.min(100, Math.max(0, from));
  const startOffset = circumference * (1 - startValue / 100);

  const tl = gsap.timeline();

  if (reduced) {
    tl.set(arc, { strokeDashoffset: targetOffset });
    if (label) label.textContent = `${targetValue}%`;
    return tl;
  }

  tl.fromTo(
    arc,
    { strokeDashoffset: startOffset },
    { strokeDashoffset: targetOffset, duration, ease },
    0,
  );

  if (label) {
    const proxy = { value: startValue };
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
