// DESIGN_SYSTEM.md §2.1/§1.8 — micro-interacción de pulsado. §1.8 dice
// explícitamente que estas "pueden quedarse en CSS si no ameritan un
// timeline": una tarjeta que se hunde 1% al tocarla no necesita GSAP, y
// montar un timeline por fila de una lista sí sería caro.
//
// `Button` ya trae `active:scale-[0.98]` en su `cva`. Esto es para lo OTRO que
// se toca en esta app y no es un botón: las tarjetas navegables (cliente,
// crédito, ruta, cierre), que hoy solo cambian de fondo. En el móvil del
// cobrador, que toca con el dedo y no ve un cursor, el hover no existe: el
// hundido es la única confirmación de que el toque entró.
//
// `motion-safe:` respeta `prefers-reduced-motion` sin pasar por el hook.
export const PRESS_SCALE = "transition-transform motion-safe:active:scale-[0.99]";
