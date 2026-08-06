import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateRutaRequest,
  CreditoListItem,
  RutaCliente,
  RutaDetail,
  RutaListItem,
  UpdateRutaRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import {
  computeAvanceDelDia,
  mapCreditoListItem,
  rollupEstadoCliente,
} from "../../core/domain/credito-cliente.util";
import { isRouteClosedOn } from "../../core/domain/daily-closure.util";
import { CLOSURE_TIMEZONE } from "../../core/reports/closure-policy";
import { RutasRepository, type RutaWithClientesHoy, type RutaWithCount } from "./rutas.repository";

// El scoping vive aquí, no en el repository: lee el rol/sub de @CurrentUser()
// y decide qué `where` le pasa al repo. El repo nunca ve al usuario autenticado.
@Injectable()
export class RutasService {
  constructor(private readonly rutasRepository: RutasRepository) {}

  async findAll(user: AuthenticatedUser): Promise<RutaListItem[]> {
    const where = this.scopeWhere(user);
    const rutas = await this.rutasRepository.findMany(where, requireAdminId(user), hoyRange());
    return rutas.map((ruta) => this.toListItem(ruta));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<RutaDetail> {
    const where = this.scopeWhere(user);
    const ruta = await this.rutasRepository.findById(id, where, requireAdminId(user), hoyRange());

    if (!ruta) {
      throw new NotFoundException("Ruta no encontrada.");
    }

    return this.toDetail(ruta);
  }

  async create(body: CreateRutaRequest, user: AuthenticatedUser): Promise<RutaListItem> {
    const adminId = requireAdminId(user);
    if (body.cobradorId) {
      await this.assertCobradorInTenant(body.cobradorId, adminId);
    }

    try {
      const ruta = await this.rutasRepository.create({
        nombre: body.nombre,
        activa: body.activa,
        admin: { connect: { id: adminId } },
        cobrador: body.cobradorId ? { connect: { id: body.cobradorId } } : undefined,
      });
      return this.toListItemFromWrite(ruta);
    } catch (error) {
      throw this.mapWriteError(error, { cobradorConnect: Boolean(body.cobradorId) });
    }
  }

  async update(
    id: string,
    body: UpdateRutaRequest,
    user: AuthenticatedUser,
  ): Promise<RutaListItem> {
    await this.assertExists(id, user);
    if (body.cobradorId) {
      await this.assertCobradorInTenant(body.cobradorId, requireAdminId(user));
    }

    try {
      const ruta = await this.rutasRepository.update(id, {
        nombre: body.nombre,
        activa: body.activa,
        cobrador: this.cobradorUpdate(body.cobradorId),
      });
      return this.toListItemFromWrite(ruta);
    } catch (error) {
      // Solo un `connect` a cobradorId puede fallar con "record not found" aquí;
      // si no se tocó cobrador, un P2025 solo puede ser la propia ruta (carrera
      // con un DELETE concurrente sobre el mismo id).
      throw this.mapWriteError(error, { cobradorConnect: typeof body.cobradorId === "string" });
    }
  }

  // Asignar/quitar clientes de una ruta (§3 — cierre de Fase 3). Ambos son
  // ADMIN-only (gate en el controller); no hay scoping de cobrador que
  // aplicar aquí. Devuelven el detalle ya refrescado para que el frontend no
  // tenga que hacer un segundo round-trip.
  async assignClientes(
    id: string,
    clienteIds: string[],
    user: AuthenticatedUser,
  ): Promise<RutaDetail> {
    await this.assertExists(id, user);
    await this.rutasRepository.assignClientes(id, clienteIds, requireAdminId(user));
    return this.findOne(id, user);
  }

  async unassignCliente(
    id: string,
    clienteId: string,
    user: AuthenticatedUser,
  ): Promise<RutaDetail> {
    await this.assertExists(id, user);
    await this.rutasRepository.unassignCliente(id, clienteId, requireAdminId(user));
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.assertExists(id, user);

    const clientesCount = await this.rutasRepository.countClientes(id);
    if (clientesCount > 0) {
      throw new ConflictException(
        `No puedes eliminar esta ruta: tiene ${clientesCount} cliente(s) asignado(s). Reasígnalos primero o desactívala.`,
      );
    }

    try {
      await this.rutasRepository.delete(id);
    } catch (error) {
      throw this.mapDeleteError(error);
    }
  }

  // Una ruta desactivada no debe "aparecer en la app del cobrador" (ni en su
  // lista ni por acceso directo a /routes/:id) — ADMIN sigue viendo todas,
  // activas e inactivas, para poder gestionarlas.
  private scopeWhere(user: AuthenticatedUser): Prisma.RutaWhereInput {
    return {
      // Tenant primero: aplica a ADMIN y COBRADOR por igual.
      adminId: requireAdminId(user),
      ...(user.rol === "COBRADOR" ? { cobradorId: user.sub, activa: true } : {}),
    };
  }

  private cobradorUpdate(
    cobradorId: string | null | undefined,
  ): Prisma.RutaUpdateInput["cobrador"] {
    if (cobradorId === undefined) return undefined;
    if (cobradorId === null) return { disconnect: true };
    return { connect: { id: cobradorId } };
  }

  // Scoped por tenant: sin esto un ADMIN podía editar, borrar o reasignar
  // clientes de una ruta de otro ADMIN conociendo su id.
  private async assertExists(id: string, user: AuthenticatedUser): Promise<void> {
    const ruta = await this.rutasRepository.findById(
      id,
      this.scopeWhere(user),
      requireAdminId(user),
      hoyRange(),
    );
    if (!ruta) {
      throw new NotFoundException("Ruta no encontrada.");
    }
  }

  // Un cobrador de otro tenant se reporta como inexistente (mismo criterio que
  // `clients.service.assertRouteAccess`): un 403 confirmaría que ese id existe.
  private async assertCobradorInTenant(cobradorId: string, adminId: string): Promise<void> {
    const cobrador = await this.rutasRepository.findCobradorById(cobradorId);
    if (!cobrador || cobrador.adminId !== adminId) {
      throw new BadRequestException("El cobrador indicado no existe.");
    }
  }

  private mapWriteError(error: unknown, context: { cobradorConnect: boolean }): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return new ConflictException("Ya existe una ruta con ese nombre.");
      }
      if (error.code === "P2025") {
        return context.cobradorConnect
          ? new BadRequestException("El cobrador indicado no existe.")
          : new NotFoundException("Ruta no encontrada.");
      }
    }
    return error as Error;
  }

  // Ventana de carrera entre assertExists()/countClientes() y el delete real
  // (dos round-trips sin transacción): otra petición pudo borrar la ruta
  // (P2025) o asignarle un cliente nuevo justo antes del delete, lo que la FK
  // `Cliente.ruta` (onDelete: Restrict) bloquea con P2003.
  private mapDeleteError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return new NotFoundException("Ruta no encontrada.");
      }
      if (error.code === "P2003") {
        return new ConflictException(
          "No puedes eliminar esta ruta: tiene clientes asignados. Reasígnalos primero o desactívala.",
        );
      }
    }
    return error as Error;
  }

  // Ruta recién creada/actualizada: sin clientes que agregar todavía en el
  // mismo request, así que el resumen del día es 0 (no hace falta re-leer).
  // `estadoDia` sí puede ser real (editar el nombre de una ruta ya cerrada
  // hoy no debe mostrarla como "abierta").
  private toListItemFromWrite(ruta: RutaWithCount): RutaListItem {
    return {
      id: ruta.id,
      nombre: ruta.nombre,
      activa: ruta.activa,
      cobradorId: ruta.cobradorId,
      cobrador: ruta.cobrador ? { id: ruta.cobrador.id, nombre: ruta.cobrador.nombre } : null,
      clientesCount: ruta._count.clientAdmins,
      totalCobradoHoy: 0,
      avanceDelDia: 0,
      estadoDia: estadoDiaDe(ruta.dailyClosures),
    };
  }

  private toListItem(ruta: RutaWithClientesHoy): RutaListItem {
    const resumen = summarizeRuta(ruta);
    return {
      id: ruta.id,
      nombre: ruta.nombre,
      activa: ruta.activa,
      cobradorId: ruta.cobradorId,
      cobrador: ruta.cobrador ? { id: ruta.cobrador.id, nombre: ruta.cobrador.nombre } : null,
      clientesCount: ruta.clientAdmins.length,
      totalCobradoHoy: resumen.totalCobradoHoy,
      avanceDelDia: resumen.avanceDelDia,
      estadoDia: estadoDiaDe(ruta.dailyClosures),
    };
  }

  private toDetail(ruta: RutaWithClientesHoy): RutaDetail {
    const resumen = summarizeRuta(ruta);
    return {
      id: ruta.id,
      nombre: ruta.nombre,
      activa: ruta.activa,
      cobradorId: ruta.cobradorId,
      cobrador: ruta.cobrador ? { id: ruta.cobrador.id, nombre: ruta.cobrador.nombre } : null,
      cobradorTelefono: ruta.cobrador?.telefono ?? null,
      estadoDia: estadoDiaDe(ruta.dailyClosures),
      avanceDelDia: resumen.avanceDelDia,
      clientesCount: ruta.clientAdmins.length,
      cobradoHoy: resumen.totalCobradoHoy,
      // Ya no es stub: cuenta créditos `estado=MORA` de verdad — antes ningún
      // crédito llegaba a ese estado porque nada lo escribía; el cierre
      // diario (Fase 5.7) lo materializa en la transacción de cerrar.
      enMora: resumen.clientes.filter((c) => c.estado === "mora").length,
      saldoTotal: resumen.saldoTotal,
      cierres: ruta.dailyClosures.map(toCierreResumen),
      clientes: resumen.clientes,
    };
  }
}

// Cerrada si existe un cierre para HOY (día local `CLOSURE_TIMEZONE`) entre
// los últimos `RECENT_CLOSURES_TAKE` — como están ordenados `date desc`, el
// de hoy (si existe) siempre es el primero, así que el recorte nunca esconde
// el dato que importa para esta pregunta puntual.
function estadoDiaDe(dailyClosures: { date: Date }[]): "abierta" | "cerrada" {
  return isRouteClosedOn(dailyClosures, new Date(), CLOSURE_TIMEZONE) ? "cerrada" : "abierta";
}

function toCierreResumen(closure: {
  id: string;
  date: Date;
  totalCollected: Prisma.Decimal;
  status: "OPEN" | "CLOSED";
  newCredits: number;
  unpaidCount: number;
}): RutaDetail["cierres"][number] {
  return {
    id: closure.id,
    fecha: closure.date.toISOString().slice(0, 10),
    total: Number(closure.totalCollected.toString()),
    estado: closure.status,
    creditosNuevos: closure.newCredits,
    clientesSinPagar: closure.unpaidCount,
  };
}

function hoyRange(): { desde: Date; hasta: Date } {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  return { desde, hasta };
}

function summarizeRuta(ruta: RutaWithClientesHoy): {
  clientes: RutaCliente[];
  totalCobradoHoy: number;
  avanceDelDia: number;
  saldoTotal: number;
} {
  const hoy = new Date();
  let totalCobradoHoy = 0;
  let saldoTotal = 0;
  const actividad: { elegible: boolean; cobrado: boolean }[] = [];

  const clientes: RutaCliente[] = ruta.clientAdmins.map((clientAdmin) => {
    const cliente = clientAdmin.client;
    const creditosActivos: CreditoListItem[] = [];
    const creditosHistorial: CreditoListItem[] = [];
    let cobroHoy: RutaCliente["cobroHoy"] = null;
    let totalCobradoHoyCliente = 0;

    for (const c of cliente.creditos) {
      const item = mapCreditoListItem(c);
      if (item.estado === "ACTIVO" || item.estado === "MORA") {
        creditosActivos.push(item);
      } else {
        creditosHistorial.push(item);
      }
      // `c.pagos` ya viene filtrado al rango de HOY desde el repository.
      //
      // Se recorren TODOS, no solo `c.pagos[0]`: un cliente puede abonar varias
      // veces en el día (o cancelar el crédito completo en un segundo pago), y
      // puede tener pagos en más de un crédito. Antes se sumaba únicamente el
      // pago más reciente y el resto desaparecía del "Cobrado hoy".
      for (const pagoHoy of c.pagos) {
        totalCobradoHoyCliente += Number(pagoHoy.monto.toString());
        // `cobroHoy` sigue siendo el ÚLTIMO pago: solo alimenta el split
        // Pendientes/Cobrados, no el total.
        if (!cobroHoy || pagoHoy.fecha > new Date(cobroHoy.fecha)) {
          cobroHoy = {
            creditoId: c.id,
            monto: Number(pagoHoy.monto.toString()),
            fecha: pagoHoy.fecha.toISOString(),
          };
        }
      }
    }

    const saldoActivos = creditosActivos.reduce((sum, c) => sum + c.saldoPendiente, 0);
    const totalPagadoActivos = creditosActivos.reduce((sum, c) => sum + c.totalPagado, 0);
    const montoTotalActivos = creditosActivos.reduce((sum, c) => sum + c.montoTotal, 0);
    const porcentajePagado =
      montoTotalActivos > 0
        ? Number(((totalPagadoActivos / montoTotalActivos) * 100).toFixed(2))
        : 0;
    const estado = rollupEstadoCliente({
      creditosActivos,
      creditosHistorial,
      hoy,
    });

    saldoTotal += saldoActivos;
    // Elegible para el resumen del día: tiene algo activo para cobrar, o ya se
    // le cobró hoy (incluye el caso "pagó su última cuota justo hoy").
    actividad.push({
      elegible: creditosActivos.length > 0 || Boolean(cobroHoy),
      cobrado: Boolean(cobroHoy),
    });
    totalCobradoHoy += totalCobradoHoyCliente;

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      documento: cliente.documento,
      direccion: cliente.direccion,
      fotoDocumentoFrentePath: cliente.fotoDocumentoFrentePath,
      fotoDocumentoReversoPath: cliente.fotoDocumentoReversoPath,
      // Es un listado (extiende `clienteListItemSchema`): nunca se firma acá,
      // igual que en `ClientsService.toListItem`.
      fotoDocumentoFrenteUrl: null,
      fotoDocumentoReversoUrl: null,
      // La ruta es siempre ESTA ruta: `ruta.clientAdmins` ya viene filtrado a
      // las relaciones activas de esta misma ruta (ver `buildRutaReadInclude`).
      rutaId: ruta.id,
      ruta: { id: ruta.id, nombre: ruta.nombre },
      saldoPendiente: Number(saldoActivos.toFixed(2)),
      porcentajePagado,
      estado,
      cobroHoy,
      totalCobradoHoy: Number(totalCobradoHoyCliente.toFixed(2)),
    };
  });

  return {
    clientes,
    totalCobradoHoy: Number(totalCobradoHoy.toFixed(2)),
    avanceDelDia: computeAvanceDelDia(actividad),
    saldoTotal: Number(saldoTotal.toFixed(2)),
  };
}
