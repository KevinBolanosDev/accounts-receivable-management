"use client";

import { formatCurrency } from "@/shared/lib/format-currency";
import { Card, CardContent } from "@/shared/ui/card";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { TabsRoot, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { useMyCredits, useMyPayments, useMySummary } from "../api/use-client-portal";

// DESIGN_SYSTEM.md §5.2 — pantalla #21c del prototipo: vista de crédito y
// pagos del cliente final. Es la misma vista para ambas vías (token o
// credenciales — hoy solo credenciales, ver FASE_4_SUBFASES.md §8.1).
//
// Layout hero + tabs Activo/Historial + lista de pagos recientes. Sin scroll
// vertical en móvil porque es informacion densa pero acotada.
export function ClientCreditScreen() {
  const creditsQuery = useMyCredits();
  const paymentsQuery = useMyPayments();
  const summaryQuery = useMySummary();

  const creditos = creditsQuery.data ?? [];
  const pagos = paymentsQuery.data ?? [];
  const summary = summaryQuery.data;

  const activos = creditos.filter((c) => c.estado === "ACTIVO" || c.estado === "MORA");
  const historial = creditos.filter((c) => c.estado === "PAGADO" || c.estado === "ANULADO");

  if (creditsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">
        Cargando tu crédito…
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <p className="text-caption uppercase tracking-wider text-muted-foreground">
          Tu crédito
        </p>
        <h1 className="text-h1">Hola, {creditsQuery.data?.[0]?.codigo ?? "cliente"}</h1>
      </header>

      {summary && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-stretch sm:justify-around">
            <ProgressRing
              size="hero"
              value={Math.round(summary.porcentajePagado)}
              showLabel
            />
            <div className="flex flex-col justify-center gap-2 text-center sm:text-left">
              <div>
                <p className="text-caption uppercase tracking-wider text-muted-foreground">
                  Saldo pendiente
                </p>
                <p className="text-display tabular-nums">{formatCurrency(summary.saldoTotal)}</p>
              </div>
              {summary.proximaCuota !== null && (
                <div>
                  <p className="text-caption uppercase tracking-wider text-muted-foreground">
                    Próxima cuota
                  </p>
                  <p className="text-h3 font-semibold tabular-nums">
                    {formatCurrency(summary.proximaCuota)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <TabsRoot defaultValue="activo" className="w-full">
        <TabsList>
          <TabsTrigger value="activo">Activo ({activos.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos ({pagos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activo" className="space-y-3">
          {activos.length === 0 ? (
            <p className="text-body text-muted-foreground">No tienes créditos activos.</p>
          ) : (
            activos.map((c) => <CreditRow key={c.id} credit={c} />)
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-3">
          {historial.length === 0 ? (
            <p className="text-body text-muted-foreground">Sin historial todavía.</p>
          ) : (
            historial.map((c) => <CreditRow key={c.id} credit={c} />)
          )}
        </TabsContent>

        <TabsContent value="pagos" className="space-y-2">
          {pagos.length === 0 ? (
            <p className="text-body text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            pagos.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-caption uppercase tracking-wider text-muted-foreground">
                      {new Date(p.fecha).toLocaleDateString("es-CO")}
                    </p>
                    <p className="text-body font-medium">
                      Pago recibido
                    </p>
                  </div>
                  <p className="text-h3 font-semibold tabular-nums">
                    {formatCurrency(p.monto)}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </TabsRoot>
    </main>
  );
}

function CreditRow({
  credit,
}: {
  credit: import("@repo/types").CreditoListItem;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-caption uppercase tracking-wider text-muted-foreground">
            {credit.codigo}
          </p>
          <p className="truncate text-body font-medium">{credit.producto}</p>
        </div>
        <div className="text-right">
          <p className="text-caption uppercase tracking-wider text-muted-foreground">
            Saldo
          </p>
          <p className="text-h3 font-semibold tabular-nums">
            {formatCurrency(credit.saldoPendiente)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}