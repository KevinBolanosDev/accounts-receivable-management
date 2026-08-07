"use client";

import * as React from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  /**
   * Segundo paso para acciones irreversibles: el usuario debe escribir este
   * texto exacto para habilitar el botón de confirmar. Usar solo cuando el
   * daño no se puede deshacer, y siempre con un valor CORTO que esté visible
   * en pantalla (un documento, el nombre de una ruta) — obligar a copiar un
   * nombre largo en el celular es hostil y termina en copiar/pegar sin leer.
   */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
  /** Aviso destacado, p. ej. la consecuencia concreta de la acción. */
  warning?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}

// Único diálogo de confirmación del sistema. Antes cada pantalla se copiaba
// su propio <Dialog> con la misma estructura (había tres), lo que hacía que
// el copy y el comportamiento divergieran entre acciones igual de graves.
export function ConfirmDialog({ open, onOpenChange, ...rest }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {/* El cuerpo se monta solo con el diálogo abierto, así que la frase
            escrita arranca vacía en cada apertura sin necesidad de resetearla
            desde un efecto: reabrir tras cancelar no debe dejar el segundo
            paso ya satisfecho. */}
        <ConfirmDialogBody onOpenChange={onOpenChange} {...rest} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmDialogBody({
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  confirmPhrase,
  confirmPhraseLabel,
  warning,
  onConfirm,
}: Omit<ConfirmDialogProps, "open">) {
  const [typed, setTyped] = React.useState("");

  const phraseMatches =
    !confirmPhrase || typed.trim().toLowerCase() === confirmPhrase.trim().toLowerCase();

  // Un documento es numérico: abrir el teclado numérico ahorra un gesto en
  // móvil, que es donde se usa esta app.
  const isNumericPhrase = !!confirmPhrase && /^\d+$/.test(confirmPhrase);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>

      {warning ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-body-sm text-destructive-strong">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      ) : null}

      {confirmPhrase ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-phrase">
            {confirmPhraseLabel ?? `Escribe "${confirmPhrase}" para confirmar`}
          </Label>
          <Input
            id="confirm-phrase"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode={isNumericPhrase ? "numeric" : "text"}
          />
        </div>
      ) : null}

      <AlertDialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "primary"}
          loading={loading}
          disabled={!phraseMatches}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  );
}
