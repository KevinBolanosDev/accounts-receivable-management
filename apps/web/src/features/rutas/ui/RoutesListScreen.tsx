"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon, MapPinIcon, PlusIcon, UserIcon } from "lucide-react";
import type { RutaListItem } from "@repo/types";

import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { MetricCard } from "@/shared/ui/metric-card";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useRutas, useRutasSummary } from "../api/use-rutas";

function avanceColor(value: number): string {
  if (value >= 100) return "text-success";
  if (value < 50) return "text-warning";
  return "text-accent";
}

function RutaRow({ ruta }: { ruta: RutaListItem }) {
  const router = useRouter();
  const sinAbrir = ruta.totalCobradoHoy === 0 && ruta.estadoDia === "cerrada";

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/admin/routes-collectors/${ruta.id}`)}
    >
      <TableCell className="font-medium">{ruta.nombre}</TableCell>
      <TableCell className="text-muted-foreground">{ruta.cobrador?.nombre ?? "Sin asignar"}</TableCell>
      <TableCell className="tabular-nums">{ruta.clientesCount}</TableCell>
      <TableCell className="tabular-nums">
        {sinAbrir ? (
          <span className="text-muted-foreground">Sin abrir</span>
        ) : (
          formatCurrency(ruta.totalCobradoHoy)
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <ProgressBar value={ruta.avanceDelDia} className="w-24" />
          <span className={cn("w-9 text-right text-sm font-medium tabular-nums", avanceColor(ruta.avanceDelDia))}>
            {ruta.avanceDelDia}%
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Badge status={ruta.estadoDia === "abierta" ? "ruta-abierta" : "ruta-cerrada"}>
          {ruta.estadoDia === "abierta" ? "Abierta" : "Cerrada"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function RoutesListScreen() {
  const { data: rutas, isLoading } = useRutas();
  const { data: summary } = useRutasSummary();

  return (
    <>
      <AdminPageHeader
        eyebrow="Rutas"
        title="Rutas"
        actions={
          <Button asChild>
            <Link href="/admin/routes-collectors/new">
              <PlusIcon />
              Nueva ruta
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            tone="success"
            icon={<MapPinIcon />}
            label="Rutas abiertas"
            value={summary?.rutasAbiertas ?? "—"}
            sub={summary ? `de ${summary.rutasTotal}` : undefined}
          />
          <MetricCard
            tone="primary"
            icon={<BanknoteIcon />}
            label="Cobrado hoy"
            value={summary ? formatCurrency(summary.cobradoHoy) : "—"}
          />
          <MetricCard
            tone="primary"
            icon={<UserIcon />}
            label="Clientes en ruta"
            value={summary?.clientesEnRuta ?? "—"}
          />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ruta</TableHead>
                <TableHead>Cobrador</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Cobrado hoy</TableHead>
                <TableHead>Avance del día</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : rutas?.map((ruta) => <RutaRow key={ruta.id} ruta={ruta} />)}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
