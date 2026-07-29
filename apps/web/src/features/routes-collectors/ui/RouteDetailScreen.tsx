"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { ESTADO_CLIENTE_LABEL, ESTADO_CLIENTE_TEXT, getInitials } from "@/entities/client";
import { ApiError } from "@/shared/api/client";
import { formatCompactCurrency, formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";
import { PageActions } from "@/widgets/admin-shell/PageActions";

import { useDeleteRuta, useRuta, useUnassignClienteFromRuta } from "../api/use-rutas";

function KpiRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

export function RouteDetailScreen({ rutaId }: { rutaId: string }) {
  const router = useRouter();
  const { data: ruta, isLoading, isError } = useRuta(rutaId);
  const unassignCliente = useUnassignClienteFromRuta(rutaId);
  const deleteRuta = useDeleteRuta();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleQuitar(clienteId: string) {
    setRemovingId(clienteId);
    unassignCliente.mutate(clienteId, {
      onSettled: () => setRemovingId(null),
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : "No se pudo quitar el cliente de la ruta.",
        ),
    });
  }

  async function handleDelete() {
    try {
      await deleteRuta.mutateAsync(rutaId);
      toast.success("Ruta eliminada");
      router.push("/admin/routes-collectors");
    } catch (error) {
      // El 409 del backend explica POR QUÉ no se puede ("tiene N clientes
      // asignados"). El botón ya lo previene, pero otra pestaña puede haber
      // asignado un cliente entre el render y el click.
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar la ruta");
    }
  }

  if (isLoading) {
    return (
      <>
        <AdminPageHeader eyebrow="Rutas" title="Detalle de ruta" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  // Igual que en el detalle de cliente: una ruta borrada (404) no debe dejar
  // la pantalla en Skeleton para siempre.
  if (isError || !ruta) {
    return (
      <>
        <AdminPageHeader eyebrow="Rutas" title="Detalle de ruta" />
        <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">Esta ruta no existe o fue eliminada</p>
            <p className="text-caption text-muted-foreground">
              Puede que la hayas eliminado desde otra pestaña.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin/routes-collectors">Volver a Rutas</Link>
          </Button>
        </div>
      </>
    );
  }

  const abierta = ruta.estadoDia === "abierta";

  return (
    <>
      <AdminPageHeader
        eyebrow={`Rutas / ${ruta.nombre}`}
        title="Detalle de ruta"
        actions={
          <PageActions
            actions={[
              {
                id: "edit",
                label: "Editar ruta",
                icon: <PencilIcon />,
                href: `/admin/routes-collectors/${ruta.id}/edit`,
              },
              {
                id: "delete",
                label: "Eliminar ruta",
                icon: <Trash2Icon />,
                variant: "destructive",
                // Se deshabilita en vez de dejar que falle con 409: el usuario
                // sabe qué hacer antes de intentarlo.
                disabled: ruta.clientesCount > 0,
                disabledReason:
                  ruta.clientesCount > 0
                    ? `Reasigna sus ${ruta.clientesCount} cliente(s) primero`
                    : undefined,
                onSelect: () => setConfirmOpen(true),
              },
            ]}
          />
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Columna izquierda */}
        <div className="flex flex-col gap-4">
          {/* Tarjeta de cobrador */}
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-secondary text-xl font-semibold">
              {ruta.cobrador ? getInitials(ruta.cobrador.nombre) : "—"}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-h3 font-semibold">{ruta.nombre}</span>
              <span className="text-body-sm text-muted-foreground">
                Cobrador {ruta.cobrador?.nombre ?? "Sin asignar"}
              </span>
            </div>
            <Badge status={abierta ? "ruta-abierta" : "ruta-cerrada"}>
              {abierta ? `Abierta · ${ruta.avanceDelDia}% del día` : "Cerrada"}
            </Badge>
          </div>

          {/* KPIs */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
            <KpiRow label="Clientes" value={String(ruta.clientesCount)} />
            <KpiRow label="Cobrado hoy" value={formatCurrency(ruta.cobradoHoy)} />
            <KpiRow label="En mora" value={String(ruta.enMora)} valueClassName="text-destructive" />
            <KpiRow label="Saldo total" value={formatCompactCurrency(ruta.saldoTotal)} />
          </div>

          {/* Histórico de cierres */}
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5">
            <p className="mb-2 text-caption text-muted-foreground uppercase">Histórico de cierres</p>
            {ruta.cierres.map((cierre) => (
              <div
                key={cierre.fecha}
                className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
              >
                <span className="text-sm text-muted-foreground">{cierre.fecha}</span>
                <span className="text-sm font-medium tabular-nums">{formatCurrency(cierre.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha: clientes de la ruta */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground uppercase">Clientes de la ruta</p>
            <span className="text-caption text-muted-foreground">Ordenado por estado</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Avance</TableHead>
                <TableHead className="text-right">Estado</TableHead>
                <TableHead className="text-right">Quitar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruta.clientes.map((cliente) => (
                <TableRow
                  key={cliente.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/clients/${cliente.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                        {getInitials(cliente.nombre)}
                      </span>
                      <span className="font-medium">{cliente.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {cliente.saldoPendiente != null ? formatCurrency(cliente.saldoPendiente) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      cliente.estado ? ESTADO_CLIENTE_TEXT[cliente.estado] : "",
                    )}
                  >
                    {cliente.porcentajePagado != null ? `${cliente.porcentajePagado}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {cliente.estado ? (
                      <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL[cliente.estado]}</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${cliente.nombre} de la ruta`}
                          loading={removingId === cliente.id}
                          onClick={() => handleQuitar(cliente.id)}
                        >
                          <XIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Quitar de la ruta</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Único borrado FÍSICO del sistema (clientes y cobradores son soft-delete),
          así que exige escribir el nombre: no hay forma de deshacerlo. */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Eliminar ruta?"
        description={`La ruta "${ruta.nombre}" se eliminará definitivamente.`}
        warning="Esta acción no se puede deshacer."
        confirmLabel="Eliminar ruta"
        variant="destructive"
        loading={deleteRuta.isPending}
        confirmPhrase={ruta.nombre}
        confirmPhraseLabel={`Escribe "${ruta.nombre}" para confirmar`}
        onConfirm={handleDelete}
      />
    </>
  );
}
