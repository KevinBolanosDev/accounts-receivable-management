"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { ESTADO_CLIENTE_LABEL, ESTADO_CLIENTE_TEXT, getInitials } from "@/entities/client";
import { formatCompactCurrency, formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useRuta } from "../api/use-rutas";

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
  const { data: ruta, isLoading } = useRuta(rutaId);

  if (isLoading || !ruta) {
    return (
      <>
        <AdminPageHeader eyebrow="Rutas" title="Detalle de ruta" />
        <div className="p-4 sm:p-6">
          <Skeleton className="h-64 w-full" />
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
          <Button asChild variant="secondary">
            <Link href={`/admin/routes-collectors/${ruta.id}/edit`}>
              <PencilIcon />
              Editar ruta
            </Link>
          </Button>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
