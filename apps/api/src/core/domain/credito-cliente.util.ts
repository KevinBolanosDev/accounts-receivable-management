import { Prisma } from "@prisma/client";
import type { CreditoListItem, EstadoCliente, EstadoCredito, FrecuenciaPago } from "@repo/types";

import { cuotasVencidasAlDia } from "./payment-schedule.util";

// Compartido entre los módulos `clientes` y `rutas` — ambos necesitan mapear
// filas de Credito a `CreditoListItem` y derivar el rollup de estado del
// cliente (mora/próximo a vencer/pagado/activo). Vive en `core/` (no en
// ninguno de los dos módulos) para no crear un import feature→feature: ambos
// dependen de este helper, nunca uno del `.service.ts` del otro.

export interface CreditoRowForMapping {
  id: string;
  codigo: string;
  clienteId: string;
  monto: Prisma.Decimal;
  interes: Prisma.Decimal;
  frecuencia: FrecuenciaPago;
  cuotas: number;
  dias: number;
  montoTotal: Prisma.Decimal;
  cuotaDiaria: Prisma.Decimal;
  saldoPendiente: Prisma.Decimal;
  estado: EstadoCredito;
  fechaInicio: Date;
  producto: { nombre: string };
}

export function mapCreditoListItem(c: CreditoRowForMapping): CreditoListItem {
  const monto = Number(c.monto.toString());
  const interes = Number(c.interes.toString());
  const montoTotal = Number(c.montoTotal.toString());
  const saldoPendiente = Number(c.saldoPendiente.toString());
  const totalPagado = Number((montoTotal - saldoPendiente).toFixed(2));
  const porcentajePagado =
    montoTotal > 0 ? Number(((totalPagado / montoTotal) * 100).toFixed(2)) : 0;
  const cuotaDiaria = Number(c.cuotaDiaria.toString());
  const cuotasTotal = c.cuotas;
  const cuotasPagadas =
    cuotaDiaria > 0 ? Math.min(c.cuotas, Math.round(totalPagado / cuotaDiaria)) : 0;

  return {
    id: c.id,
    codigo: c.codigo,
    clienteId: c.clienteId,
    producto: c.producto.nombre,
    monto,
    interes,
    frecuencia: c.frecuencia,
    dias: c.dias,
    montoTotal,
    cuotaDiaria,
    saldoPendiente,
    totalPagado,
    porcentajePagado,
    estado: c.estado,
    fechaInicio: c.fechaInicio.toISOString(),
    cuotasPagadas,
    cuotasTotal,
  };
}

// Rollup simple del estado del cliente (Fase 3 — definitivo se cierra en 5).
// Reglas:
//   - mora            → algún crédito activo está en MORA.
//   - proximo-a-vencer→ algún crédito activo y cuota que vence HOY.
//   - pagado          → sin créditos activos y al menos uno en historial pagado.
//   - activo          → en otro caso.
export function rollupEstadoCliente(args: {
  creditosActivos: CreditoListItem[];
  creditosHistorial: CreditoListItem[];
  hoy: Date;
}): EstadoCliente {
  const { creditosActivos, creditosHistorial, hoy } = args;
  if (creditosActivos.some((c) => c.estado === "MORA")) return "mora";

  if (creditosActivos.length > 0) {
    // "Próximo a vencer" si lo esperado a HOY supera a lo ya pagado del crédito
    // más antiguo (proxy: el de saldo más grande). Es provisional (Fase 5 lo
    // cierra con el cierre diario).
    const masAntiguo = [...creditosActivos].sort((a, b) =>
      a.fechaInicio.localeCompare(b.fechaInicio),
    )[0];
    if (masAntiguo && masAntiguo.cuotaDiaria > 0) {
      // Se cuentan CUOTAS vencidas, no días transcurridos: en un crédito
      // semanal o mensual los días corren igual pero la deuda solo crece
      // cuando vence un período. Con la cuenta por días, un crédito mensual
      // aparecía "próximo a vencer" al tercer día de haberse otorgado.
      const cuotasVencidas = cuotasVencidasAlDia(
        {
          id: masAntiguo.id,
          fechaInicio: new Date(masAntiguo.fechaInicio),
          cuotas: masAntiguo.cuotasTotal,
          frecuencia: masAntiguo.frecuencia,
        },
        hoy,
      );
      const esperado = cuotasVencidas * masAntiguo.cuotaDiaria;
      if (esperado - masAntiguo.totalPagado > masAntiguo.cuotaDiaria * 1.5) {
        return "proximo-a-vencer";
      }
    }
  }

  if (creditosActivos.length === 0 && creditosHistorial.some((c) => c.estado === "PAGADO")) {
    return "pagado";
  }

  return "activo";
}

// Compartido entre `rutas` (detalle/lista de ruta) y `dashboard` (Fase 5,
// "Rutas del día"): mismo % o los dos lados de la app cuentan la misma
// jornada distinto. "Elegible" = tiene crédito activo para cobrar hoy, o ya
// se le cobró hoy (cierra el caso "pagó su última cuota justo hoy"); del
// subconjunto elegible, cuántos ya pagaron.
export function computeAvanceDelDia(clientes: { elegible: boolean; cobrado: boolean }[]): number {
  const elegibles = clientes.filter((c) => c.elegible).length;
  if (elegibles === 0) return 0;
  const cobrados = clientes.filter((c) => c.elegible && c.cobrado).length;
  return Math.round((cobrados / elegibles) * 100);
}
