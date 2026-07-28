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
    const clients = await this.clientsRepository.findMany(this.scopedWhere(user, query));
    return clients.map((client) => this.toListItem(client));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ClienteDetail> {
    const client = await this.clientsRepository.findById(id, this.scopeWhere(user));
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    return this.toDetail(client);
  }

  async create(body: CreateClienteRequest, user: AuthenticatedUser): Promise<ClienteDetail> {
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.create({
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        direccion: body.direccion,
        ruta: body.rutaId ? { connect: { id: body.rutaId } } : undefined,
        fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl,
        contactoNombre: body.contactoNombre,
        contactoTelefono: body.contactoTelefono,
      });
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
    const existing = await this.clientsRepository.findById(id, this.scopeWhere(user));
    if (!existing) throw new NotFoundException("Cliente no encontrado.");

    // `rutaId` en el body: `undefined` = no tocar, `null` = quitar de su ruta
    // (queda "sin asignar"), string = (re)asignar a esa ruta.
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    try {
      const client = await this.clientsRepository.update(id, {
        nombre: body.nombre,
        telefono: body.telefono,
        documento: body.documento,
        direccion: body.direccion,
        ruta:
          body.rutaId === undefined
            ? undefined
            : body.rutaId === null
              ? { disconnect: true }
              : { connect: { id: body.rutaId } },
        fotoDocumentoFrenteUrl: body.fotoDocumentoFrenteUrl,
        fotoDocumentoReversoUrl: body.fotoDocumentoReversoUrl,
        contactoNombre: body.contactoNombre,
        contactoTelefono: body.contactoTelefono,
      });
      return this.toDetail(client);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async remove(id: string): Promise<void> {
    const client = await this.clientsRepository.findById(id);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    await this.clientsRepository.update(id, { activo: false });
  }

  // Fase 4.13 — genera (o resetea) el acceso del cliente al portal: password
  // temporal + `mustChangePassword=true` + expiración de 24h. El staff ve
  // `temporaryPassword` UNA sola vez (no se persiste en claro).
  async generateAccess(id: string, user: AuthenticatedUser): Promise<GenerateAccessResponse> {
    const client = await this.clientsRepository.findById(id);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    await this.assertClientRouteAccess(client.rutaId, user);

    if (!client.activo) {
      throw new BadRequestException("No puedes generar acceso a un cliente inactivo.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000);

    await this.clientsRepository.update(id, {
      passwordHash,
      mustChangePassword: true,
      passwordExpiresAt: expiresAt,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
    });

    return { temporaryPassword, expiresAt: expiresAt.toISOString() };
  }

  // Revoca el acceso: el cliente ya no puede loguearse (passwordHash null es
  // el mismo criterio que "sin acceso" en `auth-cliente.service.ts:login`).
  async deleteAccess(id: string, user: AuthenticatedUser): Promise<void> {
    const client = await this.clientsRepository.findById(id);
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    await this.assertClientRouteAccess(client.rutaId, user);

    await this.clientsRepository.update(id, {
      passwordHash: null,
      mustChangePassword: false,
      passwordExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
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
    const clients = await this.clientsRepository.findManyForSummary(this.scopeWhere(user));

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

  private scopeWhere(user: AuthenticatedUser): Prisma.ClienteWhereInput {
    return {
      activo: true,
      // Igual que en rutas.service: una ruta desactivada no debe filtrar
      // clientes accesibles al cobrador por ningún camino (ni "Mis rutas" ni
      // "Clientes").
      ...(user.rol === "COBRADOR" ? { ruta: { cobradorId: user.sub, activa: true } } : {}),
    };
  }

  private scopedWhere(user: AuthenticatedUser, query: ClientesQuery): Prisma.ClienteWhereInput {
    return {
      ...this.scopeWhere(user),
      ...(query.rutaId ? { rutaId: query.rutaId } : {}),
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
    if (!route) throw new NotFoundException("La ruta no existe.");
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
    return {
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      documento: client.documento,
      direccion: client.direccion,
      fotoDocumentoFrenteUrl: client.fotoDocumentoFrenteUrl,
      fotoDocumentoReversoUrl: client.fotoDocumentoReversoUrl,
      rutaId: client.rutaId,
      contactoNombre: client.contactoNombre,
      contactoTelefono: client.contactoTelefono,
      ruta: client.ruta ? { id: client.ruta.id, nombre: client.ruta.nombre } : null,
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
      rutaId: client.rutaId,
      ruta: client.ruta ? { id: client.ruta.id, nombre: client.ruta.nombre } : null,
      saldoPendiente: agregados.saldoPendiente,
      porcentajePagado: agregados.porcentajePagado,
      estado: agregados.estado,
      cobradorNombre: client.ruta?.cobrador?.nombre ?? null,
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
