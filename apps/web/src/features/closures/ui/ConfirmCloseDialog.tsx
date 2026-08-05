"use client";

import { formatCurrency } from "@/shared/lib/format-currency";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

interface ConfirmCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalCollected: number;
  collectedCount: number;
  unpaidCount: number;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

// DESIGN_SYSTEM.md §4.6 — el cierre de ruta es irreversible: mismo peso visual
// que una eliminación (`ConfirmDialog` variant="destructive"). Sin
// `confirmPhrase`: a diferencia de borrar un cobrador o una ruta, acá no hay
// un identificador corto y visible para escribir, y el cierre es auditable
// (nunca borra datos) — el costo de un error es menor.
export function ConfirmCloseDialog({
  open,
  onOpenChange,
  totalCollected,
  collectedCount,
  unpaidCount,
  loading,
  onConfirm,
}: ConfirmCloseDialogProps) {
  const cobrosLabel = collectedCount === 1 ? "1 pago" : `${collectedCount} pagos`;
  const clientesLabel = unpaidCount === 1 ? "1 cliente" : `${unpaidCount} clientes`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Cerrar la ruta de hoy?"
      description={`Cobraste ${formatCurrency(totalCollected)} en ${cobrosLabel}. Quedan ${clientesLabel} sin pagar hoy.`}
      warning="Esta acción no se puede deshacer."
      confirmLabel="Sí, cerrar ruta"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}
