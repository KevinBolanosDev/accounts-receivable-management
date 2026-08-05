import { formatCurrency } from "@/shared/lib/format-currency";

// Mensaje de recordatorio de pago por WhatsApp (#13c, botón "Recordar").
// Deliberadamente separado de `entities/receipt/lib/whatsapp.ts`: ese
// mensaje comparte un COBRO ya hecho, este RECUERDA uno pendiente — mezclar
// los dos acoplaría `entities/receipt` a un caso que no es suyo.
export function buildPaymentReminderText(nombre: string, saldoPendiente: number): string {
  return [
    `Hola ${nombre}, te recordamos que tienes un saldo pendiente de ${formatCurrency(saldoPendiente)}.`,
    "Cuando puedas, coordina tu pago con tu cobrador. ¡Gracias!",
  ].join(" ");
}
