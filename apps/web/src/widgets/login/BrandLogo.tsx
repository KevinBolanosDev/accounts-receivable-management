import { cn } from "@/shared/lib/utils";

interface BrandLogoProps {
  // "surface": arco cian sobre pista de borde (Admin, sobre superficie oscura).
  // "onGradient": arco blanco sobre pista translúcida (Cobrador, sobre el hero).
  tone?: "surface" | "onGradient";
}

// Marca "anillo + CobroDiario" del prototipo (#1b/#14c). El anillo es el
// elemento de firma (DESIGN_SYSTEM.md §1.7) reusado como logotipo.
export function BrandLogo({ tone = "surface" }: BrandLogoProps) {
  const onGradient = tone === "onGradient";
  const trackClass = onGradient ? "stroke-white/30" : "stroke-border";
  const arcClass = onGradient ? "stroke-white" : "stroke-accent";
  const textClass = onGradient ? "text-white" : "text-foreground";

  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="block">
        <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3.5" className={trackClass} />
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="81.7"
          strokeDashoffset="24.5"
          transform="rotate(-90 16 16)"
          className={arcClass}
        />
      </svg>
      <span className={cn("text-lg font-extrabold tracking-tight", textClass)}>CobroDiario</span>
    </div>
  );
}
