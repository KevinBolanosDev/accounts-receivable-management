import type { FrecuenciaPago } from "@repo/types";

import {
  CUOTAS_PLURAL,
  calcularCredito,
  fechaVencimientoCuota,
  parseFechaInicio,
} from "@/entities/credit";
import { cn } from "@/shared/lib/utils";
import { formatCurrency } from "@/shared/lib/format-currency";
import { formatDate } from "@/shared/lib/format-date";

// Card "Cálculo estimado" — nació en "Crear crédito" (#9c) y ahora la comparten
// las tres pantallas que arman un crédito en vivo: Crear crédito, el alta de
// cliente con crédito opcional del Admin (`ClientFormScreen`) y el alta en
// campo del Cobrador (`FieldClientCreateScreen`). Antes cada una tenía su
// propia versión — Crear crédito la card completa, las otras dos una barra de
// una sola línea (`CuotasEstimadasInline`) que solo mostraba la cuota
// estimada. Una sola implementación evita que las tres se desincronicen.
//
// Toma los valores CRUDOS del formulario (no `calc` ya derivado): cada pantalla
// solo necesita pasar lo que el usuario tipeó, sin repetir `calcularCredito(...)`
// en cada call site.
export interface CreditoCalculoPanelProps {
  monto: number;
  interes: number;
  cuotas: number;
  frecuencia: FrecuenciaPago;
  /** `"YYYY-MM-DD"` o ISO completo. Default: hoy (los créditos que se crean
   * desde el alta de cliente no piden fecha de inicio — el backend usa hoy). */
  fechaInicio?: string;
  className?: string;
}

export function CreditoCalculoPanel({
  monto,
  interes,
  cuotas,
  frecuencia,
  fechaInicio,
  className,
}: CreditoCalculoPanelProps) {
  const calc = calcularCredito(monto, interes, cuotas);
  const base = parseFechaInicio(fechaInicio ?? new Date().toISOString().slice(0, 10));
  const tieneDatos = calc.cuotaDiaria > 0;

  // Vencimientos por `fechaVencimientoCuota` (el espejo del cronograma del
  // backend): la cuota 1 vence un período después del desembolso, no el mismo
  // día — ver el gotcha "El día del desembolso no se cobra" en CLAUDE.md.
  const vencimiento = (numero: number) => fechaVencimientoCuota(base, numero, frecuencia);
  const ultimaCuota = calc.cuotas > 0 ? vencimiento(calc.cuotas) : null;
  // Días entre el desembolso y el vencimiento de la última cuota.
  const duracionEnDias =
    calc.cuotas > 0 && ultimaCuota
      ? Math.round((ultimaCuota.getTime() - base.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
  const primeras =
    calc.cuotas > 0
      ? Array.from({ length: Math.min(3, calc.cuotas) }, (_, i) => vencimiento(i + 1))
      : [];
  const primeraCuota = primeras[0] ?? null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Card decorativa (#9c): tinte índigo + borde del mismo color. Es el
          único bloque de la pantalla que no es un campo, así que se separa por
          color en vez de por otro borde gris más. */}
      <div className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-primary">
          Cálculo estimado
        </p>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-display font-bold leading-none tabular-nums">
            {tieneDatos ? calc.cuotas : "—"}
          </span>
          <span className="text-body-sm text-muted-foreground">
            {tieneDatos
              ? `${CUOTAS_PLURAL[frecuencia]} de ${formatCurrency(calc.cuotaDiaria)}`
              : "Completa monto, interés y n° de cuotas"}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-primary/20 pt-4">
          <PanelRow
            label={`Interés (${interes > 0 ? interes : 0}%)`}
            value={calc.interesTotal > 0 ? formatCurrency(calc.interesTotal) : "—"}
          />
          <PanelRow
            label="Monto total"
            value={calc.montoTotal > 0 ? formatCurrency(calc.montoTotal) : "—"}
            strong
          />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-primary/20 pt-4">
          {/* Duración REAL del plan (del primer al último vencimiento), no una
              estimación en semanas: en un crédito mensual "~ 26 sem" no le dice
              nada a nadie, y en uno semanal la cuenta en días es exacta. */}
          <PanelFigure label="Duración" value={duracionEnDias > 0 ? `${duracionEnDias} días` : "—"} />
          <PanelFigure label="Última cuota" value={ultimaCuota ? formatDate(ultimaCuota) : "—"} />
          <PanelFigure label="Primera" value={primeraCuota ? formatDate(primeraCuota) : "—"} />
        </div>
      </div>

      {/* {primeras.length > 0 ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-5">
          <span className="text-caption uppercase tracking-wide text-muted-foreground">
            Primeras cuotas
          </span>
          {primeras.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Cuota {i + 1} · {formatDateShort(d)}
              </span>
              <span className="font-medium tabular-nums">{formatCurrency(calc.cuotaDiaria)}</span>
            </div>
          ))}
        </div>
      ) : null} */}
    </div>
  );
}

/** Columna del pie de la card: etiqueta pequeña + valor compacto. */
function PanelFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-caption text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PanelRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-semibold" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}
