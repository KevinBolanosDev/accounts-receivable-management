"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { CreditoListItem } from "@repo/types";

import { CreditCard } from "@/entities/credit";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useAnularCredito, useCredito } from "../api/use-creditos";

// DESIGN_SYSTEM.md §3.3 — pantalla Detalle crédito (Admin, #10a).
// CreditCard hero (anillo + saldo display + badge) + tabla de pagos +
// acciones Editar (deshabilitada si el crédito ya tiene pagos) y Anular
// (soft-delete del service con confirmación).

export function CreditoDetailScreen({ creditoId }: { creditoId: string }) {
  const router = useRouter();
  const { data: credito, isLoading } = useCredito(creditoId);
  const anular = useAnularCredito();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const tienePagos = useMemo(
    () => (credito?.pagos?.length ?? 0) > 0,
    [credito?.pagos],
  );

  if (isLoading || !credito) {
    return (
      <>
        <AdminPageHeader eyebrow="Créditos" title="Detalle de crédito" />
        <div className="flex flex-col gap-4 p-4 sm:p-6">
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
    } catch {
      toast.error("No se pudo anular el crédito");
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow={`Créditos / ${credito.codigo}`}
        title={`Crédito ${credito.codigo}`}
        subtitle={`${credito.producto.nombre} · ${credito.cliente.nombre}`}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={tienePagos || credito.estado !== "ACTIVO"}
              title={
                tienePagos
                  ? "No se puede editar un crédito con pagos."
                  : "Editar crédito"
              }
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
        <CreditCard credito={credito} clienteNombre={credito.cliente.nombre} />

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <p className="text-caption text-muted-foreground uppercase">Resumen</p>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Row label="Producto" value={credito.producto.nombre} />
            <Row label="Monto total" value={formatCurrency(credito.montoTotal)} />
            <Row label="Total pagado" value={formatCurrency(credito.totalPagado)} />
            <Row label="Saldo pendiente" value={formatCurrency(credito.saldoPendiente)} />
            <Row label="Cuota diaria" value={formatCurrency(credito.cuotaDiaria)} />
            <Row
              label="Cuotas"
              value={`${credito.cuotasPagadas} / ${credito.cuotasTotal}`}
            />
            <Row
              label="Estado"
              value={<EstadoBadge estado={credito.estado} />}
            />
            <Row
              label="Inicio"
              value={new Date(credito.fechaInicio).toLocaleDateString("es-CO")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground uppercase">Pagos</p>
            <span className="text-caption text-muted-foreground">
              {credito.pagos.length} registros
            </span>
          </div>
          {credito.pagos.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              Este crédito aún no tiene pagos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Recibo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credito.pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(pago.fecha).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(pago.monto)}
                    </TableCell>
                    <TableCell className="text-right">
                      {pago.reciboUrl ? (
                        <Link
                          href={pago.reciboUrl}
                          className="text-primary underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver recibo
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Anular crédito?</DialogTitle>
            <DialogDescription>
              {credito.estado === "ANULADO"
                ? "Este crédito ya está anulado."
                : `El crédito ${credito.codigo} quedará anulado (no se borra); sus pagos siguen siendo auditables.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={anular.isPending}
              disabled={credito.estado === "ANULADO"}
              onClick={handleAnular}
            >
              Anular crédito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
