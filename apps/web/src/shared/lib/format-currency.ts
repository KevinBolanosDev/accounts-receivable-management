const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// DESIGN_SYSTEM.md §6 — todo monto en pantalla pasa por aquí, nunca un float crudo.
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

// Forma compacta para KPIs con poco espacio (ej. "$4.9M", "$540K").
export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return formatCurrency(amount);
}
