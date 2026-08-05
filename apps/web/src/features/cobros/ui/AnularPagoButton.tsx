"use client";

import { useState } from "react";
import { Undo2Icon } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/shared/api/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

import { useAnularPago } from "../api/use-cobros";

interface AnularPagoButtonProps {
  pago: { id: string; monto: number; numeroCuota: number };
}

// Un pago mal registrado se anula, nunca se edita — ver el comentario grande
// en `CobrosService.anularPago` (back). Un solo componente para las dos
// pantallas de staff (Admin y Cobrador comparten el mismo historial de
// `entities/payment`, esto vive en `features/cobros` porque necesita el hook
// de mutación, que una entity no puede importar).
export function AnularPagoButton({ pago }: AnularPagoButtonProps) {
  const [open, setOpen] = useState(false);
  const anular = useAnularPago();

  async function handleConfirm() {
    try {
      await anular.mutateAsync(pago.id);
      toast.success("Pago anulado", {
        description: "El saldo volvió al crédito. Registra el cobro correcto cuando quieras.",
      });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo anular el pago.");
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Anular pago"
            onClick={() => setOpen(true)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Undo2Icon className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Anular pago</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Anular este pago?"
        description={`Se anula el abono de ${formatCurrency(pago.monto)} (cuota ${pago.numeroCuota}). El saldo vuelve al crédito y, si ese pago lo había saldado, el crédito se reabre. El pago no se borra — queda marcado como anulado en el historial.`}
        warning="Para corregir un monto o una fecha equivocada: anula este pago y registra uno nuevo con los datos correctos."
        confirmLabel="Anular pago"
        variant="destructive"
        loading={anular.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
