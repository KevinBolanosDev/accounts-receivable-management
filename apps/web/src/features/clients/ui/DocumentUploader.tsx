"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";

import { useUploadFotoDocumento } from "../api/use-clientes";

interface DocumentUploaderProps {
  /** URL subida (se guarda en el cliente). */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Abre la cámara nativa en móvil (pantalla 17c). */
  capture?: boolean;
  /** Texto del estado vacío (ej. "Agregar frente"). */
  placeholder?: string;
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// DESIGN_SYSTEM.md §3.4 / §4.4 — chip compacto de foto del documento con preview
// optimista (objectURL) mientras la subida corre en segundo plano (mock).
export function DocumentUploader({
  value,
  onChange,
  capture,
  placeholder = "Agregar foto",
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
  const upload = useUploadFotoDocumento();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen (JPG, PNG o WEBP).");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setMeta({ name: file.name, size: file.size });
    upload.mutate(file, {
      onSuccess: (res) => onChange(res.fotoDocumentoUrl),
      onError: () => toast.error("No se pudo subir la foto."),
    });
  }

  function clear() {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setMeta(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const shownImage = preview ?? value;
  const filled = !!shownImage;
  const statusText = upload.isPending ? "Subiendo…" : "Subida";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {filled ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-5" />
            )}
            {upload.isPending ? (
              <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2Icon className="size-4 animate-spin" />
              </span>
            ) : null}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{meta?.name ?? "Documento"}</span>
            <span className="truncate text-caption text-muted-foreground">
              {statusText}
              {meta ? ` · ${formatSize(meta.size)}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={clear}
            aria-label="Quitar foto"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-dashed border-border bg-background p-3 text-left transition-colors hover:bg-muted",
          )}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{placeholder}</span>
            <span className="text-caption text-muted-foreground">
              {capture ? "Tomar con la cámara" : "JPG o PNG"}
            </span>
          </div>
        </button>
      )}
    </>
  );
}
