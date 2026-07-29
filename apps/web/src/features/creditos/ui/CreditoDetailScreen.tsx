"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { CreditoDetail, CreditoListItem } from "@repo/types";

import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ApiError } from "@/shared/api/client";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useAnularCredito, useCredito } from "../api/use-creditos";

// DESIGN_SYSTEM.md §3.3 — Detalle de crédito (Admin, #10a). Hero con anillo de
// progreso ("X% pagado") + producto + estado + cliente/ruta/inicio y una tira
// de stats (monto total / pagado / saldo / cuota / cuotas). Debajo, la tabla de
// "Pagos asociados" (cuota, fecha, monto, cobrador, estado). Acciones Editar
// (deshabilitada si ya tiene pagos) y Anular (soft-delete con confirmación).

export function CreditoDetailScreen({ creditoId }: { creditoId: string }) {
  const router = useRouter();
  const { data: credito, isLoading } = useCredito(creditoId);
  const anular = useAnularCredito();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const tienePagos = (credito?.pagos?.length ?? 0) > 0;

  if (isLoading || !credito) {
    return (
      <>
        <AdminPageHeader eyebrow="Créditos" title="Detalle del crédito" />
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </>
    );
  }

  async function handleAnular() {
    if (!credito) return;
    try {
      await anular.mutateAsync(credito.id);
      toast.success("Crédito anulado");
      setConfirmOpen(false);
      router.push(`/admin/clients/${credito.clienteId}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo anular el crédito");
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow={`Créditos / ${credito.codigo}`}
        title="Detalle del crédito"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={tienePagos || credito.estado !== "ACTIVO"}
              title={tienePagos ? "No se puede editar un crédito con pagos." : "Editar crédito"}
              onClick={() => router.push(`/admin/credits/${credito.id}/edit`)}
            >
              <PencilIcon />
              Editar
            </Button>
            <Button
              variant="secondary"
              className="text-destructive"
              disabled={credito.estado === "ANULADO"}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon />
              Anular
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <CreditoHero credito={credito} />
        <PagosCard credito={credito} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Anular crédito?"
        description={
          credito.estado === "ANULADO"
            ? "Este crédito ya está anulado."
            : `El crédito ${credito.codigo} quedará anulado (no se borra); sus pagos siguen siendo auditables.`
        }
        confirmLabel="Anular crédito"
        variant="destructive"
        loading={anular.isPending}
        onConfirm={handleAnular}
      />
    </>
  );
}

// === Hero: anillo + identidad + stats ======================================
function CreditoHero({ credito }: { credito: CreditoDetail }) {
  const porcentaje = Math.min(100, Math.max(0, Math.round(credito.porcentajePagado)));
  const rutaNombre = credito.cliente.ruta?.nombre ?? null;

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative inline-flex shrink-0 items-center justify-center self-center sm:self-auto">
          <ProgressRing value={porcentaje} size="hero" showLabel={false} />
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold tabular-nums">{porcentaje}%</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Pagado
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-h2 font-semibold">{credito.producto}</span>
            <EstadoBadge estado={credito.estado} />
            <span className="text-caption text-muted-foreground">#{credito.codigo}</span>
          </div>
          <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
              {getInitials(credito.cliente.nombre)}
            </span>
            <span className="truncate">
              {credito.cliente.nombre}
              {rutaNombre ? ` · ${rutaNombre}` : ""}
              {` · inicio ${fmtFecha(credito.fechaInicio)}`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Monto total" value={formatCurrency(credito.montoTotal)} />
        <Stat label="Pagado" value={formatCurrency(credito.totalPagado)} valueClassName="text-success" />
        <Stat label="Saldo" value={formatCurrency(credito.saldoPendiente)} />
        <Stat label="Cuota diaria" value={formatCurrency(credito.cuotaDiaria)} />
        <Stat label="Cuotas" value={`${credito.cuotasPagadas}/${credito.cuotasTotal}`} />
      </div>
    </div>
  );
}

// === Pagos asociados =======================================================
function PagosCard({ credito }: { credito: CreditoDetail }) {
  const total = credito.pagos.length;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption uppercase tracking-wide text-muted-foreground">Pagos asociados</p>
        <span className="text-caption text-muted-foreground">
          {credito.cuotasPagadas} de {credito.cuotasTotal} cuotas
        </span>
      </div>

      {total === 0 ? (
        <p className="text-body-sm text-muted-foreground">Este crédito aún no tiene pagos.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuota</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Cobrador</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credito.pagos.map((pago, i) => (
                <TableRow key={pago.id}>
                  <TableCell className="font-medium tabular-nums">#{total - i}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {fmtFecha(pago.fecha)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(pago.monto)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {pago.cobradorNombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Fase 3: todo pago registrado es "Pagado"; el estado "Tarde"
                        (atrasado vs. cronograma) llega con el cierre diario (Fase 5). */}
                    <Badge status="activo">Pagado</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const ESTADO_BADGE: Record<
  CreditoListItem["estado"],
  { status: React.ComponentProps<typeof Badge>["status"]; label: string }
> = {
  ACTIVO: { status: "activo", label: "Activo" },
  PAGADO: { status: "pagado", label: "Pagado" },
  MORA: { status: "mora", label: "Mora" },
  ANULADO: { status: "ruta-cerrada", label: "Anulado" },
};

function EstadoBadge({ estado }: { estado: CreditoListItem["estado"] }) {
  const cfg = ESTADO_BADGE[estado];
  return <Badge status={cfg.status}>{cfg.label}</Badge>;
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-h3 font-semibold tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
