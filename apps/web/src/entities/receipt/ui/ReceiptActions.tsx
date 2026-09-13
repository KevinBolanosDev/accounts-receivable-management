"use client";

import * as React from "react";
import { DownloadIcon, EyeIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";
import { buildReceiptShareText, buildWhatsAppUrl, type ReceiptShareInfo } from "../lib/whatsapp";
import type { ReceiptActionKind } from "../model/use-receipt-actions";

export interface ReceiptActionsProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Qué acciones se pintan y en qué orden. */
  actions?: ReceiptActionKind[];
  /** Datos para armar el mensaje de WhatsApp. */
  share?: ReceiptShareInfo;
  /** Teléfono destino. Sin él, WhatsApp pregunta a quién enviar. */
  phone?: string | null;
  onView?: () => void;
  onDownload?: () => void;
  /**
   * Comparte el PDF como archivo adjunto (hoja nativa del teléfono). Si
   * devuelve `"unsupported"`, este componente abre el enlace `wa.me` de texto
   * como respaldo — por eso la acción sigue funcionando en escritorio.
   *
   * Recibe el mensaje YA armado: este componente lo construye igual para el
   * enlace (`buildReceiptShareText(share)`), así que pasarlo evita que cada
   * pantalla rearme el mismo objeto y que las dos vías de compartir puedan
   * divergir en el texto.
   *
   * Sin este prop, "compartir" se comporta como siempre: solo el enlace.
   */
  onShare?: (text: string) => Promise<"shared" | "cancelled" | "unsupported">;
  /** Acción en curso para ESTE recibo (spinner). */
  pending?: ReceiptActionKind | null;
  disabled?: boolean;
  /** `icon` = fila compacta · `labeled` = botones con texto. */
  variant?: "icon" | "labeled";
}

const ACTION_LABEL: Record<ReceiptActionKind, string> = {
  view: "Ver recibo",
  download: "Descargar recibo",
  share: "Compartir por WhatsApp",
};

/**
 * Acciones de un recibo: ver, descargar (imprimir/guardar PDF) y compartir por
 * WhatsApp. UNA sola implementación para las dos superficies — es
 * completamente presentacional: no hace fetch ni conoce services, todo entra
 * por props.
 *
 * Regla explícita: cuando una acción no está disponible se renderiza
 * `disabled` con un tooltip que dice por qué. Antes se mostraba un botón
 * habilitado que al pulsarlo lanzaba un `toast.info("…disponible en la Fase
 * 4")` — un botón que miente es peor que uno apagado.
 */
export function ReceiptActions({
  actions = ["download", "share"],
  share,
  phone,
  onView,
  onDownload,
  onShare,
  pending = null,
  disabled = false,
  variant = "icon",
  className,
  ...props
}: ReceiptActionsProps) {
  // El mismo texto alimenta las dos vías: el enlace `wa.me` (respaldo) y el
  // `text` que acompaña al PDF adjunto en la hoja nativa.
  const shareText = share ? buildReceiptShareText(share) : null;
  const shareUrl =
    share?.publicUrl && shareText ? buildWhatsAppUrl({ text: shareText, phone }) : null;

  function renderAction(kind: ReceiptActionKind) {
    const isPending = pending === kind;
    const label = ACTION_LABEL[kind];

    const noDisponible =
      disabled ||
      (kind === "share" && !shareUrl) ||
      (kind === "view" && !onView) ||
      (kind === "download" && !onDownload);

    const icon = isPending ? (
      <Loader2Icon className="size-4 animate-spin" />
    ) : kind === "view" ? (
      <EyeIcon className="size-4" />
    ) : kind === "download" ? (
      <DownloadIcon className="size-4" />
    ) : (
      <WhatsAppIcon className="size-4" />
    );

    const base = cn(
      "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-muted-foreground transition-colors",
      "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      "disabled:pointer-events-none disabled:opacity-40 aria-disabled:opacity-40",
      variant === "icon" ? "size-8" : "h-9 px-3 text-body-sm font-medium",
    );

    // Compartir tiene dos caminos, y el elemento cambia según cuál esté
    // disponible:
    //
    // - Con `onShare`: BOTÓN. Intenta adjuntar el PDF por la hoja nativa del
    //   teléfono; si el navegador no soporta compartir archivos, recién ahí
    //   abre el enlace `wa.me`. Es un botón y no un `<a>` porque hasta no
    //   preguntarle al navegador no se sabe adónde lleva.
    // - Sin `onShare`: el `<a href="wa.me">` de siempre (solo texto + link).
    //
    // El respaldo se abre con `window.open` y no navegando el `<a>`, porque
    // para cuando se sabe que hace falta ya se perdió el click original.
    const node =
      kind === "share" && shareUrl && !noDisponible ? (
        onShare ? (
          <button
            key={kind}
            type="button"
            aria-label={label}
            disabled={isPending}
            className={base}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void onShare(shareText ?? "").then((result) => {
                if (result === "unsupported") {
                  window.open(shareUrl, "_blank", "noopener,noreferrer");
                }
              });
            }}
          >
            {icon}
            {variant === "labeled" ? <span>Compartir</span> : null}
          </button>
        ) : (
          <a
            key={kind}
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className={base}
            onClick={(e) => e.stopPropagation()}
          >
            {icon}
            {variant === "labeled" ? <span>Compartir</span> : null}
          </a>
        )
      ) : (
        <button
          key={kind}
          type="button"
          aria-label={label}
          disabled={noDisponible || isPending}
          className={base}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (kind === "view") onView?.();
            if (kind === "download") onDownload?.();
          }}
        >
          {icon}
          {variant === "labeled" ? (
            <span>{kind === "view" ? "Ver" : "Descargar"}</span>
          ) : null}
        </button>
      );

    return (
      <Tooltip key={kind}>
        <TooltipTrigger asChild>
          {/* `span` envolvente: un botón deshabilitado no emite eventos de
              puntero, así que sin esto el tooltip nunca aparecería justo en el
              caso en que hace falta explicar por qué está apagado. */}
          <span className="inline-flex">{node}</span>
        </TooltipTrigger>
        <TooltipContent>{noDisponible ? "Recibo no disponible" : label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      data-slot="receipt-actions"
      className={cn("flex items-center gap-1", className)}
      {...props}
    >
      {actions.map(renderAction)}
    </div>
  );
}
