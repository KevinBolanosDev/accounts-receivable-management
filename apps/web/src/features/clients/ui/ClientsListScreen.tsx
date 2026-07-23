"use client";

import { useState } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import type { ClienteDetail, ClienteListItem } from "@repo/types";

import { ESTADO_CLIENTE_LABEL_SHORT, getInitials } from "@/entities/client";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { useRutas } from "@/features/routes-collectors/api/use-rutas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";

import { useCliente, useClientes } from "../api/use-clientes";

function rutaCorta(nombre: string | undefined): string {
  return nombre?.split("·")[0]?.trim() ?? "Sin ruta";
}

function ClientRow({
  cliente,
  selected,
  onSelect,
}: {
  cliente: ClienteListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/10"
          : "border-transparent hover:bg-muted",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
        {getInitials(cliente.nombre)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{cliente.nombre}</span>
        <span className="truncate text-caption text-muted-foreground">
          {rutaCorta(cliente.ruta?.nombre)} · {formatCurrency(cliente.saldoPendiente ?? 0)}
        </span>
      </div>
      {cliente.estado ? (
        <Badge status={cliente.estado}>{ESTADO_CLIENTE_LABEL_SHORT[cliente.estado]}</Badge>
      ) : null}
    </button>
  );
}

function ClientPreview({ cliente }: { cliente: ClienteDetail }) {
  const credito = cliente.creditosActivos[0] ?? null;
  const ultimosPagos = (cliente.historialPagos ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
          {getInitials(cliente.nombre)}
        </span>
        <div className="flex flex-col">
          <span className="text-h3 font-semibold">{cliente.nombre}</span>
          <span className="text-body-sm text-muted-foreground">
            {cliente.documento} · {cliente.ruta?.nombre ?? "Sin ruta"}
          </span>
        </div>
      </div>

      {credito ? (
        <div className="flex items-center gap-5 rounded-lg border border-border bg-background p-5">
          <ProgressRing value={credito.porcentajePagado} size="md" />
          <div className="flex flex-1 flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Producto</span>
              <span className="font-medium">{credito.producto}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo pendiente</span>
              <span className="font-semibold tabular-nums">{formatCurrency(credito.saldoPendiente)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cuotas</span>
              <span className="tabular-nums">
                {credito.cuotasPagadas} / {credito.cuotasTotal} pagadas
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="mb-1 text-caption text-muted-foreground uppercase">Últimos pagos</p>
        {ultimosPagos.map((pago) => (
          <div
            key={`${pago.creditoId}-${pago.fecha}-${pago.monto}`}
            className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
          >
            <span className="text-sm text-muted-foreground">{pago.fecha}</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(pago.monto)}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex gap-3">
        <Button asChild className="flex-1">
          <Link href={`/admin/clients/${cliente.id}`}>Ver detalle completo</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/clients/${cliente.id}/edit`}>Editar</Link>
        </Button>
      </div>
    </div>
  );
}

export function ClientsListScreen() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState("all");
  const { data: rutas = [] } = useRutas();
  const { data: clientes, isLoading } = useClientes({
    ...(search ? { search } : {}),
    ...(routeId !== "all" ? { rutaId: routeId } : {}),
  });

  const activeId = selectedId ?? clientes?.[0]?.id ?? "";
  const { data: cliente } = useCliente(activeId);

  return (
    <>
      <AdminPageHeader
        title="Clientes"
        subtitle="142 clientes · 7 rutas"
        actions={
          <Button asChild>
            <Link href="/admin/clients/new">Nuevo cliente</Link>
          </Button>
        }
      />

      <div className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        {/* Maestro: buscador + lista */}
        <div className="flex flex-col gap-4">
          <div className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
           </div>

           <Select value={routeId} onValueChange={setRouteId}>
             <SelectTrigger>
               <SelectValue placeholder="Todas las rutas" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Todas las rutas</SelectItem>
               {rutas.map((route) => (
                 <SelectItem key={route.id} value={route.id}>
                   {route.nombre}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>

           <div className="overflow-hidden rounded-lg border border-border bg-card">
             {isLoading ? (

              <div className="flex flex-col gap-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : clientes && clientes.length > 0 ? (
              <div className="flex flex-col divide-y divide-border">
                {clientes.map((c) => (
                  <ClientRow
                    key={c.id}
                    cliente={c}
                    selected={c.id === activeId}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-body-sm text-muted-foreground">
                Sin resultados para “{search}”.
              </p>
            )}
          </div>
        </div>

        {/* Detalle: vista previa del cliente seleccionado */}
        <div className="flex flex-col rounded-lg border border-border bg-card p-6">
          {cliente ? (
            <ClientPreview cliente={cliente} />
          ) : (
            <p className="m-auto text-body-sm text-muted-foreground">
              Selecciona un cliente para ver su información.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
