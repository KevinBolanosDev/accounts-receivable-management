"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { DashboardSummary } from "@repo/types";

import { parseFechaInicio } from "@/entities/credit";
import { formatCurrency } from "@/shared/lib/format-currency";
import { isSameDay } from "@/shared/lib/format-date";
import { useReducedMotion } from "@/shared/lib/motion";

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  timeZone: "America/Bogota",
});

// `point.date` es "YYYY-MM-DD" (un día calendario): igual que en
// `ClosuresHistoryScreen`, se ancla a mediodía UTC antes de formatear en
// `America/Bogota` — si no, el último punto ("hoy") puede leerse como ayer.
function weekdayLabel(dateStr: string): string {
  const raw = WEEKDAY_FORMATTER.format(parseFechaInicio(dateStr)).replace(/\.$/, "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

interface XAxisTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
}

function XAxisTick({ x = 0, y = 0, payload }: XAxisTickProps) {
  const label = payload?.value ?? "";
  const isToday = label === "Hoy";
  return (
    <text
      x={x}
      y={Number(y) + 12}
      textAnchor="middle"
      className={isToday ? "fill-accent text-xs font-semibold" : "fill-muted-foreground text-xs"}
    >
      {label}
    </text>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: { fullLabel: string; total: number } }[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-body-sm text-popover-foreground shadow-md">
      <p className="text-caption text-muted-foreground">{point.fullLabel}</p>
      <p className="font-semibold tabular-nums">{formatCurrency(point.total)}</p>
    </div>
  );
}

// DESIGN_SYSTEM.md §3.2 — gráfico de barras semanal, único uso de `recharts`
// en la app. La barra de "hoy" se resalta en `--color-accent`; el resto en
// `--color-primary`. Respeta `prefers-reduced-motion` desactivando la
// animación de entrada de las barras.
export function WeeklyChart({ data }: { data: DashboardSummary["weeklyCollections"] }) {
  const reduced = useReducedMotion();

  const chartData = data.map((point) => {
    const parsed = parseFechaInicio(point.date);
    const today = isSameDay(parsed, new Date());
    return {
      date: point.date,
      total: point.total,
      label: today ? "Hoy" : weekdayLabel(point.date),
      fullLabel: today ? `Hoy · ${weekdayLabel(point.date)}` : weekdayLabel(point.date),
      isToday: today,
    };
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={XAxisTick}
          />
          <Tooltip cursor={{ fill: "var(--color-muted)" }} content={<ChartTooltip />} />
          <Bar dataKey="total" radius={[6, 6, 0, 0]} isAnimationActive={!reduced} maxBarSize={40}>
            {chartData.map((point) => (
              <Cell
                key={point.date}
                className={point.isToday ? "fill-accent" : "fill-primary"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
