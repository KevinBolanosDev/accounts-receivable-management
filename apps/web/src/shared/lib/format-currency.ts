const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// DESIGN_SYSTEM.md §6 — todo monto en pantalla pasa por aquí, nunca un float crudo.
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
