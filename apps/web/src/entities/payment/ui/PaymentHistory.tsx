import type { PaymentHistoryItem } from "@repo/types";

import { ReceiptIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/ui/empty-state";
import { PaymentHistoryTable, type PaymentHistoryTableProps } from "./PaymentHistoryTable";
import { PaymentRow } from "./PaymentRow";

export interface PaymentHistoryProps extends PaymentHistoryTableProps {
  /**
   * `rows` = tarjetas (móvil) · `table` = tabla (escritorio) ·
   * `responsive` = tarjetas hasta `md`, tabla desde `md`.
   */
  layout?: "rows" | "table" | "responsive";
  /** Nombre del producto, cuando la lista es de un solo crédito. */
  producto?: string;
  className?: string;
}

/**
 * Punto único de entrada al historial de pagos. Lo usan el detalle de crédito
 * del Cobrador y el del Portal del Cliente con los mismos datos
 * (`PaymentHistoryItem[]`) — solo cambian las acciones de recibo que cada
 * superficie inyecta vía `renderActions`.
 */
export function PaymentHistory({
  layout = "responsive",
  producto,
  className,
  ...tableProps
}: PaymentHistoryProps) {
  const { pagos, cuotasTotal, renderActions, emptyText } = tableProps;

  const rows = (
    <div className={cn("flex flex-col gap-2", className)}>
      {pagos.length === 0 ? (
        <EmptyState
          size="inline"
          icon={<ReceiptIcon />}
          title={emptyText ?? "Todavía no hay pagos registrados"}
        />
      ) : (
        pagos.map((pago: PaymentHistoryItem) => (
          <PaymentRow
            key={pago.id}
            pago={pago}
            cuotasTotal={cuotasTotal}
            producto={producto}
            actions={renderActions?.(pago)}
          />
        ))
      )}
    </div>
  );

  if (layout === "rows") return rows;
  if (layout === "table") {
    return (
      <div className={className}>
        <PaymentHistoryTable {...tableProps} />
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">{rows}</div>
      <div className={cn("hidden md:block", className)}>
        <PaymentHistoryTable {...tableProps} />
      </div>
    </>
  );
}
