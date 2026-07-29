"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { ALLOWED_DOCUMENT_PHOTO_MIME, MAX_DOCUMENT_PHOTO_BYTES } from "@repo/types";

import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";

import { useUploadFotoDocumento } from "../api/use-clientes";

interface DocumentUploaderProps {
  /** Path persistido (lo que el formulario guarda y envía). */
  value: string | null;
  /** URL firmada de la foto YA guardada — viene del detalle del cliente en edición. */
  previewUrl?: string | null;
  onChange: (path: string | null) => void;
  /** Se dispara con `true` mientras sube y `false` al terminar (éxito o error). */
  onUploadingChange?: (uploading: boolean) => void;
  /** Abre la cámara nativa en móvil (pantalla 17c). */
  capture?: boolean;
  /** Texto del estado vacío (ej. "Agregar frente"). */
  placeholder?: string;
}

type Status = "idle" | "uploading" | "done" | "error";

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!(ALLOWED_DOCUMENT_PHOTO_MIME as readonly string[]).includes(file.type)) {
    return "Solo se permiten imágenes JPEG, PNG o WebP.";
  }
  if (file.size > MAX_DOCUMENT_PHOTO_BYTES) {
    return "La imagen no puede superar 5 MB.";
  }
  return null;
}

// DESIGN_SYSTEM.md §3.4 / §4.4 — chip compacto de foto del documento.
//
// Antes `filled`/`statusText` se derivaban del objectURL LOCAL: si el upload
// fallaba, el chip seguía mostrando la miniatura y el texto "Subida" con
// `value` en `null` — la UI mentía sobre si la foto quedó guardada. Y en
// edición, con una foto ya subida, el `<img>` solo se pintaba si había
// `preview` local, así que las fotos guardadas nunca se veían. El estado
// explícito (`status`) y separar `previewUrl` (servidor) de `localPreview`
// (objectURL) cierran ambos huecos.
export function DocumentUploader({
  value,
  previewUrl,
  onChange,
  onUploadingChange,
  capture,
  placeholder = "Agregar foto",
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
  const [status, setStatus] = useState<Status>(value ? "done" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const upload = useUploadFotoDocumento();

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    onUploadingChange?.(status === "uploading");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleFile(file: File | undefined) {
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setStatus("error");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setMeta({ name: file.name, size: file.size });
    setStatus("uploading");
    setErrorMessage(null);

    upload.mutate(file, {
      onSuccess: (res) => {
        setStatus("done");
        onChange(res.path);
      },
      onError: (error) => {
        // Con el upload fallido, `value` no cambia — si ya había una foto
        // guardada, sigue siendo la que hay que conservar.
        setStatus("error");
        setErrorMessage(error instanceof ApiError ? error.message : "No se pudo subir la foto.");
      },
    });
  }

  function clear() {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setMeta(null);
    setStatus("idle");
    setErrorMessage(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function retry() {
    setStatus("idle");
    setErrorMessage(null);
    inputRef.current?.click();
  }

  // `previewUrl` (firmada, del servidor) es lo que hace visible una foto ya
  // guardada en modo edición; `localPreview` (objectURL) gana mientras el
  // usuario está reemplazándola.
  const shownImage = localPreview ?? previewUrl;
  const filled = status !== "idle";
  const statusText =
    status === "uploading"
      ? "Subiendo…"
      : status === "error"
        ? "No se subió"
        : status === "done"
          ? "Subida"
          : "";

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
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-background p-3",
            status === "error" ? "border-destructive/40" : "border-border",
          )}
        >
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
            {shownImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownImage} alt="" className="size-full object-cover" loading="lazy" />
            ) : status === "error" ? (
              <TriangleAlertIcon className="size-5 text-destructive" />
            ) : (
              <ImageIcon className="size-5" />
            )}
            {status === "uploading" ? (
              <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2Icon className="size-4 animate-spin" />
              </span>
            ) : null}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{meta?.name ?? "Documento"}</span>
            <span
              className={cn(
                "truncate text-caption",
                status === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {status === "error" ? (errorMessage ?? statusText) : statusText}
              {meta && status !== "error" ? ` · ${formatSize(meta.size)}` : ""}
            </span>
          </div>
          {status === "error" ? (
            <button
              type="button"
              onClick={retry}
              className="text-sm font-medium text-primary hover:underline"
            >
              Reintentar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-medium text-primary hover:underline"
            >
              Cambiar
            </button>
          )}
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
              {capture ? "Tomar con la cámara" : "JPG o PNG, máx. 5 MB"}
            </span>
          </div>
        </button>
      )}
    </>
  );
}
