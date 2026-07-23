"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import type { CreditoListItem, Pago } from "@repo/types";

import { ESTADO_CLIENTE_LABEL } from "@/entities/client";
import { useCliente } from "@/features/clients/api/use-clientes";
import { getInitials } from "@/shared/lib/initials";
import { formatCurrency } from "@/shared/lib/format-currency";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { WhatsAppIcon } from "@/shared/ui/icons/whatsapp-icon";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { Skeleton } from "@/shared/ui/skeleton";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/shared/ui/tabs";
import { CollectorHero } from "@/widgets/collector-shell/CollectorHero";

import { RegistrarCobroSheet } from "./RegistrarCobroSheet";

// DESIGN_SYSTEM.md §3.5 / #16c — pagos del cliente
// (/collector/routes/payments/[id]). Hero de marca con avatar + estado,
// tarjeta superpuesta con el resumen general (anillo de avance + saldo
// pendiente total) y, debajo, Tabs Activos/Historial: "Activos" repite el
// patrón de tarjeta independiente por crédito (con su propio botón
// "Registrar cobro"); "Historial" lista TODOS los pagos, enriquecidos con
// producto/nº de cuota/referencia — deja el terreno listo para los recibos
// de la Fase 4 (los botones Descargar/Compartir ya están, pero avisan que el
// archivo llega en esa fase mientras `pago.reciboUrl` sea null). Reusa
// `useCliente(id)` — el mismo hook real que el Admin (5c), ya scoped por
// cobrador en el backend (`GET /clients/:id` con `ruta.cobradorId = user.sub`
// para rol COBRADOR).

interface PagoEnriquecido extends Pago {
  producto: string;
  cuotaNumero: number;
  cuotasTotal: number;
  referencia: string;
}

export function ClientPaymentsScreen() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const { data: cliente, isLoading } = useCliente(clienteId);

  // Enriquece cada pago con el producto y el nº de cuota de SU crédito: se
  // agrupa por creditoId, se ordena cada grupo por fecha (ascendente) para
  // numerar las cuotas, y se aplana de nuevo ordenado descendente (recientes
  // primero). La "referencia" es sintética (código del crédito + cuota) —
  // sirve de identificador legible hasta que exista un recibo real.
  const historialEnriquecido = useMemo<PagoEnriquecido[]>(() => {
    if (!cliente) return [];
    const creditos = [...cliente.creditosActivos, ...cliente.creditosHistorial];
    const creditoPorId = new Map(creditos.map((c) => [c.id, c]));

    const porCredito = new Map<string, Pago[]>();
    for (const pago of cliente.historialPagos ?? []) {
      const lista = porCredito.get(pago.creditoId) ?? [];
      lista.push(pago);
      porCredito.set(pago.creditoId, lista);
    }

    const enriquecidos: PagoEnriquecido[] = [];
    for (const [creditoId, pagos] of porCredito) {
      const credito = creditoPorId.get(creditoId);
      const ordenados = [...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
      ordenados.forEach((pago, i) => {
        const cuotaNumero = i + 1;
        enriquecidos.push({
          ...pago,
          producto: credito?.producto ?? "Crédito",
          cuotaNumero,
          cuotasTotal: credito?.cuotasTotal ?? 0,
          referencia: `${credito?.codigo ?? "CR"}-${String(cuotaNumero).padStart(2, "0")}`,
        });
      });
    }
    return enriquecidos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [cliente]);

  if (isLoading || !cliente) {
    return (
      <div className="flex flex-col pb-6">
        <CollectorHero title="Cliente" backHref="/collector" />
        <div className="relative z-10 -mt-9 flex flex-col gap-3 px-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const creditosActivos = cliente.creditosActivos;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <CollectorHero
        title={cliente.nombre}
        backHref={`/collector/routes/${cliente.rutaId}`}
        avatar={
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-semibold">
            {getInitials(cliente.nombre)}
          </span>
        }
        badge={
          cliente.estado ? (
            <span className="w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
              {ESTADO_CLIENTE_LABEL[cliente.estado]}
            </span>
          ) : undefined
        }
      />

      {/* Resumen general superpuesto al hero (screenshot 16c). */}
      <div className="relative z-10 -mt-9 px-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-md">
          <ProgressRing value={cliente.porcentajePagado ?? 0} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="text-h1 font-bold tabular-nums">
              {formatCurrency(cliente.saldoPendiente ?? 0)}
            </span>
            <span className="text-body-sm text-muted-foreground">saldo pendiente</span>
          </div>
        </div>
      </div>

      <div className="px-4">
        <TabsRoot defaultValue="activos">
          <TabsList>
            <TabsTrigger value="activos">Activos ({creditosActivos.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial ({historialEnriquecido.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            <div className="flex flex-col gap-3">
              {creditosActivos.length === 0 ? (
                <EmptyState text="Este cliente no tiene créditos activos." />
              ) : (
                creditosActivos.map((credito) => (
                  <CreditoCard key={credito.id} credito={credito} clienteNombre={cliente.nombre} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="historial">
            <div className="flex flex-col gap-2">
              {historialEnriquecido.length === 0 ? (
                <EmptyState text="Este cliente todavía no tiene pagos registrados." />
              ) : (
                historialEnriquecido.map((pago) => <PagoRow key={pago.id} pago={pago} />)
              )}
            </div>
          </TabsContent>
        </TabsRoot>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <p className="text-body-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function CreditoCard({
  credito,
  clienteNombre,
}: {
  credito: CreditoListItem;
  clienteNombre: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <ProgressRing value={credito.porcentajePagado ?? 0} size="mini" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{credito.producto}</span>
          <span className="truncate text-caption text-muted-foreground">
            {formatCurrency(credito.cuotaDiaria)}/día · {credito.cuotasPagadas}/{credito.cuotasTotal}{" "}
            cuotas
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-sm font-bold tabular-nums">
            {formatCurrency(credito.saldoPendiente)}
          </span>
          <span className="text-caption text-muted-foreground">saldo</span>
        </div>
      </div>

      <RegistrarCobroSheet
        creditos={[credito]}
        clienteNombre={clienteNombre}
        creditoPreseleccionado={credito}
      >
        <Button
          size="lg"
          className={cn(
            "w-full bg-gradient-to-r from-primary to-accent text-primary-foreground",
            "hover:opacity-95",
          )}
        >
          Registrar cobro
        </Button>
      </RegistrarCobroSheet>
    </div>
  );
}

// Fila de pago del historial: producto + nº de cuota + fecha + referencia, y
// las acciones de recibo. `pago.reciboUrl` siempre es null en Fase 3 — los
// botones ya están listos para cuando la Fase 4 lo empiece a llenar.
function PagoRow({ pago }: { pago: PagoEnriquecido }) {
  function handleDescargar() {
    if (pago.reciboUrl) {
      window.open(pago.reciboUrl, "_blank");
    } else {
      toast.info("El recibo estará disponible cuando se generen en la Fase 4.");
    }
  }

  function handleCompartir() {
    if (pago.reciboUrl) {
      const texto = `Recibo de pago · ${pago.producto} · Cuota ${pago.cuotaNumero}/${pago.cuotasTotal} · ${formatCurrency(pago.monto)}\n${pago.reciboUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    } else {
      toast.info("Compartir estará disponible cuando se generen los recibos (Fase 4).");
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{pago.producto}</span>
        <span className="truncate text-caption text-muted-foreground">
          Cuota {pago.cuotaNumero}/{pago.cuotasTotal} · {fmtFecha(pago.fecha)}
        </span>
        <span className="truncate text-caption text-muted-foreground/70">Ref. {pago.referencia}</span>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(pago.monto)}</span>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Descargar recibo"
          onClick={handleDescargar}
        >
          <DownloadIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Compartir recibo"
          onClick={handleCompartir}
        >
          <WhatsAppIcon className="size-4" />
        </Button>
      </div>
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
