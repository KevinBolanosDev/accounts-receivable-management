"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ESTADO_CLIENTE_LABEL, getInitials } from "@/entities/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
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
import { ProgressBar } from "@/shared/ui/progress-bar";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useCliente, useDeleteCliente } from "../api/use-clientes";

function StatCard({
  label,
  value,
  sub,
  subClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5">
      <span className="text-caption text-muted-foreground uppercase">{label}</span>
      <span className="text-h1 font-semibold tabular-nums">{value}</span>
      {sub ? <span className={cn("text-body-sm text-muted-foreground", subClassName)}>{sub}</span> : null}
    </div>
  );
}

export function ClientDetailScreen({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const { data: cliente, isLoading } = useCliente(clienteId);
  const deleteCliente = useDeleteCliente();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading || !cliente) {
    return (
      <>
        <AdminPageHeader eyebrow="Clientes" title="Detalle de cliente" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  const credito = cliente.creditosActivos[0] ?? null;

  async function handleDelete() {
    try {
      await deleteCliente.mutateAsync(clienteId);
      toast.success("Cliente eliminado");
      router.push("/admin/clients");
    } catch {
      toast.error("No se pudo eliminar el cliente");
    }
  }

  return (
    <>
      <AdminPageHeader eyebrow={`Clientes / ${cliente.nombre}`} title="Detalle de cliente" />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {/* Identidad + acciones */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
              {getInitials(cliente.nombre)}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-h2 font-semibold">{cliente.nombre}</span>
                {cliente.estado ? (
                  <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
                ) : null}
              </div>
              <span className="text-body-sm text-muted-foreground">
                {cliente.ruta?.nombre ?? "Sin ruta"} · Cobrador {cliente.cobradorNombre ?? "Sin asignar"} ·
                Doc {cliente.documento}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link href={`/admin/clients/${cliente.id}/edit`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
            <Button variant="secondary" className="text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Tira de métricas */}
        {credito ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Saldo pendiente"
              value={formatCurrency(credito.saldoPendiente)}
              sub={`de ${formatCurrency(credito.montoTotal)}`}
            />
            <StatCard
              label="Cuota diaria"
              value={formatCurrency(credito.cuotaDiaria)}
              sub="Cobro diario"
            />
            <StatCard
              label="Cuotas restantes"
              value={String(credito.cuotasTotal - credito.cuotasPagadas)}
              sub={`${credito.cuotasPagadas} de ${credito.cuotasTotal} pagadas`}
            />
            <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
              <ProgressRing value={credito.porcentajePagado} size="md" />
              <div className="flex flex-col">
                <span className="text-caption text-muted-foreground uppercase">Avance</span>
                <span className="text-body-sm text-muted-foreground">Pagado del crédito total</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Crédito + historial */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Crédito activo */}
          <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
            <p className="text-caption text-muted-foreground uppercase">Crédito activo</p>
            {credito ? (
              <>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-5">
                <PackageIcon />
              </span>
              <div className="flex flex-col">
                <span className="text-h3 font-semibold">{credito.producto.nombre}</span>
                <span className="text-caption text-muted-foreground">
                  Crédito {credito.codigo} · abierto {credito.fechaInicio}
                </span>
              </div>
            </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Progreso</span>
                    <span className="text-sm font-medium text-accent tabular-nums">
                      {credito.porcentajePagado}% pagado
                    </span>
                  </div>
                  <ProgressBar value={credito.porcentajePagado} />
                </div>

                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monto total</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(credito.montoTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total pagado</span>
                    <span className="font-semibold text-success tabular-nums">
                      {formatCurrency(credito.totalPagado)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo pendiente</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(credito.saldoPendiente)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-body-sm text-muted-foreground">Este cliente no tiene un crédito activo.</p>
            )}
          </div>

          {/* Historial de pagos */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-caption text-muted-foreground uppercase">Historial de pagos</p>
              {credito ? (
                <span className="text-caption text-muted-foreground">{credito.cuotasPagadas} pagos</span>
              ) : null}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cliente.historialPagos ?? []).map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(pago.fecha).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(pago.monto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar cliente?</DialogTitle>
            <DialogDescription>
              Se eliminará a {cliente.nombre}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={deleteCliente.isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
