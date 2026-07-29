"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ImageOffIcon, RotateCwIcon } from "lucide-react";
import type { ClienteDetail } from "@repo/types";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";

import { clientesKeys } from "../api/use-clientes";

interface DocumentPhotoSlotProps {
  label: string;
  url: string | null;
  onOpen: () => void;
  onExpired: () => void;
}

// Un slot por lado (frente/reverso). La URL es firmada y de vida corta
// (`DOCUMENT_PHOTO_SIGNED_URL_TTL_SECONDS` en el backend, 1h): si el usuario
// deja la pestaña abierta más de eso, la imagen empieza a dar 403. El
// `onError` es lo que hace usable una firma corta — sin él, una foto vieja se
// vería rota para siempre hasta un F5 manual.
function DocumentPhotoSlot({ label, url, onOpen, onExpired }: DocumentPhotoSlotProps) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-caption text-muted-foreground">{label}</span>
        <div className="flex aspect-16/10 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-center">
          <ImageOffIcon className="size-5 text-muted-foreground" />
          <p className="px-4 text-caption text-muted-foreground">
            {broken ? "El enlace expiró" : "Sin foto"}
          </p>
          {broken ? (
            <Button type="button" variant="ghost" size="sm" onClick={onExpired}>
              <RotateCwIcon />
              Recargar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={onOpen}
        className="aspect-16/10 overflow-hidden rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </button>
    </div>
  );
}

// DoD de Fase 2 pendiente hasta ahora: la foto se subía pero nunca se veía en
// ningún lado del front. Solo tiene sentido en el detalle del cliente — la
// lista nunca las firma (ver el comentario en `clienteListItemSchema`).
export function ClientDocumentPhotos({ cliente }: { cliente: ClienteDetail }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const tieneAlgunaFoto = cliente.fotoDocumentoFrenteUrl || cliente.fotoDocumentoReversoUrl;

  function refetchDetail() {
    // Trae una firma nueva. `invalidateQueries` alcanza porque la query del
    // detalle ya está montada (esta pantalla la usa) — no hace falta refetch manual.
    queryClient.invalidateQueries({ queryKey: clientesKeys.detail(cliente.id) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption uppercase tracking-wider text-muted-foreground">
          Documento de identidad
        </p>
        {!tieneAlgunaFoto ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/clients/${cliente.id}/edit`}>Agregar foto</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DocumentPhotoSlot
          label="Frente"
          url={cliente.fotoDocumentoFrenteUrl}
          onOpen={() =>
            cliente.fotoDocumentoFrenteUrl &&
            setPreview({ url: cliente.fotoDocumentoFrenteUrl, label: "Frente del documento" })
          }
          onExpired={refetchDetail}
        />
        <DocumentPhotoSlot
          label="Reverso"
          url={cliente.fotoDocumentoReversoUrl}
          onOpen={() =>
            cliente.fotoDocumentoReversoUrl &&
            setPreview({ url: cliente.fotoDocumentoReversoUrl, label: "Reverso del documento" })
          }
          onExpired={refetchDetail}
        />
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle className="sr-only">{preview?.label}</DialogTitle>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.label}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
