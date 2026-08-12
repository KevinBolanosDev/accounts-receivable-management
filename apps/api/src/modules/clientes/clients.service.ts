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
import { assertRouteAccess } from "../../core/domain/route-access.util";
import { ReceiptTokenService } from "../../core/receipts/receipt-token.service";
import { StorageService } from "../../core/storage/storage.service";
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
    private readonly storage: StorageService,
  ) {}

  async findAll(user: AuthenticatedUser, query: ClientesQuery): Promise<ClienteListItem[]> {
    const adminId = requireAdminId(user);
    const clients = await this.clientsRepository.findMany(this.scopedWhere(user, query), adminId);
    // Sin firmar: ninguna lista pinta la foto (solo el detalle), así que
    // firmar N×2 URLs por fila sería un round-trip a Storage completamente
    // inútil en el camino más transitado (listar clientes).
    return clients.map((client) => this.toListItem(client));
  }

  // `query.estado` deja pedir un cliente INACTIVO explícitamente (ADMIN-only,
  // ver `scopedWhere`) — lo usa la pantalla de "Clientes inactivos" para
  // previsualizar sus créditos abiertos antes de reactivarlo. Sin `estado`
  // (el caso de siempre) se comporta igual que antes: solo activos.
  async findOne(
    id: string,
    user: AuthenticatedUser,
    query: ClientesQuery = {},
  ): Promise<ClienteDetail> {
    const adminId = requireAdminId(user);
    const client = await this.clientsRepository.findById(
      id,
      this.scopedWhere(user, query),
      adminId,
    );
    if (!client) throw new NotFoundException("Cliente no encontrado.");
    const signedUrls = await this.signDocumentPhotos([client]);
    return this.toDetail(client, signedUrls);
  }

  async create(body: CreateClienteRequest, user: AuthenticatedUser): Promise<ClienteDetail> {
    const adminId = requireAdminId(user);
    if (body.rutaId) {
      await this.assertRouteAccess(body.rutaId, user);
    }

    // Dar de baja un cliente es un SOFT-delete (`ClientAdmin.activo=false`): la
    // fila `Cliente` sobrevive porque las FKs de dinero son `onDelete: Restrict`
    // y la auditoría manda. Pero `Cliente.documento` es `@unique` GLOBAL, así
    // que volver a dar de alta a la misma persona chocaba con el índice y
    // devolvía "Ya existe un cliente con ese documento" — un callejón sin
    // salida: el cliente inactivo tampoco aparece en el listado (que filtra por
    // `activo`), así que no había forma de recuperarlo ni de volver a crearlo.
    //
    // El alta de un documento que YA es mío pero está inactivo se trata como
    // una reactivación. Es la misma persona: conserva su historial y sus
    // créditos, que es exactamente el motivo por el que la baja es lógica.
    const existing = await this.clientsRepository.findByDocumento(body.documento, adminId);
    if (existing) {
      const myRelation = existing.admins[0];
      // Cliente activo mío, o cliente de otra cartera: 409 como siempre.
      // Vincular un cliente existente a un segundo admin sigue siendo una
      // acción explícita que todavía no existe (ver el comentario del `create`).
      if (myRelation && !myRelation.activo) {
        return this.reactivate(existing.id, body, adminId);
      }
    }

    try {
      const client = await this.clientsRepository.create(
        {
          nombre: body.nombre,
          telefono: body.telefono,
          documento: body.documento,
          direccion: body.direccion,
          fotoDocumentoFrentePath: body.fotoDocumentoFrentePath,
          fotoDocumentoReversoPath: body.fotoDocumentoReversoPath,
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
      const signedUrls = await this.signDocumentPhotos([client]);
      return this.toDetail(client, signedUrls);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Vuelve a activar MI relación con un cliente que di de baja, pisando sus
   * datos con los del alta (quien lo está registrando de nuevo tiene la
   * información más fresca: puede haber cambiado de teléfono o de dirección).
   *
   * Sus créditos y pagos siguen ahí y vuelven a la vista: la baja nunca los
   * borró — borrarlos habría sido imposible, `Pago`/`Credito` son
   * `onDelete: Restrict` justamente para que no se pueda hacer desaparecer
   * plata dando de baja a alguien.
   */
  private async reactivate(
    id: string,
    body: CreateClienteRequest,
    adminId: string,
  ): Promise<ClienteDetail> {
    try {
      const client = await this.clientsRepository.update(
        id,
        {
          nombre: body.nombre,
          telefono: body.telefono,
          direccion: body.direccion,
          fotoDocumentoFrentePath: body.fotoDocumentoFrentePath,
          fotoDocumentoReversoPath: body.fotoDocumentoReversoPath,
          contactoNombre: body.contactoNombre,
          contactoTelefono: body.contactoTelefono,
          admins: {
            update: {
              where: { clientId_adminId: { clientId: id, adminId } },
              data: { activo: true, rutaId: body.rutaId ?? null },
            },
          },
        },
        adminId,
      );
      const signedUrls = await this.signDocumentPhotos([client]);
      return { ...this.toDetail(client, signedUrls), reactivado: true };
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
          fotoDocumentoFrentePath: body.fotoDocumentoFrentePath,
          fotoDocumentoReversoPath: body.fotoDocumentoReversoPath,
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
      const signedUrls = await this.signDocumentPhotos([client]);
      return this.toDetail(client, signedUrls);
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

  // Reactivación DIRECTA desde la pantalla "Clientes inactivos" — a
  // diferencia de `reactivate` (privado, arriba), que revive al cliente como
  // efecto secundario de un alta con el mismo documento y PISA sus datos con
  // los del formulario nuevo, esta acción no pide nada: solo vuelve a activar
  // la relación tal cual estaba. Es la vía pensada para "me equivoqué, no
  // quería darlo de baja" o "vuelve a cobrar con este cliente" sin re-tipear
  // nombre/teléfono/dirección que no cambiaron.
  async reactivateInactive(id: string, user: AuthenticatedUser): Promise<ClienteDetail> {
    const adminId = requireAdminId(user);
    const client = await this.clientsRepository.findById(
      id,
      { admins: { some: { adminId, activo: false } } },
      adminId,
    );
    if (!client) {
      throw new NotFoundException("Cliente no encontrado o ya está activo.");
    }

    const updated = await this.clientsRepository.update(
      id,
      {
        admins: {
          update: {
            where: { clientId_adminId: { clientId: id, adminId } },
            data: { activo: true },
          },
        },
      },
      adminId,
    );
    const signedUrls = await this.signDocumentPhotos([updated]);
    return { ...this.toDetail(updated, signedUrls), reactivado: true };
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
    // `estado` es ADMIN-only: un COBRADOR nunca tuvo motivo para navegar la
    // cartera dada de baja de su admin, así que cualquier valor que mande se
    // ignora y cae al default de siempre ("activos").
    const estado = user.rol === "ADMIN" ? (query.estado ?? "activos") : "activos";
    return {
      admins: {
        some: {
          adminId,
          ...(estado === "todos" ? {} : { activo: estado === "inactivos" ? false : true }),
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

  // Delgado a propósito: la decisión (404 fuera de tenant / 403 ruta ajena)
  // vive en `core/domain/route-access.util.ts`, compartida con `cobros` y
  // `daily-closures` — acá solo queda la lectura, propia de este repository.
  private async assertRouteAccess(rutaId: string, user: AuthenticatedUser): Promise<void> {
    const route = await this.clientsRepository.findRouteById(rutaId);
    assertRouteAccess(route, user, { forbidden: "No puedes asignar clientes a una ruta ajena." });
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException("Ya existe un cliente con ese documento.");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return new NotFoundException("La ruta o el cliente no existe.");
    }
    // P2003 = FK inválida. Con el `rutaId` ya normalizado en el contrato el
    // caso conocido (cadena vacía) no llega hasta acá, pero cualquier id de
    // ruta inexistente que se cuele debe leerse como "esa ruta no existe" y
    // no como un 500 opaco que obliga a mirar los logs del servidor.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return new BadRequestException("La ruta indicada no existe.");
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
    });

    return {
      creditosActivos,
      creditosHistorial,
      saldoPendiente: Number(saldoActivos.toFixed(2)),
      porcentajePagado,
      estado,
    };
  }

  // Un solo round-trip a Storage para TODOS los clientes que se vayan a
  // mapear con `toDetail` (hoy siempre es uno, pero la firma en batch evita
  // que un futuro caller con varios clientes reintroduzca N llamadas).
  private async signDocumentPhotos(
    clients: Array<Pick<ClientWithDetail, "fotoDocumentoFrentePath" | "fotoDocumentoReversoPath">>,
  ): Promise<Map<string, string>> {
    const paths = clients
      .flatMap((c) => [c.fotoDocumentoFrentePath, c.fotoDocumentoReversoPath])
      .filter((path): path is string => path !== null);
    return this.storage.createSignedUrls(paths);
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
      fotoDocumentoFrentePath: client.fotoDocumentoFrentePath,
      fotoDocumentoReversoPath: client.fotoDocumentoReversoPath,
      // Nunca firmadas en una lista — ver el comentario del schema.
      fotoDocumentoFrenteUrl: null,
      fotoDocumentoReversoUrl: null,
      rutaId: myRelation?.rutaId ?? null,
      contactoNombre: client.contactoNombre,
      contactoTelefono: client.contactoTelefono,
      ruta: myRelation?.ruta ? { id: myRelation.ruta.id, nombre: myRelation.ruta.nombre } : null,
      saldoPendiente: agregados.saldoPendiente,
      porcentajePagado: agregados.porcentajePagado,
      estado: agregados.estado,
    };
  }

  private toDetail(client: ClientWithDetail, signedUrls: Map<string, string>): ClienteDetail {
    const agregados = this.computeAgregados(client.creditos);
    // Una sola referencia de "hoy" para todos los créditos: si se tomara dentro
    // del flatMap, dos créditos podrían caer en días distintos al cruzar la
    // medianoche a mitad del cálculo.
    const hoy = new Date();
    const myRelation = client.admins[0];

    return {
      // Solo el alta que reactiva lo pisa a `true` (ver `reactivate`); en todo
      // lo demás — y en cualquier `GET` — esta respuesta describe un cliente
      // que ya existía, no una reactivación.
      reactivado: false,
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      documento: client.documento,
      direccion: client.direccion,
      contactoNombre: client.contactoNombre,
      contactoTelefono: client.contactoTelefono,
      fotoDocumentoFrentePath: client.fotoDocumentoFrentePath,
      fotoDocumentoReversoPath: client.fotoDocumentoReversoPath,
      // `null` si el path es null, o si falló la firma (bucket caído, path
      // borrado a mano) — nunca lanza, ver `StorageService.createSignedUrls`.
      fotoDocumentoFrenteUrl: client.fotoDocumentoFrentePath
        ? (signedUrls.get(client.fotoDocumentoFrentePath) ?? null)
        : null,
      fotoDocumentoReversoUrl: client.fotoDocumentoReversoPath
        ? (signedUrls.get(client.fotoDocumentoReversoPath) ?? null)
        : null,
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
          {
            id: credito.id,
            fechaInicio: credito.fechaInicio,
            cuotas: credito.cuotas,
            frecuencia: credito.frecuencia,
          },
          credito.pagos.map((pago) => ({
            id: pago.id,
            creditoId: credito.id,
            monto: Number(pago.monto.toString()),
            fecha: pago.fecha,
            cobradorId: pago.cobradorId,
            cobradorNombre: pago.cobrador?.nombre ?? null,
            reciboUrl: pago.reciboUrl,
            anulado: pago.anulado,
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
