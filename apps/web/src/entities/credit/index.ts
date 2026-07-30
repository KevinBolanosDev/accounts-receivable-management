export { CreditCard } from "./ui/CreditCard";
export type { CreditCardProps } from "./ui/CreditCard";
export { CreditSummaryCard } from "./ui/CreditSummaryCard";
export type { CreditSummaryCardProps } from "./ui/CreditSummaryCard";
export {
  porcentajePagado,
  cuotasPagadasLabel,
  formatMontoCredito,
  calcularCredito,
  saldoPendienteDeCreditos,
  totalPagadoDeCreditos,
  contarCreditos,
} from "./lib/credit-progress";
export type { CreditoCalculo } from "./lib/credit-progress";
export { upcomingInstallments } from "./lib/upcoming-installments";
export type { UpcomingInstallment, UpcomingInstallments } from "./lib/upcoming-installments";
export {
  FRECUENCIA_LABEL,
  FRECUENCIA_OPTIONS,
  CUOTA_LABEL,
  CUOTA_SUFIJO,
  CUOTAS_PLURAL,
  PERIODO_LABEL,
  fechaVencimientoCuota,
  parseFechaInicio,
} from "./lib/frecuencia";
