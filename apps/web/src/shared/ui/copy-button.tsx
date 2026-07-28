"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";

interface CopyButtonProps extends Omit<React.ComponentProps<"button">, "value" | "onCopy"> {
  /** Texto crudo que va al portapapeles (sin formatear). */
  value: string;
  /** `aria-label` del botón. Ej: "Copiar teléfono". */
  label?: string;
  successMessage?: string;
  onCopied?: (value: string) => void;
}

/**
 * Botón de copiar al portapapeles.
 *
 * Se usa DENTRO de tarjetas que a su vez son navegables (la card del cliente
 * tiene un enlace que cubre toda su superficie), así que `preventDefault` +
 * `stopPropagation` no son opcionales: sin ellos, copiar el teléfono navegaría
 * al detalle del cliente.
 */
export function CopyButton({
  value,
  label = "Copiar",
  successMessage = "Copiado",
  onCopied,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      onCopied?.(value);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Falla en contextos no seguros (http sin localhost) o si el usuario
      // negó el permiso. Mejor decirlo que fingir que copió.
      toast.error("No se pudo copiar. Copia el valor manualmente.");
    }
  }

  return (
    <button
      type="button"
      data-slot="copy-button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-success" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}
