"use client";

import type { ClientCreditListItem } from "@repo/types";

import { CreditSummaryCard } from "@/entities/credit";
import { useClientSessionStore } from "@/entities/session";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDateShort } from "@/shared/lib/format-date";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/shared/ui/tabs";

import { useMyCredits } from "../api/use-client-portal";

// DESIGN_SYSTEM.md §5.2 (revisado) — "Mis créditos": pantalla NUEVA que no
// estaba en el prototipo de 21 pantallas. El prototipo original asumía 1
// crédito por cliente en #21c; Fase 3 soporta N créditos activos, así que
// esta lista antecede al detalle (#21c, `ClientCreditDetailScreen`).
//
// La tarjeta es `CreditSummaryCard` de `entities/credit`, la misma que usa la
// pestaña Historial del Cobrador.
export function ClientCreditsListScreen() {
  const cliente = useClientSessionStore((state) => state.cliente);
  const creditsQuery = useMyCredits();

  const creditos = creditsQuery.data ?? [];
  const activos = creditos.filter((c) => c.estado === "ACTIVO" || c.estado === "MORA");
  const historial = creditos.filter((c) => c.estado === "PAGADO" || c.estado === "ANULADO");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <p className="text-caption uppercase tracking-wider text-muted-foreground">Tus créditos</p>
        <h1 className="text-h1">Hola, {cliente?.nombre?.split(" ")[0] ?? "cliente"} 👋</h1>
      </header>

      {creditsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <TabsRoot defaultValue="activos" className="w-full">
          <TabsList>
            <TabsTrigger value="activos">Activos ({activos.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="activos" className="flex flex-col gap-3">
            {activos.length === 0 ? (
              <EmptyState text="Aún no tienes créditos activos" />
            ) : (
              activos.map((credito) => <ClientCreditRow key={credito.id} credito={credito} />)
            )}
          </TabsContent>

          <TabsContent value="historial" className="flex flex-col gap-3">
            {historial.length === 0 ? (
              <EmptyState text="Sin historial todavía" />
            ) : (
              historial.map((credito) => (
                <ClientCreditRow key={credito.id} credito={credito} amountKind="pagado" />
              ))
            )}
          </TabsContent>
        </TabsRoot>
      )}
    </main>
  );
}

function ClientCreditRow({
  credito,
  amountKind = "saldo",
}: {
  credito: ClientCreditListItem;
  amountKind?: "saldo" | "pagado";
}) {
  return (
    <CreditSummaryCard
      credito={credito}
      href={`/client/credit/${credito.id}`}
      amountKind={amountKind}
      badge={credito.estado === "MORA" ? <Badge status="mora">En mora</Badge> : null}
      meta={
        credito.proximaFechaCuota
          ? `Próxima cuota: ${formatDateShort(credito.proximaFechaCuota)} · ${formatCurrency(credito.cuotaDiaria)}`
          : "Crédito saldado"
      }
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
