import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import type {
  ClienteDetail,
  ClienteListItem,
  ClientesQuery,
  ClientesSummary,
  CreditoListItem,
  CreateClienteRequest,
  EstadoCliente,
  GenerateAccessResponse,
  UpdateClienteRequest,
} from "@repo/types";

import type { AuthenticatedUser } from "../../core/auth/auth-request";
import { requireAdminId } from "../../core/auth/tenant.util";
import { TEMPORARY_PASSWORD_EXPIRY_HOURS } from "../../core/security/lockout-policy";
import {
  mapCreditoListItem,
  rollupEstadoCliente,
  type CreditoRowForMapping,
} from "../../core/domain/credito-cliente.util";
import { buildPaymentHistory } from "../../core/domain/payment-schedule.util";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";
import {
  ClientsRepository,
  type ClientWithDetail,
  type ClientWithRoute,
} from "./clients.repository";

@Injectable()
export class ClientsService {
  constructor(
    private readonly clientsRepository: ClientsRepository,
    private readonly receiptToken: ReceiptTokenService,
  ) {}

  async findAll(user: AuthenticatedUser, query: ClientesQuery): Promise<ClienteListItem[]> {
    const adminId = requireAdminId(user);
    const clients = await this.clientsRepository.findMany(this.scopedWhere(user, query), adminId);
    return clients.map((client) => this.toListItem(client));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ClienteDetail> {
    const adminId = requireAdminId(user);
    const client = await this.clientsRepository.findById(id, this.scopeWhere(user), adminId);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    return this.toDetail(client);
  }

  async create(body: CreateClienteRequest, user: AuthenticatedUser): Promise<ClienteDetail> {
    const adminId = requireAdminId(user);
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.create(
        {
          nombre: body.nombre,
          telefono: body.telefono,
          documento: body.documento,
          direccion: body.direccion,
          fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl,
          fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl,
          contactoNombre: body.contactoNombre,
          contactoTelefono: body.contactoTelefono,
          // El cliente nace en el tenant de quien lo da de alta (el ADMIN dueño,
          // o el ADMIN del cobrador que lo registra) — una fila ClientAdmin, no
          // una columna. Si el documento ya existe como cliente de OTRO admin,
          // esto sigue fallando con 409 (ver mapError): vincular un cliente
          // existente a un segundo admin es una acción explícita que todavía no
          // existe, no un efecto secundario silencioso del alta.
          admins: { create: { adminId, rutaId: body.rutaId ?? null } },
        },
        adminId,
      );
      return this.toDetail(client);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(
    id: string,
    body: UpdateClienteRequest,
    user: AuthenticatedUser,
  ): Promise<ClienteDetail> {
    const adminId = requireAdminId(user);
    const existing = await this.clientsRepository.findById(id, this.scopeWhere(user), adminId);
    if (!existing) throw new NotFoundException("Cliente no encontrado.");

    // `rutaId` en el body: `undefined` = no tocar, `null` = quitar de su ruta
    // (queda "sin asignar"), string = (re)asignar a esa ruta.
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.update(
        id,
        {
          nombre: body.nombre,
          telefono: body.telefono,
          documento: body.documento,
          direccion: body.direccion,
          fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl,
          fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl,
          contactoNombre: body.contactoNombre,
          contactoTelefono: body.contactoTelefono,
          // `rutaId` es propiedad de MI relación con el cliente (ClientAdmin),
          // no del cliente: tocarla nunca debe afectar la ruta que otro admin
          // le asignó a este mismo cliente.
          admins:
            body.rutaId === undefined
              ? undefined
              : {
                  update: {
                    where: { clientId_adminId: { clientId: id, adminId } },
                    data: { rutaId: body.rutaId },
                  },
                },
        },
        adminId,
      );
      return this.toDetail(client);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const adminId = requireAdminId(user);
    // Scoped: sin el `scopeWhere` un ADMIN podía dar de baja el cliente de otro
    // ADMIN pasando su id a mano.
    const client = await this.clientsRepository.findById(id, this.scopeWhere(user), adminId);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    // Desactiva MI relación con el cliente, no al cliente global: si es
    // cartera de otro admin también, ese otro admin no debe verse afectado.
    await this.clientsRepository.update(
      id,
      {
        admins: {
          update: {
            where: { clientId_adminId: { clientId: id, adminId } },
            data: { activo: false },
          },
        },
      },
      adminId,
    );
  }

  // Fase 4.13 — genera (o resetea) el acceso del cliente al portal: password
  // temporal + `mustChangePassword=true` + expiración de 24h. El staff ve
  // `temporaryPassword` UNA sola vez (no se persiste en claro).
  async generateAccess(id: string, user: AuthenticatedUser): Promise<GenerateAccessResponse> {
    const adminId = requireAdminId(user);
    const client = await this.clientsRepository.findById(id, this.tenantWhere(user), adminId);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    const myRelation = client.admins[0];
    await this.assertClientRouteAccess(myRelation?.rutaId ?? null, user);

    if (!myRelation?.activo) {
      throw new BadRequestException("No puedes generar acceso a un cliente inactivo.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.clientsRepository.update(
      id,
      {
        passwordHash,
        mustChangePassword: true,
        passwordExpiresAt: expiresAt,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      },
      adminId,
    );

    return { temporaryPassword, expiresAt: expiresAt.toISOString() };
  }

  // Revoca el acceso: el cliente ya no puede loguearse (passwordHash null es
  // el mismo criterio que "sin acceso" en `auth-cliente.service.ts:login`).
  async deleteAccess(id: string, user: AuthenticatedUser): Promise<void> {
    const adminId = requireAdminId(user);
    const client = await this.clientsRepository.findById(id, this.tenantWhere(user), adminId);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    await this.assertClientRouteAccess(client.admins[0]?.rutaId ?? null, user);

    await this.clientsRepository.update(
      id,
      {
        passwordHash: null,
        mustChangePassword: false,
        passwordExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      adminId,
    );
  }

  // Mismo criterio que `assertRouteAccess` pero partiendo de un `rutaId`
  // nullable: un cliente "sin ruta" (§3 — cierre de Fase 3) no tiene cobrador
  // asignado, así que ningún COBRADOR puede gestionar su acceso (solo ADMIN).
  private async assertClientRouteAccess(
    rutaId: string | null,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.rol === "ADMIN") return;
    if (!rutaId) {
      throw new ForbiddenException(
        "No puedes gestionar el acceso de un cliente sin ruta asignada.",
      );
    }
    await this.assertRouteAccess(rutaId, user);
  }

  // Métricas de la vista "Clientes" del Cobrador (clientes / cartera /
  // cobrados / saldo). Agrega sobre los créditos reales del cliente, scoped
  // igual que `findAll` (COBRADOR solo ve los suyos). Los créditos ANULADOS
  // no cuentan para la cartera ni el saldo.
  async summary(user: AuthenticatedUser): Promise<ClientesSummary> {
    const adminId = requireAdminId(user);
    const clients = await this.clientsRepository.findManyForSummary(this.scopeWhere(user), adminId);

    let cartera = 0;
    let saldo = 0;
    for (const client of clients) {
      for (const credito of client.creditos) {
        if (credito.estado === "ANULADO") continue;
        cartera += Number(credito.montoTotal.toString());
        saldo += Number(credito.saldoPendiente.toString());
      }
    }

    return {
      clientes: clients.length,
      cartera: Number(cartera.toFixed(2)),
      cobrados: Number((cartera - saldo).toFixed(2)),
      saldo: Number(saldo.toFixed(2)),
    };
  }

  // Dos niveles de restricción, siempre combinados en la MISMA fila de
  // `admins` (no en filtros `some` separados): un cliente puede tener una
  // fila ClientAdmin por cada admin que lo tiene como cartera, y todas las
  // condiciones deben cumplirse sobre la fila de ESTE admin, nunca sobre la
  // de otro.
  //   1. Tenant (`adminId`): aplica a TODOS los roles de staff. Es lo que
  //      impide que un ADMIN vea la cartera de otro ADMIN.
  //   2. Ruta (`cobradorId`): solo para COBRADOR, dentro de su propio tenant.
  // Solo el tenant, sin el filtro `activo`. Lo usan los flujos de acceso al
  // portal, que necesitan encontrar al cliente inactivo para responder
  // "no puedes generar acceso a un cliente inactivo" en vez de un 404 ciego.
  private tenantWhere(user: AuthenticatedUser): Prisma.ClienteWhereInput {
    return { admins: { some: { adminId: requireAdminId(user) } } };
  }

  private scopeWhere(user: AuthenticatedUser): Prisma.ClienteWhereInput {
    const adminId = requireAdminId(user);
    return {
      admins: {
        some: {
          adminId,
          activo: true,
          // Igual que en rutas.service: una ruta desactivada no debe filtrar
          // clientes accesibles al cobrador por ningún camino (ni "Mis rutas"
          // ni "Clientes").
          ...(user.rol === "COBRADOR" ? { ruta: { cobradorId: user.sub, activa: true } } : {}),
        },
      },
    };
  }

  private scopedWhere(user: AuthenticatedUser, query: ClientesQuery): Prisma.ClienteWhereInput {
    const adminId = requireAdminId(user);
    return {
      admins: {
        some: {
          adminId,
          activo: true,
          ...(user.rol === "COBRADOR" ? { ruta: { cobradorId: user.sub, activa: true } } : {}),
          ...(query.rutaId ? { rutaId: query.rutaId } : {}),
        },
      },
      ...(query.search
        ? {
            OR: [
              { nombre: { contains: query.search, mode: "insensitive" } },
              { documento: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private async assertRouteAccess(rutaId: string, user: AuthenticatedUser): Promise<void> {
    const route = await this.clientsRepository.findRouteById(rutaId);
    // Una ruta de otro tenant se reporta como inexistente, no como prohibida:
    // un 403 confirmaría que ese id existe en la cartera de otro admin.
    if (!route || route.adminId !== requireAdminId(user)) {
      throw new NotFoundException("La ruta no existe.");
    }
    if (user.rol === "COBRADOR" && route.cobradorId !== user.sub) {
      throw new ForbiddenException("No puedes asignar clientes a una ruta ajena.");
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException("Ya existe un cliente con ese documento.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return new NotFoundException("La ruta o el cliente no existe.");
    }
    return error as Error;
  }

  // Fase 3 — agregados de crédito compartidos por listado Y detalle. Antes
  // solo `toDetail` los calculaba; `toListItem` los dejaba `undefined`
  // (ningún listado — Admin "Clientes", cobrador "Mis clientes" — mostraba
  // saldo/estado/avance reales, aunque el include ya cargue los créditos).
  // La separación Activos vs Historial sale del estado del crédito
  // (ACTIVO/MORA en Activos; PAGADO/ANULADO en Historial).
  private computeAgregados(creditos: CreditoRowForMapping[]): {
    creditosActivos: CreditoListItem[];
    creditosHistorial: CreditoListItem[];
    saldoPendiente: number;
    porcentajePagado: number;
    estado: EstadoCliente;
  } {
    const creditosActivos: CreditoListItem[] = [];
    const creditosHistorial: CreditoListItem[] = [];
    for (const c of creditos) {
      const item = mapCreditoListItem(c);
      if (item.estado === "ACTIVO" || item.estado === "MORA") {
        creditosActivos.push(item);
      } else {
        creditosHistorial.push(item);
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
      hoy: new Date(),
      cuotaSugerida: creditosActivos[0]?.cuotaDiaria ?? 0,
    });

    return {
      creditosActivos,
      creditosHistorial,
      saldoPendiente: Number(saldoActivos.toFixed(2)),
      porcentajePagado,
      estado,
    };
  }

  private toListItem(client: ClientWithRoute): ClienteListItem {
    const agregados = this.computeAgregados(client.creditos);
    // La única fila de `admins` presente es la de ESTE admin (el include la
    // filtra por `adminId`) — ver el comentario en `clients.repository.ts`.
    const myRelation = client.admins[0];
    return {
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      documento: client.documento,
      direccion: client.direccion,
      fotoDocumentoFrenteUrl: client.fotoDocumentoFrenteUrl,
      fotoDocumentoReversoUrl: client.fotoDocumentoReversoUrl,
      rutaId: myRelation?.rutaId ?? null,
      contactoNombre: client.contactoNombre,
      contactoTelefono: client.contactoTelefono,
      ruta: myRelation?.ruta ? { id: myRelation.ruta.id, nombre: myRelation.ruta.nombre } : null,
      saldoPendiente: agregados.saldoPendiente,
      porcentajePagado: agregados.porcentajePagado,
      estado: agregados.estado,
    };
  }

  private toDetail(client: ClientWithDetail): ClienteDetail {
    const agregados = this.computeAgregados(client.creditos);
    // Una sola referencia de "hoy" para todos los créditos: si se tomara dentro
    // del flatMap, dos créditos podrían caer en días distintos al cruzar la
    // medianoche a mitad del cálculo.
    const hoy = new Date();
    const myRelation = client.admins[0];

    return {
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      documento: client.documento,
      direccion: client.direccion,
      contactoNombre: client.contactoNombre,
      contactoTelefono: client.contactoTelefono,
      fotoDocumentoFrenteUrl: client.fotoDocumentoFrenteUrl,
      fotoDocumentoReversoUrl: client.fotoDocumentoReversoUrl,
      rutaId: myRelation?.rutaId ?? null,
      ruta: myRelation?.ruta ? { id: myRelation.ruta.id, nombre: myRelation.ruta.nombre } : null,
      saldoPendiente: agregados.saldoPendiente,
      porcentajePagado: agregados.porcentajePagado,
      estado: agregados.estado,
      cobradorNombre: myRelation?.ruta?.cobrador?.nombre ?? null,
      creditosActivos: agregados.creditosActivos,
      creditosHistorial: agregados.creditosHistorial,
      tieneAccesoPortal: client.passwordHash !== null,
      mustChangePassword: client.mustChangePassword,
      lastLoginAt: client.lastLoginAt ? client.lastLoginAt.toISOString() : null,
      // Historial REAL y enriquecido. Antes se fabricaba acá un `id` sintético
      // con `reciboUrl: null` fijo, lo que hacía imposible abrir o compartir el
      // recibo desde el historial del Cobrador. Ahora reusa
      // `buildPaymentHistory` (`core/domain`, con unit tests) — el MISMO
      // cálculo de `numeroCuota`/`estado` que ya usaba el portal del cliente,
      // así ambas superficies comparten componentes de historial.
      historialPagos: client.creditos.flatMap((credito) =>
        buildPaymentHistory(
          { id: credito.id, fechaInicio: credito.fechaInicio, dias: credito.dias },
          credito.pagos.map((pago) => ({
            id: pago.id,
            creditoId: credito.id,
            monto: Number(pago.monto.toString()),
            fecha: pago.fecha,
            cobradorId: pago.cobradorId,
            cobradorNombre: pago.cobrador?.nombre ?? null,
            reciboUrl: pago.reciboUrl,
          })),
          hoy,
          (pagoId) => this.receiptToken.buildPublicUrl(pagoId),
        ),
      ),
    };
  }
}

// Password temporal legible: 8 bytes → base64url (~11 chars), reemplazando
// caracteres ambiguos al dictarla por teléfono o leerla en un papel
// (0/O → 2, 1/l/I → 3). No es para memorizar — el cliente la cambia en el
// primer ingreso (`mustChangePassword=true`).
function generateTemporaryPassword(): string {
  return crypto.randomBytes(8).toString("base64url").replace(/[0O]/g, "2").replace(/[1lI]/g, "3");
}
