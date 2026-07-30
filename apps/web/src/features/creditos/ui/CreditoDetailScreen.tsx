"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { CreditoDetail, CreditoListItem } from "@repo/types";

import { CUOTA_LABEL, upcomingInstallments } from "@/entities/credit";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ApiError } from "@/shared/api/client";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AdminPageHeader } from "@/widgets/admin-shell/AdminPageHeader";
import { PageActions } from "@/widgets/admin-shell/PageActions";

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
        <AdminPageHeader backHref="/admin/clients" eyebrow="Créditos" title="Detalle del crédito" />
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
        backHref={`/admin/clients/${credito.clienteId}`}
        eyebrow={`Créditos / ${credito.codigo}`}
        title="Detalle del crédito"
        actions={
          // `PageActions` en vez de botones sueltos: tres acciones con texto no
          // caben en el header de un teléfono, y acá colapsan al menú "…".
          <PageActions
            actions={[
              {
                id: "ver-cliente",
                label: "Ver cliente",
                icon: <UserIcon />,
                href: `/admin/clients/${credito.clienteId}`,
              },
              {
                id: "editar",
                label: "Editar",
                icon: <PencilIcon />,
                href: `/admin/credits/${credito.id}/edit`,
                disabled: tienePagos || credito.estado !== "ACTIVO",
                disabledReason: tienePagos
                  ? "No se puede editar un crédito con pagos."
                  : "Solo se editan créditos activos.",
              },
              {
                id: "anular",
                label: "Anular",
                icon: <Trash2Icon />,
                variant: "destructive",
                onSelect: () => setConfirmOpen(true),
                disabled: credito.estado === "ANULADO",
                disabledReason: "Este crédito ya está anulado.",
              },
            ]}
          />
        }
      />

      <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
        <CreditoHero credito={credito} />
        <CreditoStats credito={credito} />
        <ProximasCuotasCard credito={credito} />
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

// === Hero: anillo + identidad ==============================================
// El bloque azul del prototipo #10a se movió al AdminPageHeader, que ahora es
// el degradado de toda la superficie Admin. Acá queda el anillo, que es lo que
// el bloque azul realmente aportaba.
function CreditoHero({ credito }: { credito: CreditoDetail }) {
  const porcentaje = Math.min(100, Math.max(0, Math.round(credito.porcentajePagado)));
  const rutaNombre = credito.cliente.ruta?.nombre ?? null;

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="relative inline-flex shrink-0 items-center justify-center">
        <ProgressRing value={porcentaje} size="hero" showLabel={false} />
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums">{porcentaje}%</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Pagado
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-h2 font-semibold">{credito.producto}</span>
          <EstadoBadge estado={credito.estado} />
        </div>
        <span className="text-body-sm text-muted-foreground tabular-nums">
          #{credito.codigo} · {credito.cuotasPagadas} de {credito.cuotasTotal} cuotas
        </span>
        {/* Envuelve en vez de truncar: en móvil es el único sitio donde se ven
            el cliente y su ruta. */}
        <span className="flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted-foreground">
          <span>{credito.cliente.nombre}</span>
          {rutaNombre ? (
            <>
              <span aria-hidden>·</span>
              <span>{rutaNombre}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>inicio {formatDate(credito.fechaInicio)}</span>
        </span>
      </div>
    </div>
  );
}

// === Tira de cifras ========================================================
function CreditoStats({ credito }: { credito: CreditoDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Monto total" value={formatCurrency(credito.montoTotal)} />
      <StatTile
        label="Pagado"
        value={formatCurrency(credito.totalPagado)}
        valueClassName="text-success"
      />
      <StatTile label="Saldo" value={formatCurrency(credito.saldoPendiente)} />
      <StatTile
        label={CUOTA_LABEL[credito.frecuencia]}
        value={formatCurrency(credito.cuotaDiaria)}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="truncate text-caption uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("truncate text-h3 font-semibold tabular-nums", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

// === Próximas cuotas =======================================================
// Proyección de lectura (`upcomingInstallments`): el contrato de
// `GET /credits/:id` trae los pagos hechos, no el cronograma futuro.
function ProximasCuotasCard({ credito }: { credito: CreditoDetail }) {
  const { items, restantes, ultima } = upcomingInstallments(credito);

  if (credito.estado !== "ACTIVO" && credito.estado !== "MORA") return null;
  if (restantes === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold">Próximas cuotas</h2>
        <span className="text-caption text-muted-foreground tabular-nums">
          {restantes} {restantes === 1 ? "resta" : "restan"}
        </span>
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
        {items.map((cuota) => (
          <div
            key={cuota.numero}
            className={cn(
              "flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
              cuota.esHoy && "bg-primary/10",
            )}
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                Cuota {cuota.numero}
                {cuota.esHoy ? " · hoy" : ""}
              </span>
              <span className="truncate text-caption text-muted-foreground">
                {formatDate(cuota.fechaVencimiento)}
              </span>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCurrency(cuota.monto)}
            </span>
          </div>
        ))}

        {ultima ? (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2.5">
            <span className="truncate text-caption text-muted-foreground">
              Última cuota (#{ultima.numero})
            </span>
            <span className="shrink-0 text-caption text-muted-foreground">
              {formatDate(ultima.fechaVencimiento)}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// === Pagos registrados =====================================================
// Dos presentaciones del mismo dato (DESIGN_SYSTEM.md §2.5): filas en móvil,
// tabla desde `md`, donde caben cobrador y estado en columnas propias.
function PagosCard({ credito }: { credito: CreditoDetail }) {
  const total = credito.pagos.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold">Pagos registrados</h2>
        <span className="text-caption text-muted-foreground tabular-nums">
          {total} {total === 1 ? "pago" : "pagos"}
        </span>
      </div>

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-body-sm text-muted-foreground">
          Este crédito aún no tiene pagos.
        </p>
      ) : (
        <>
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card md:hidden">
            {credito.pagos.map((pago, i) => (
              <div
                key={pago.id}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium tabular-nums">
                    #{total - i} · {formatDate(pago.fecha)}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {pago.cobradorNombre ?? "Sin cobrador"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(pago.monto)}
                  </span>
                  <Badge status="activo">Pagado</Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
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
                    {formatDate(pago.fecha)}
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
        </>
      )}
    </section>
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

