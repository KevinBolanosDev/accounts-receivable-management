"use client";

import { toast } from "sonner";

import { ApiError } from "@/shared/api/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

import { useClienteInactivo, useReactivateCliente } from "../api/use-clientes";

interface ReactivateClientDialogProps {
  /** `null` = cerrado. Se pasa el mínimo (id + nombre) que ya trae la fila. */
  cliente: { id: string; nombre: string } | null;
  onOpenChange: (open: boolean) => void;
}

// Reactivar vuelve a activar la relación tal cual estaba (sin re-tipear el
// formulario), pero antes de confirmar hay que avisar si el cliente tiene
// créditos que quedaron abiertos: no son un alta nueva, vuelven con toda su
// deuda pendiente y eso puede sorprender si nadie lo dice.
export function ReactivateClientDialog({ cliente, onOpenChange }: ReactivateClientDialogProps) {
  const { data: detalle, isLoading } = useClienteInactivo(cliente?.id ?? "");
  const reactivar = useReactivateCliente();

  async function handleConfirm() {
    if (!cliente) return;
    try {
      await reactivar.mutateAsync(cliente.id);
      toast.success("Cliente reactivado", {
        description: "Se restauraron sus créditos y su historial de pagos.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo reactivar el cliente.");
    }
  }

  const activos = detalle?.creditosActivos ?? [];
  const enMora = activos.filter((c) => c.estado === "MORA").length;
  const saldoTotal = activos.reduce((sum, c) => sum + c.saldoPendiente, 0);
  const historial = detalle?.creditosHistorial.length ?? 0;

  const warning = isLoading ? null : activos.length > 0 ? (
    <span>
      Tiene {activos.length} {activos.length === 1 ? "crédito abierto" : "créditos abiertos"} por{" "}
      {formatCurrency(saldoTotal)}
      {enMora > 0 ? ` (${enMora} en mora)` : ""}. Al reactivar vuelven a su cartera activa.
    </span>
  ) : null;

  return (
    <ConfirmDialog
      open={!!cliente}
      onOpenChange={onOpenChange}
      title={cliente ? `¿Reactivar a ${cliente.nombre}?` : ""}
      description={
        isLoading
          ? "Revisando sus créditos…"
          : activos.length > 0
            ? "Vuelve a tu cartera activa con los datos que ya tenía registrados."
            : historial > 0
              ? `Vuelve a tu cartera activa. No tiene créditos abiertos — conserva ${historial} en su historial.`
              : "Vuelve a tu cartera activa con los datos que ya tenía registrados."
      }
      warning={warning}
      confirmLabel="Reactivar"
      loading={reactivar.isPending}
      onConfirm={handleConfirm}
    />
  );
}
