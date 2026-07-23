"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";

import { CreditCard } from "@/entities/credit";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";

import { useRutaHoy } from "../api/use-cobros";
import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// DESIGN_SYSTEM.md §3.5 — Detalle cliente móvil (#16c) + registrar cobro.
// Header con resumen del cliente (nombre, saldo agregado, anillo mediano) +
// CreditCard compacta por crédito activo + botón "Registrar cobro" que abre
// el bottom sheet (3.5).

export function ClienteDetalleCollectorScreen() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const { data: items, isLoading } = useRutaHoy();

  const cliente = useMemo(
    () => (items ?? []).find((c) => c.id === clienteId),
    [items, clienteId],
  );

  if (isLoading || !cliente) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const creditosActivos = cliente.creditos.filter(
    (c) => c.estado === "ACTIVO" || c.estado === "MORA",
  );
  const saldoAgregado = creditosActivos.reduce(
    (sum, c) => sum + c.saldoPendiente,
    0,
  );
  const montoTotal = creditosActivos.reduce((sum, c) => sum + c.montoTotal, 0);
  const porcentaje =
    montoTotal > 0
      ? Math.round(((montoTotal - saldoAgregado) / montoTotal) * 100)
      : 0;
  const cuotaSugerida = creditosActivos[0]?.cuotaDiaria ?? 0;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          href="/collector"
          aria-label="Volver a Mi ruta"
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="truncate text-lg font-semibold">{cliente.nombre}</h1>
        <span className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
          {getInitials(cliente.nombre)}
        </span>
      </header>

      <section className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <ProgressRing value={porcentaje} size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption text-muted-foreground uppercase">
              Saldo pendiente
            </span>
            <span className="text-display tabular-nums">
              {formatCurrency(saldoAgregado)}
            </span>
            <span className="text-caption text-muted-foreground">
              Cuota diaria sugerida: {formatCurrency(cuotaSugerida)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cliente.estado ? (
            <Badge status={cliente.estado}>
              {cliente.estado === "mora" ? "En mora" : "Activo"}
            </Badge>
          ) : null}
          <span className="text-caption text-muted-foreground">
            {creditosActivos.length} crédito{creditosActivos.length === 1 ? "" : "s"} activo
            {creditosActivos.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3 px-4">
        <p className="text-caption text-muted-foreground uppercase">Créditos</p>
        {creditosActivos.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">
            Este cliente no tiene créditos activos.
          </p>
        ) : (
          creditosActivos.map((credito) => (
            <CreditCard
              key={credito.id}
              credito={credito}
              density="compact"
              clienteNombre={cliente.nombre}
            />
          ))
        )}
      </section>

      {/* === Sub-fase 3.5 — "Nuevo crédito" desde la ruta =============
          El cobrador puede crear un cliente nuevo o agregarle crédito a uno
          existente. Para el alta de cliente se reutiliza el flujo #17c (en
          app/(collector)/collector/(shell)/clients/new). Aquí dejamos visible
          el atajo a "Agregar crédito" (futuro 3.5 — sub-flujo móvil). */}
      <section className="flex flex-col gap-2 px-4">
        <Link
          href="/collector/clients/new"
          className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card p-4 text-sm"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PlusIcon className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">Nuevo cliente en la calle</span>
              <span className="text-caption text-muted-foreground">
                Reutiliza la cámara del alta de cliente.
              </span>
            </span>
          </span>
          <span aria-hidden className="text-primary">→</span>
        </Link>
      </section>

      <div className="fixed bottom-16 left-0 right-0 z-10 mx-auto flex max-w-md gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
        <RegistrarCobroSheet
          creditos={creditosActivos}
          creditoPreseleccionado={
            creditosActivos.length === 1 ? creditosActivos[0] : undefined
          }
        >
          <Button size="lg" className="w-full">
            Registrar cobro
          </Button>
        </RegistrarCobroSheet>
      </div>
    </div>
  );
}
